import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import {
  db,
  briefs,
  emailAccounts,
  messages,
  users,
  DEFAULT_PREFERENCES,
} from "@/lib/db";
import { CREDIT_COSTS } from "@/lib/plans";
import { sendBriefNow, updateBriefHour } from "../actions";

/** 6am–11pm, like a sensible send-time range. */
const HOUR_OPTIONS = Array.from({ length: 18 }, (_, i) => i + 6);

function hourLabel(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

export default async function BriefsPage() {
  const session = await auth();
  const userId = session!.user.id;

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const prefs = user?.preferences ?? DEFAULT_PREFERENCES;

  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  const accountIds = accounts.map((a) => a.id);

  // Emails currently waiting on a reply (last 7 days).
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const waiting = accountIds.length
    ? (
        await db.query.messages.findMany({
          where: and(
            inArray(messages.accountId, accountIds),
            eq(messages.category, "to_respond"),
            gte(messages.createdAt, since),
          ),
          columns: { id: true },
        })
      ).length
    : 0;

  const history = await db.query.briefs.findMany({
    where: eq(briefs.userId, userId),
    orderBy: [desc(briefs.createdAt)],
    limit: 20,
  });
  const [latest, ...earlier] = history;

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      {/* Header */}
      <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-teal-700">
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4l2.5 2.5" strokeLinecap="round" />
        </svg>
        Daily Brief
      </span>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Your daily brief</h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-500">
            Generate a brief to see your most important emails — with draft replies, newsletter
            takeaways, deadlines and deliveries. Covers the last 24 hours ({CREDIT_COSTS.brief}{" "}
            credits).
          </p>
        </div>
        <form action={sendBriefNow}>
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Generate brief
          </button>
        </form>
      </div>

      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left: latest brief or empty state */}
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            {waiting.toLocaleString("en-US")} email{waiting === 1 ? "" : "s"} waiting on you
          </p>

          {!latest ? (
            <div className="mt-3 flex min-h-72 flex-col items-center justify-center rounded-3xl border border-zinc-200 bg-white px-8 py-16 text-center shadow-sm">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-50 text-teal-600">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <p className="mt-5 text-lg font-semibold text-zinc-900">
                {waiting === 0 ? "All caught up" : "No briefs yet"}
              </p>
              <p className="mt-2 max-w-xs text-sm text-zinc-500">
                {waiting === 0
                  ? "Nothing is waiting on a reply right now. Generate a brief and it will show up here."
                  : "Hit \u201cGenerate brief\u201d to get a summary of what needs you, delivered here and to your email."}
              </p>
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 border-b border-zinc-100 bg-zinc-50/60 px-6 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900">{latest.subject}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {latest.createdAt.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    ·{" "}
                    {latest.createdAt.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700">
                  latest
                </span>
              </div>
              <div
                className="px-6 py-5"
                // Self-generated HTML (the same markup we email), never user input.
                dangerouslySetInnerHTML={{ __html: latest.html }}
              />
            </div>
          )}

          {earlier.length > 0 && (
            <div className="mt-8">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
                Earlier briefs
              </p>
              <div className="mt-3 space-y-3">
                {earlier.map((b) => (
                  <details key={b.id} className="group rounded-2xl border border-zinc-200 bg-white">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 px-5 py-3.5 text-sm [&::-webkit-details-marker]:hidden">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-zinc-900">
                          {b.subject}
                        </span>
                        <span className="mt-0.5 block text-xs text-zinc-400">
                          {b.createdAt.toLocaleDateString("en-US", {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-zinc-400 group-open:hidden">Open</span>
                      <span className="hidden shrink-0 text-xs text-zinc-400 group-open:inline">
                        Close
                      </span>
                    </summary>
                    <div
                      className="border-t border-zinc-100 px-5 py-4"
                      dangerouslySetInnerHTML={{ __html: b.html }}
                    />
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-900">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 3" strokeLinecap="round" />
                </svg>
                Auto-send time
              </p>
              <span className="text-xs text-zinc-400">
                {prefs.briefEnabled ? "Daily" : "Off"}
              </span>
            </div>
            <form action={updateBriefHour} className="mt-4 grid grid-cols-6 gap-1.5">
              {HOUR_OPTIONS.map((h) => {
                const active = prefs.briefEnabled && prefs.briefHour === h;
                return (
                  <button
                    key={h}
                    type="submit"
                    name="hour"
                    value={h}
                    className={`rounded-lg border px-1 py-1.5 text-[11px] font-medium transition ${
                      active
                        ? "border-teal-600 bg-teal-600 text-white"
                        : "border-zinc-200 text-zinc-600 hover:border-zinc-400"
                    }`}
                  >
                    {hourLabel(h)}
                  </button>
                );
              })}
            </form>
            <p className="mt-3 text-xs text-zinc-500">
              {prefs.briefEnabled
                ? `Your brief is emailed automatically every day at ${hourLabel(prefs.briefHour)} (${prefs.timezone}).`
                : "The daily brief is off — pick an hour to turn it back on."}
            </p>
          </div>

          <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 10h8M8 14h5M21 12a9 9 0 1 0-3.5 7.1L21 20l-.9-3.4A8.96 8.96 0 0 0 21 12Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m22 2-11 11M22 2 15 22l-4-9-9-4 20-7Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="5" width="18" height="14" rx="3" />
                <circle cx="9" cy="12" r="1" fill="currentColor" />
                <circle cx="15" cy="12" r="1" fill="currentColor" />
              </svg>
            </div>
            <p className="mt-3 text-sm text-zinc-700">
              Get your brief in Slack, Telegram or Discord.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 w-full rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-400"
            >
              Coming soon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
