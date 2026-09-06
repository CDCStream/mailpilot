import { eq } from "drizzle-orm";
import { db, creditTopups, subscriptions } from "@/lib/db";
import {
  ensurePaddleCustomer,
  getPaddleInstance,
  isPaddleCustomerId,
  isPaddleSubscriptionId,
  planFromPaddlePriceId,
} from "@/lib/paddle";
import { isPlanId, planFromPriceId, type PlanId } from "@/lib/plans";
import { grantBonusCredits } from "@/lib/usage";

export type PaddleSubscriptionSnapshot = {
  id: string;
  status: string;
  customerId: string;
  items: { price?: { id?: string } | null }[];
  customData?: Record<string, unknown> | null;
  currentBillingPeriod?: { endsAt?: string | null } | null;
};

function customString(
  data: Record<string, unknown> | null | undefined,
  key: string,
): string {
  const value = data?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

const LIVE_STATUSES = new Set(["active", "past_due", "trialing", "paused"]);

export async function applyPaddleSubscription(
  sub: PaddleSubscriptionSnapshot,
  fallbackUserId?: string,
): Promise<void> {
  const custom = (sub.customData ?? {}) as Record<string, unknown>;
  const userId = customString(custom, "userId") || fallbackUserId || "";
  const priceId = sub.items[0]?.price?.id ?? null;
  const planFromMeta = customString(custom, "plan");
  const plan: PlanId | null = isPlanId(planFromMeta)
    ? planFromMeta
    : planFromPaddlePriceId(priceId) ?? planFromPriceId(priceId);

  const periodEnd = sub.currentBillingPeriod?.endsAt
    ? new Date(sub.currentBillingPeriod.endsAt)
    : null;

  const values = {
    stripeCustomerId: sub.customerId,
    stripeSubscriptionId: sub.id,
    status: sub.status,
    priceId,
    currentPeriodEnd: periodEnd,
    updatedAt: new Date(),
    ...(plan ? { plan } : {}),
  };

  if (userId) {
    await db
      .insert(subscriptions)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: subscriptions.userId, set: values });
    return;
  }

  await db
    .update(subscriptions)
    .set(values)
    .where(eq(subscriptions.stripeCustomerId, sub.customerId));
}

function pickLatestSubscription<T extends { status: string; updatedAt?: string }>(
  items: T[],
): T | null {
  if (items.length === 0) return null;
  const ranked = [...items].sort((a, b) => {
    const aLive = LIVE_STATUSES.has(a.status) ? 1 : 0;
    const bLive = LIVE_STATUSES.has(b.status) ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;
    return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
  });
  return ranked[0] ?? null;
}

/**
 * Pull the user's current Paddle subscription into `subscriptions`.
 * Used when webhooks are late or missing (sandbox / first checkout).
 */
export async function syncPaddleSubscriptionForUser(userId: string): Promise<boolean> {
  const row = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  let customerId = row?.stripeCustomerId ?? "";
  if (!isPaddleCustomerId(customerId)) {
    customerId = await ensurePaddleCustomer(userId);
  }

  const paddle = getPaddleInstance();
  const found: Array<PaddleSubscriptionSnapshot & { updatedAt: string }> = [];
  const collection = paddle.subscriptions.list({
    customerId: [customerId],
    perPage: 15,
  });
  for await (const item of collection) {
    found.push({
      id: item.id,
      status: item.status,
      customerId: item.customerId,
      items: item.items,
      customData: (item.customData ?? null) as Record<string, unknown> | null,
      currentBillingPeriod: item.currentBillingPeriod,
      updatedAt: item.updatedAt,
    });
  }

  const latest = pickLatestSubscription(found);
  if (!latest) return false;

  await applyPaddleSubscription(latest, userId);
  return true;
}

export async function applyTopupFromTransaction(txn: {
  id: string;
  customData?: Record<string, unknown> | null;
  details?: { totals?: { total?: string | number | null } | null } | null;
}): Promise<boolean> {
  const custom = (txn.customData ?? {}) as Record<string, unknown>;
  if (customString(custom, "type") !== "credit_topup") return false;

  const userId = customString(custom, "userId");
  const packId = customString(custom, "packId") || "unknown";
  const credits = Number(customString(custom, "credits"));
  if (!userId || !Number.isFinite(credits) || credits <= 0) return false;

  const amountCents = Number(txn.details?.totals?.total ?? 0);

  const inserted = await db
    .insert(creditTopups)
    .values({
      userId,
      stripeSessionId: txn.id,
      packId,
      credits,
      amountCents: Number.isFinite(amountCents) ? amountCents : 0,
    })
    .onConflictDoNothing()
    .returning({ id: creditTopups.id });

  if (inserted.length === 0) return false;
  await grantBonusCredits(userId, credits);
  return true;
}

/**
 * Grant completed one-time top-ups when the webhook is late or missing.
 * Idempotent via credit_topups.stripe_session_id = Paddle transaction id.
 */
export async function syncPaddleTopupsForUser(userId: string): Promise<number> {
  const row = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  const customerId = row?.stripeCustomerId ?? "";
  if (!isPaddleCustomerId(customerId)) return 0;

  const paddle = getPaddleInstance();
  const collection = paddle.transactions.list({
    customerId: [customerId],
    status: ["completed"],
    perPage: 30,
  });

  let granted = 0;
  for await (const txn of collection) {
    const applied = await applyTopupFromTransaction({
      id: txn.id,
      customData: (txn.customData ?? null) as Record<string, unknown> | null,
      details: txn.details,
    });
    if (applied) granted += 1;
  }
  return granted;
}

export function shouldSyncPaddleSubscription(opts: {
  status: string;
  subscriptionId: string | null | undefined;
  force?: boolean;
}): boolean {
  if (opts.force) return true;
  if (opts.status === "trialing" || opts.status === "none") return true;
  return !isPaddleSubscriptionId(opts.subscriptionId);
}
