import { and, desc, eq, gte, inArray, isNotNull, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { db, emailAccounts, messages } from "@/lib/db";
import { gmailThreadUrl } from "@/lib/gmail";
import { CREDIT_COSTS } from "@/lib/plans";
import { getActiveAccountId } from "../active-account";
import { writeDraftForMessage } from "../actions";
import { displayFrom } from "../categories";
import { PendingButton } from "../pending-button";

export default async function DraftsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const allAccounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  // Honor the sidebar account switcher.
  const activeAccountId = await getActiveAccountId();
  const accounts = allAccounts.some((a) => a.id === activeAccountId)
    ? allAccounts.filter((a) => a.id === activeAccountId)
    : allAccounts;
  const accountIds = accounts.map((a) => a.id);
  const emailByAccount = new Map(allAccounts.map((a) => [a.id, a.email]));

  const written = accountIds.length
    ? await db.query.messages.findMany({
        where: and(inArray(messages.accountId, accountIds), isNotNull(messages.draftId)),
        orderBy: [desc(messages.createdAt)],
        limit: 50,
      })
    : [];

  // Reply-worthy mail from the last 14 days that doesn't have a draft yet.
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const candidateRows = accountIds.length
    ? await db.query.messages.findMany({
        where: and(
          inArray(messages.accountId, accountIds),
          eq(messages.category, "to_respond"),
          isNotNull(messages.summary),
          isNull(messages.draftId),
          gte(messages.receivedAt, since),
        ),
        orderBy: [desc(messages.receivedAt)],
        limit: 80,
      })
    : [];
  const seenThreads = new Set<string>();
  const candidates = candidateRows.filter((m) => {
    if (seenThreads.has(m.threadId)) return false;
    seenThreads.add(m.threadId);
    return true;
  }).slice(0, 25);
  const threadCounts = new Map<string, number>();
  for (const m of candidateRows) {
    threadCounts.set(m.threadId, (threadCounts.get(m.threadId) ?? 0) + 1);
  }

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <h1 className="text-2xl font-bold">Drafts</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Replies Wingman has already written for you, plus reply-worthy emails you can draft on
        demand ({CREDIT_COSTS.draft} credits each).
      </p>

      <div className="mt-8 grid items-start gap-10 xl:grid-cols-2">
      <section>
        <h2 className="text-lg font-semibold">Waiting for a draft</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Reply-worthy threads from the last 14 days without a draft yet. Same Gmail
          thread is listed once.
        </p>
        {candidates.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
            Nothing waiting — every reply-worthy email already has a draft.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
            {candidates.map((m) => (
              <li key={m.id} className="flex items-center gap-4 px-5 py-3.5 text-sm">
                <span className="w-40 shrink-0 truncate font-medium">
                  {displayFrom(m.fromAddress)}
                </span>
                <a
                  href={gmailThreadUrl(emailByAccount.get(m.accountId) ?? "", m.threadId)}
                  target="_blank"
                  rel="noreferrer"
                  className="min-w-0 flex-1 hover:underline"
                >
                  <span className="block truncate text-zinc-800">
                    {m.subject || "(no subject)"}
                  </span>
                  <span className="block truncate text-xs text-zinc-400">
                    {(threadCounts.get(m.threadId) ?? 1) > 1
                      ? `${threadCounts.get(m.threadId)} messages · `
                      : ""}
                    {m.summary ?? m.snippet ?? ""}
                  </span>
                </a>
                <span className="hidden w-14 shrink-0 text-right text-xs text-zinc-400 sm:block">
                  {m.receivedAt?.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  }) ?? ""}
                </span>
                <form action={writeDraftForMessage} className="shrink-0">
                  <input type="hidden" name="messageId" value={m.id} />
                  <PendingButton
                    pendingText="Writing…"
                    className="rounded-full bg-teal-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    Write draft
                  </PendingButton>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">Drafts written for you</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Each one is sitting in the email&apos;s thread in Gmail — review, edit, and hit send.
        </p>
        {written.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
            No drafts yet. They appear here as soon as Wingman writes one.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
            {written.map((m) => (
              <li key={m.id}>
                <a
                  href={gmailThreadUrl(emailByAccount.get(m.accountId) ?? "", m.threadId)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-4 px-5 py-3.5 text-sm transition hover:bg-zinc-50"
                >
                  <span className="w-40 shrink-0 truncate font-medium">
                    {displayFrom(m.fromAddress)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-zinc-800">
                      {m.subject || "(no subject)"}
                    </span>
                    <span className="block truncate text-xs text-zinc-400">
                      {m.summary ?? m.snippet ?? ""}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                    draft in Gmail
                  </span>
                  <span className="w-14 shrink-0 text-right text-xs text-zinc-400">
                    {m.receivedAt?.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    }) ?? ""}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}
