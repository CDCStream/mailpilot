import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, emailAccounts, messages } from "@/lib/db";
import { retriageSince, type RetriageScope } from "@/lib/classifier-version";

export type RetriageTarget = { accountId: string; gmailId: string };

/**
 * Already-imported messages for this user, by Gmail arrival time.
 * COALESCE(received_at, created_at) so a null received_at cannot empty the scope.
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

  const rows = await db.query.messages.findMany({
    where: since
      ? and(
          inAccounts,
          sql`coalesce(${messages.receivedAt}, ${messages.createdAt}) >= ${since}`,
        )
      : inAccounts,
    orderBy: [asc(messages.receivedAt), asc(messages.id)],
    columns: { accountId: true, gmailMessageId: true },
  });

  return rows.map((r) => ({ accountId: r.accountId, gmailId: r.gmailMessageId }));
}
