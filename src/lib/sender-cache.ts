import { and, eq, or, like, ilike } from "drizzle-orm";
import { db, messages, senderCategoryCache, type Category } from "@/lib/db";
import { senderDomain } from "@/lib/pre-classify";
import { nextCacheState, shouldApplyCachedCategory, isUncacheableDomain } from "@/lib/sender-cache-logic";

export async function cachedSenderCategory(
  userId: string,
  fromEmail: string,
): Promise<Category | null> {
  const domain = senderDomain(fromEmail);
  if (!domain || isUncacheableDomain(domain)) return null;
  try {
    const row = await db.query.senderCategoryCache.findFirst({
      where: and(
        eq(senderCategoryCache.userId, userId),
        eq(senderCategoryCache.senderDomain, domain),
      ),
    });
    if (!row) return null;
    return shouldApplyCachedCategory({
      category: row.category,
      sampleCount: row.sampleCount ?? 0,
      userOverride: row.userOverride,
    });
  } catch (err) {
    console.error("sender cache read failed", err);
    return null;
  }
}

/** Persist a streak. User overrides are never overwritten by the model. */
export async function rememberSenderCategory(
  userId: string,
  fromEmail: string,
  category: Category,
  userOverride = false,
): Promise<void> {
  const domain = senderDomain(fromEmail);
  if (!domain || isUncacheableDomain(domain)) return;
  if (!userOverride && (category === "money" || category === "security")) return;

  try {
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
            sampleCount: existing.sampleCount ?? 0,
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
  } catch (err) {
    console.error("sender cache write failed", err);
  }
}

/** Manual recategorize drops the sender cache so one title cannot poison the domain. */
export async function forgetSenderCategory(userId: string, fromEmail: string): Promise<void> {
  const domain = senderDomain(fromEmail);
  if (!domain) return;
  try {
    await db
      .delete(senderCategoryCache)
      .where(
        and(
          eq(senderCategoryCache.userId, userId),
          eq(senderCategoryCache.senderDomain, domain),
        ),
      );
  } catch (err) {
    console.error("sender cache delete failed", err);
  }
}

/** Drop every LinkedIn / Money / Security cache row so a poisoned domain cannot spread. */
export async function purgePoisonedSenderCache(): Promise<number> {
  try {
    const gone = await db
      .delete(senderCategoryCache)
      .where(
        or(
          like(senderCategoryCache.senderDomain, "%linkedin%"),
          like(senderCategoryCache.senderDomain, "%lnkd.in%"),
          eq(senderCategoryCache.category, "money"),
          eq(senderCategoryCache.category, "security"),
        ),
      )
      .returning({ id: senderCategoryCache.id });
    return gone.length;
  } catch (err) {
    console.error("sender cache purge failed", err);
    return 0;
  }
}

/** Immediate repair: policy / promo mail must not sit in Security even on resume. */
export async function relabelSecurityNegatives(): Promise<number> {
  try {
    const marketing = await db
      .update(messages)
      .set({ category: "marketing" })
      .where(
        and(
          eq(messages.category, "security"),
          or(
            ilike(messages.fromAddress, "%udemy%"),
            and(ilike(messages.subject, "%still interested%"), ilike(messages.subject, "%seo%")),
          ),
        ),
      )
      .returning({ id: messages.id });
    const notices = await db
      .update(messages)
      .set({ category: "notification" })
      .where(
        and(
          eq(messages.category, "security"),
          or(
            ilike(messages.subject, "%household%"),
            ilike(messages.fromAddress, "%fyxer%"),
            ilike(messages.fromAddress, "%privacy@%"),
            ilike(messages.subject, "%sub-process%"),
            ilike(messages.subject, "%subprocessor%"),
          ),
        ),
      )
      .returning({ id: messages.id });
    return marketing.length + notices.length;
  } catch (err) {
    console.error("security-negative relabel failed", err);
    return 0;
  }
}

/** Immediate repair: LinkedIn mail must not sit in Security even before re-triage finishes. */
export async function relabelPoisonedLinkedInSecurity(): Promise<number> {
  try {
    const gone = await db
      .update(messages)
      .set({ category: "notification" })
      .where(
        and(
          eq(messages.category, "security"),
          or(ilike(messages.fromAddress, "%linkedin%"), ilike(messages.fromAddress, "%lnkd.in%")),
        ),
      )
      .returning({ id: messages.id });
    return gone.length;
  } catch (err) {
    console.error("linkedin security relabel failed", err);
    return 0;
  }
}
