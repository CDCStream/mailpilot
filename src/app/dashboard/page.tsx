import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db, emailAccounts, messages, users, type Category } from "@/lib/db";
import { getUsage } from "@/lib/usage";

const CATEGORY_BADGES: Record<Category, string> = {
  to_respond: "bg-rose-100 text-rose-700",
  fyi: "bg-indigo-100 text-indigo-700",
  newsletter: "bg-amber-100 text-amber-700",
  marketing: "bg-orange-100 text-orange-700",
  notification: "bg-sky-100 text-sky-700",
  cold_email: "bg-zinc-100 text-zinc-500",
};

const CATEGORY_NAMES: Record<Category, string> = {
  to_respond: "To Respond",
  fyi: "FYI",
  newsletter: "Newsletter",
  marketing: "Marketing",
  notification: "Notification",
  cold_email: "Cold Email",
};

export default async function OverviewPage() {
  const session = await auth();
  const userId = session!.user.id;

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.onboardedAt) redirect("/onboarding");

  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  const accountIds = accounts.map((a) => a.id);
  const erroredAccount = accounts.find((a) => a.status === "error");

  const since = new Date();
  since.setDate(since.getDate() - 7);
  const recent = accountIds.length
    ? await db.query.messages.findMany({
        where: and(inArray(messages.accountId, accountIds), gte(messages.createdAt, since)),
        orderBy: [desc(messages.createdAt)],
        limit: 200,
      })
    : [];

  const triaged = recent.filter((m) => m.category);
  const draftsCreated = recent.filter((m) => m.actions?.draftCreated).length;
  const archived = recent.filter((m) => m.actions?.archived).length;
  const usage = await getUsage(userId);

  return (
    <div>
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Connected as {accounts[0]?.email ?? user.email} · last 7 days
      </p>

      {erroredAccount && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erroredAccount.lastError ?? "Gmail connection problem."}{" "}
          <Link href="/login" className="font-semibold underline">
            Reconnect Gmail
          </Link>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          ["Emails triaged", triaged.length],
          ["Drafts written for you", draftsCreated],
          ["Noise archived", archived],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 p-5">
            <p className="text-3xl font-bold">{value}</p>
            <p className="mt-1 text-sm text-zinc-500">{label}</p>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-zinc-400">
        Today&apos;s AI usage: {usage.classifications}/{usage.maxClassifications} triages ·{" "}
        {usage.drafts}/{usage.maxDrafts} drafts
      </p>

      <h2 className="mt-12 text-lg font-semibold">Recent activity</h2>
      {triaged.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">
          Nothing triaged yet. New emails are processed within a couple of minutes of
          arriving.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
          {triaged.slice(0, 25).map((m) => (
            <li key={m.id} className="flex items-center gap-4 px-5 py-3 text-sm">
              <span className="w-44 shrink-0 truncate font-medium">{m.fromAddress}</span>
              <span className="flex-1 truncate text-zinc-600">{m.subject || "(no subject)"}</span>
              {m.actions?.draftCreated && (
                <span className="hidden text-xs font-medium text-emerald-600 md:inline">
                  draft ready
                </span>
              )}
              {m.actions?.archived && (
                <span className="hidden text-xs text-zinc-400 md:inline">archived</span>
              )}
              {m.category && (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_BADGES[m.category]}`}
                >
                  {CATEGORY_NAMES[m.category]}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
