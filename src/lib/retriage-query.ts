import { and, asc, eq, gte, inArray, isNull, or } from "drizzle-orm";
import { db, emailAccounts, messages } from "@/lib/db";
import { retriageSince, type RetriageScope } from "@/lib/classifier-version";

export type RetriageTarget = { accountId: string; gmailId: string; messageId: string };

/**
 * Already-imported messages for this user, by Gmail arrival time.
 * Null received_at falls back to created_at so the scope cannot go empty.
 */
export async function listRetriageTargets(
  userId: string,
  scope: RetriageScope,
  now = new Date(),
): Promise<RetriageTarget[]> {
  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
    columns: { id: true },
  });
  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return [];

  const since = retriageSince(scope, now);
  const inAccounts = inArray(messages.accountId, accountIds);
  const arrivedSince = since
    ? or(gte(messages.receivedAt, since), and(isNull(messages.receivedAt), gte(messages.createdAt, since)))
    : undefined;

  const rows = await db.query.messages.findMany({
    where: arrivedSince ? and(inAccounts, arrivedSince) : inAccounts,
    orderBy: [asc(messages.receivedAt), asc(messages.id)],
    columns: { id: true, accountId: true, gmailMessageId: true },
  });

  return rows.map((r) => ({
    accountId: r.accountId,
    gmailId: r.gmailMessageId,
    messageId: r.id,
  }));
}
