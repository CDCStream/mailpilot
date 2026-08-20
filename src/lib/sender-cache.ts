import { and, eq } from "drizzle-orm";
import { db, senderCategoryCache, type Category } from "@/lib/db";
import { senderDomain } from "@/lib/pre-classify";
import { nextCacheState, shouldApplyCachedCategory } from "@/lib/sender-cache-logic";

export async function cachedSenderCategory(
  userId: string,
  fromEmail: string,
): Promise<Category | null> {
  const domain = senderDomain(fromEmail);
  if (!domain) return null;
  const row = await db.query.senderCategoryCache.findFirst({
    where: and(
      eq(senderCategoryCache.userId, userId),
      eq(senderCategoryCache.senderDomain, domain),
    ),
  });
  if (!row) return null;
  return shouldApplyCachedCategory({
    category: row.category,
    sampleCount: row.sampleCount,
    userOverride: row.userOverride,
  });
}

/** Persist a streak. User overrides are never overwritten by the model. */
export async function rememberSenderCategory(
  userId: string,
  fromEmail: string,
  category: Category,
  userOverride = false,
): Promise<void> {
  const domain = senderDomain(fromEmail);
  if (!domain) return;

  const existing = await db.query.senderCategoryCache.findFirst({
    where: and(
      eq(senderCategoryCache.userId, userId),
      eq(senderCategoryCache.senderDomain, domain),
    ),
  });
  const next = nextCacheState(
    existing
      ? {
          category: existing.category,
          sampleCount: existing.sampleCount,
          userOverride: existing.userOverride,
        }
      : null,
    category,
    userOverride,
  );
  if (!next) return;

  await db
    .insert(senderCategoryCache)
    .values({
      userId,
      senderDomain: domain,
      category: next.category,
      sampleCount: next.sampleCount,
      userOverride: next.userOverride,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [senderCategoryCache.userId, senderCategoryCache.senderDomain],
      set: {
        category: next.category,
        sampleCount: next.sampleCount,
        userOverride: next.userOverride,
        updatedAt: new Date(),
      },
    });
}

/** Manual recategorize drops the sender cache so one title cannot poison the domain. */
export async function forgetSenderCategory(userId: string, fromEmail: string): Promise<void> {
  const domain = senderDomain(fromEmail);
  if (!domain) return;
  await db
    .delete(senderCategoryCache)
    .where(
      and(
        eq(senderCategoryCache.userId, userId),
        eq(senderCategoryCache.senderDomain, domain),
      ),
    );
}
