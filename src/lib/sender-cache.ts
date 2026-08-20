import { and, eq } from "drizzle-orm";
import { db, senderCategoryCache, type Category } from "@/lib/db";
import { senderDomain } from "@/lib/pre-classify";

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
  return row?.category ?? null;
}

/** Persist the latest decision. User overrides are never overwritten by the model. */
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
  if (existing?.userOverride && !userOverride) return;

  await db
    .insert(senderCategoryCache)
    .values({
      userId,
      senderDomain: domain,
      category,
      userOverride,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [senderCategoryCache.userId, senderCategoryCache.senderDomain],
      set: { category, userOverride, updatedAt: new Date() },
    });
}
