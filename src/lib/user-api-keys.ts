import { createHash, randomBytes } from "crypto";
import { eq } from "drizzle-orm";
import { db, users, creditTopups, DEFAULT_PREFERENCES, type UserPreferences } from "@/lib/db";
import { normalizePromoKeyName, promoClaimId, promoCreditsForKeyName } from "@/lib/promo-key";
import { grantBonusCredits } from "@/lib/usage";

export type StoredApiKey = {
  id: string;
  name: string;
  prefix: string;
  hash: string;
  createdAt: string;
};

export type ApiKeyPublic = Omit<StoredApiKey, "hash">;

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function readKeys(prefs: UserPreferences | null | undefined): StoredApiKey[] {
  return Array.isArray(prefs?.apiKeys) ? prefs.apiKeys : [];
}

function withKeys(prefs: UserPreferences | null | undefined, apiKeys: StoredApiKey[]): UserPreferences {
  return { ...(prefs ?? DEFAULT_PREFERENCES), apiKeys };
}

/** First matching name grants bonus credits; later creates/renames do not. */
export async function claimPromoCreditsOnCreate(
  userId: string,
  name: string,
): Promise<{ granted: number } | { granted: 0; reason: "not-promo" | "already-claimed" }> {
  const credits = promoCreditsForKeyName(name);
  if (!credits) return { granted: 0, reason: "not-promo" };

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { preferences: true },
  });
  const claim = normalizePromoKeyName(name);
  const claimed = user?.preferences?.promoClaims ?? [];
  if (claimed.includes(claim)) return { granted: 0, reason: "already-claimed" };

  await grantBonusCredits(userId, credits);
  await db
    .update(users)
    .set({
      preferences: {
        ...(user?.preferences ?? DEFAULT_PREFERENCES),
        promoClaims: [...claimed, claim],
      },
    })
    .where(eq(users.id, userId));

  try {
    await db
      .insert(creditTopups)
      .values({
        userId,
        stripeSessionId: promoClaimId(userId, name),
        packId: `promo:${normalizeSafe(name)}`,
        credits,
        amountCents: 0,
      })
      .onConflictDoNothing();
  } catch (err) {
    console.error("promo topup row failed", { userId, claim, err });
  }

  return { granted: credits };
}

/** If a promo-named key already exists but credits never landed, grant once. */
export async function syncPromoCreditsForUser(userId: string): Promise<number> {
  const keys = await listApiKeys(userId);
  let granted = 0;
  for (const key of keys) {
    const result = await claimPromoCreditsOnCreate(userId, key.name);
    granted += result.granted;
  }
  return granted;
}

function normalizeSafe(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_");
}

export async function listApiKeys(userId: string): Promise<ApiKeyPublic[]> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { preferences: true },
  });
  return readKeys(user?.preferences).map(({ hash: _h, ...rest }) => rest);
}

export async function createApiKey(
  userId: string,
  name: string,
): Promise<{ key: ApiKeyPublic & { secret: string }; granted: number }> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) throw new Error("invalid-name");

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { preferences: true },
  });
  const existing = readKeys(user?.preferences);
  const secret = `iw_${randomBytes(24).toString("base64url")}`;
  const row: StoredApiKey = {
    id: randomBytes(8).toString("hex"),
    name: trimmed,
    prefix: secret.slice(0, 7),
    hash: hashKey(secret),
    createdAt: new Date().toISOString(),
  };

  await db
    .update(users)
    .set({ preferences: withKeys(user?.preferences, [...existing, row]) })
    .where(eq(users.id, userId));

  const claim = await claimPromoCreditsOnCreate(userId, trimmed);
  return {
    key: { id: row.id, name: row.name, prefix: row.prefix, createdAt: row.createdAt, secret },
    granted: claim.granted,
  };
}

export async function renameApiKey(userId: string, keyId: string, name: string): Promise<ApiKeyPublic | null> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 80) throw new Error("invalid-name");

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { preferences: true },
  });
  const existing = readKeys(user?.preferences);
  const idx = existing.findIndex((k) => k.id === keyId);
  if (idx < 0) return null;
  const next = existing.map((k, i) => (i === idx ? { ...k, name: trimmed } : k));
  await db
    .update(users)
    .set({ preferences: withKeys(user?.preferences, next) })
    .where(eq(users.id, userId));
  const { hash: _h, ...pub } = next[idx]!;
  return pub;
}

export async function deleteApiKey(userId: string, keyId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { preferences: true },
  });
  const existing = readKeys(user?.preferences);
  const next = existing.filter((k) => k.id !== keyId);
  if (next.length === existing.length) return false;
  await db
    .update(users)
    .set({ preferences: withKeys(user?.preferences, next) })
    .where(eq(users.id, userId));
  return true;
}
