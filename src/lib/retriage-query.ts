import { and, asc, count, eq, gte, inArray, isNull, or, type SQL } from "drizzle-orm";
import { db, emailAccounts, messages } from "@/lib/db";
import { retriageSince, type RetriageScope } from "@/lib/classifier-version";

export type RetriageTarget = { accountId: string; gmailId: string; messageId: string };

async function accountIdsForUser(userId: string): Promise<string[]> {
  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
    columns: { id: true },
  });
  return accounts.map((a) => a.id);
}

function scopeWhere(accountIds: string[], scope: RetriageScope, now: Date): SQL | undefined {
  const inAccounts = inArray(messages.accountId, accountIds);
  const since = retriageSince(scope, now);
  const arrivedSince = since
    ? or(gte(messages.receivedAt, since), and(isNull(messages.receivedAt), gte(messages.createdAt, since)))
    : undefined;
  return arrivedSince ? and(inAccounts, arrivedSince) : inAccounts;
}

/** Fast denominator for the job row — does not load message ids on the request path. */
export async function countRetriageTargets(
  userId: string,
  scope: RetriageScope,
  now = new Date(),
): Promise<number> {
  const accountIds = await accountIdsForUser(userId);
  if (accountIds.length === 0) return 0;
  const [row] = await db
    .select({ n: count() })
    .from(messages)
    .where(scopeWhere(accountIds, scope, now));
  return Number(row?.n ?? 0);
}

/**
 * Already-imported messages for this user, by Gmail arrival time.
 * Null received_at falls back to created_at so the scope cannot go empty.
 */
export async function listRetriageTargets(
  userId: string,
  scope: RetriageScope,
  now = new Date(),
): Promise<RetriageTarget[]> {
  const accountIds = await accountIdsForUser(userId);
  if (accountIds.length === 0) return [];

  const rows = await db.query.messages.findMany({
    where: scopeWhere(accountIds, scope, now),
    orderBy: [asc(messages.receivedAt), asc(messages.id)],
    columns: { id: true, accountId: true, gmailMessageId: true },
  });

  return rows.map((r) => ({
    accountId: r.accountId,
    gmailId: r.gmailMessageId,
    messageId: r.id,
  }));
}
