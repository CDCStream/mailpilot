import { and, eq, gte, inArray, isNotNull, or, type SQL } from "drizzle-orm";
import { messages, type Category } from "@/lib/db/schema";

/** Canonical "needs you" window used on every surface (overview, brief, chat, inbox copy). */
export const NEEDS_YOU_WINDOW_HOURS = 24;
export const NEEDS_YOU_WINDOW_LABEL = "last 24 hours";

/** Money and Security outrank To Respond in "Needs you" ordering. */
export const NEEDS_YOU_CATEGORIES = ["money", "security", "to_respond"] as const satisfies Category[];

export const NEEDS_YOU_RANK: Record<(typeof NEEDS_YOU_CATEGORIES)[number], number> = {
  money: 0,
  security: 1,
  to_respond: 2,
};

export function needsYouSince(now = new Date()): Date {
  return new Date(now.getTime() - NEEDS_YOU_WINDOW_HOURS * 60 * 60 * 1000);
}

export function isNeedsYouCategory(category: Category | null | undefined): boolean {
  return (
    category === "money" || category === "security" || category === "to_respond"
  );
}

export function needsYouSql(accountIds: string[], since: Date): SQL {
  return and(
    inArray(messages.accountId, accountIds),
    gte(messages.receivedAt, since),
    isNotNull(messages.summary),
    or(
      eq(messages.category, "money"),
      eq(messages.category, "security"),
      eq(messages.category, "to_respond"),
    ),
  )!;
}

export function sortNeedsYou<T extends { category: Category | null; receivedAt: Date | null }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => {
    const ra = a.category && a.category in NEEDS_YOU_RANK
      ? NEEDS_YOU_RANK[a.category as keyof typeof NEEDS_YOU_RANK]
      : 9;
    const rb = b.category && b.category in NEEDS_YOU_RANK
      ? NEEDS_YOU_RANK[b.category as keyof typeof NEEDS_YOU_RANK]
      : 9;
    if (ra !== rb) return ra - rb;
    return (b.receivedAt?.getTime() ?? 0) - (a.receivedAt?.getTime() ?? 0);
  });
}
