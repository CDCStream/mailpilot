import { desc, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db, emailAccounts, followups } from "@/lib/db";
import { dismissFollowup } from "../actions";

export default async function FollowupsPage() {
  const session = await auth();
  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, session!.user.id),
  });
  const accountIds = accounts.map((a) => a.id);

  const items = accountIds.length
    ? await db.query.followups.findMany({
        where: inArray(followups.accountId, accountIds),
        orderBy: [desc(followups.dueAt)],
        limit: 100,
      })
    : [];

  const open = items.filter((f) => f.status === "waiting" || f.status === "due");
  const closed = items.filter((f) => f.status === "replied").slice(0, 10);

  return (
    <div>
      <h1 className="text-2xl font-bold">Follow-ups</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Emails you sent that haven&apos;t received a reply. Overdue ones also appear in your
        daily brief.
      </p>

      {open.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">
          Nothing waiting on a reply. Send an email and Inbox Wingman will start tracking it.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {open.map((f) => {
            const overdue = f.status === "due" || f.dueAt < new Date();
            return (
              <li key={f.id} className="flex items-center gap-4 rounded-2xl border border-zinc-200 p-4">
                <div className="flex-1">
                  <p className="text-sm font-medium">{f.subject || "(no subject)"}</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    to {f.toRecipients} · sent {f.sentAt.toDateString()}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    overdue ? "bg-rose-100 text-rose-700" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {overdue ? "Time to nudge" : `Due ${f.dueAt.toDateString()}`}
                </span>
                <form
                  action={async () => {
                    "use server";
                    await dismissFollowup(f.id);
                  }}
                >
                  <button type="submit" className="text-xs font-medium text-zinc-400 hover:text-zinc-700">
                    Dismiss
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      {closed.length > 0 && (
        <>
          <h2 className="mt-12 text-lg font-semibold">Recently answered</h2>
          <ul className="mt-4 space-y-2">
            {closed.map((f) => (
              <li key={f.id} className="flex items-center gap-3 text-sm text-zinc-500">
                <span className="text-emerald-600">✓</span>
                <span className="truncate">{f.subject || "(no subject)"}</span>
                <span className="text-xs">— {f.toRecipients}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
