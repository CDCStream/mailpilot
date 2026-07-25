import { and, eq, sql } from "drizzle-orm";
import { db, usageCounters } from "@/lib/db";

const MAX_CLASSIFICATIONS = Number(process.env.MAX_DAILY_CLASSIFICATIONS ?? 300);
const MAX_DRAFTS = Number(process.env.MAX_DAILY_DRAFTS ?? 50);

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Atomically increments a usage counter and reports whether the user is still
 * within their daily budget. Callers should skip the LLM call when false.
 */
export async function consumeBudget(
  userId: string,
  kind: "classifications" | "drafts",
  amount = 1,
): Promise<boolean> {
  const day = today();
  const [row] = await db
    .insert(usageCounters)
    .values({ userId, day, [kind]: amount })
    .onConflictDoUpdate({
      target: [usageCounters.userId, usageCounters.day],
      set: { [kind]: sql`${usageCounters[kind]} + ${amount}` },
    })
    .returning();

  const limit = kind === "classifications" ? MAX_CLASSIFICATIONS : MAX_DRAFTS;
  return row[kind] <= limit;
}

export async function getUsage(userId: string) {
  const row = await db.query.usageCounters.findFirst({
    where: and(eq(usageCounters.userId, userId), eq(usageCounters.day, today())),
  });
  return {
    classifications: row?.classifications ?? 0,
    drafts: row?.drafts ?? 0,
    maxClassifications: MAX_CLASSIFICATIONS,
    maxDrafts: MAX_DRAFTS,
  };
}
