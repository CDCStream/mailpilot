import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db, emailAccounts, messages, users, CATEGORIES } from "@/lib/db";
import { gmailThreadUrl } from "@/lib/gmail";
import { CREDIT_COSTS } from "@/lib/plans";
import { getCreditBalance } from "@/lib/usage";
import { getActiveAccountId } from "./active-account";
import { AskWidget } from "./ask-widget";
import { BackfillBanner } from "./backfill-banner";
import { CATEGORY_BADGES, CATEGORY_DOTS, CATEGORY_NAMES, isBackfilling } from "./categories";
import { DraftTicker } from "./draft-ticker";
import { WelcomeModal } from "./welcome-modal";
import { CLASSIFIER_VERSION } from "@/lib/classifier-version";
import { readClassifierVersion } from "@/lib/schema-compat";
import {
  isNeedsYouCategory,
  NEEDS_YOU_WINDOW_LABEL,
  needsYouSince,
  sortNeedsYou,
} from "@/lib/needs-you";

export default async function OverviewPage() {
  const session = await auth();
  const userId = session!.user.id;

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      email: true,
      name: true,
      image: true,
      voiceProfile: true,
      preferences: true,
      bonusCredits: true,
      onboardedAt: true,
      createdAt: true,
    },
  });
  if (!user?.onboardedAt) redirect("/onboarding");
  const classifierVersion = await readClassifierVersion(userId);

  const allAccounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  // Scope everything to the account picked in the sidebar switcher (if any).
  const activeAccountId = await getActiveAccountId();
  const accounts = allAccounts.some((a) => a.id === activeAccountId)
    ? allAccounts.filter((a) => a.id === activeAccountId)
    : allAccounts;
  const accountIds = accounts.map((a) => a.id);
  const erroredAccount = accounts.find((a) => a.status === "error");

  // Group by when the email arrived (receivedAt), not when we imported it —
  // otherwise a backfill dumps every historical email onto today's bar.
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const recent = accountIds.length
    ? await db.query.messages.findMany({
        where: and(inArray(messages.accountId, accountIds), gte(messages.receivedAt, since)),
        orderBy: [desc(messages.receivedAt)],
        limit: 500,
      })
    : [];

  const triaged = recent.filter((m) => m.category);
  const emailByAccount = new Map(accounts.map((a) => [a.id, a.email]));

  const needsYou = sortNeedsYou(
    recent.filter(
      (m) =>
        isNeedsYouCategory(m.category) &&
        m.summary &&
        m.receivedAt &&
        m.receivedAt >= needsYouSince(),
    ),
  ).slice(0, 8);

  // Triage mix over everything Wingman has processed — matches the all-time
  // "Emails triaged" counter (onboarding also imports mail older than 7 days).
  const mixRows = accountIds.length
    ? await db
        .select({
          category: messages.category,
          n: sql<number>`count(*)`.mapWith(Number),
        })
        .from(messages)
        .where(and(inArray(messages.accountId, accountIds), isNotNull(messages.category)))
        .groupBy(messages.category)
    : [];
  const mixCounts = CATEGORIES.map((c) => ({
    category: c,
    count: mixRows.find((r) => r.category === c)?.n ?? 0,
  })).filter((x) => x.count > 0);
  const mixTotal = mixCounts.reduce((sum, x) => sum + x.count, 0);

  // Emails processed per day, oldest day first.
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return {
      key,
      label: d.toLocaleDateString("en-US", { weekday: "short" }),
      count: recent.filter((m) => m.receivedAt?.toISOString().slice(0, 10) === key).length,
    };
  });
  const maxDay = Math.max(1, ...days.map((d) => d.count));

  // All-time totals (Fyxer-style "emails processed" counters).
  const [totals = { processed: 0, drafts: 0, archived: 0 }] = accountIds.length
    ? await db
        .select({
          processed: sql<number>`count(*) filter (where ${messages.category} is not null)`.mapWith(Number),
          drafts: sql<number>`count(*) filter (where (${messages.actions}->>'draftCreated')::boolean)`.mapWith(Number),
          archived: sql<number>`count(*) filter (where (${messages.actions}->>'archived')::boolean)`.mapWith(Number),
        })
        .from(messages)
        .where(inArray(messages.accountId, accountIds))
    : [];

  const credits = await getCreditBalance(userId);
  const creditPct =
    credits.planLimit > 0
      ? Math.min(100, Math.round((credits.planUsed / credits.planLimit) * 100))
      : 0;

  const draftedThreads = new Set(recent.filter((m) => m.draftId).map((m) => m.threadId));
  const waitingDrafts = recent.some(
    (m) =>
      m.category === "to_respond" &&
      m.summary &&
      !m.draftId &&
      !draftedThreads.has(m.threadId) &&
      !m.actions?.draftSkipReason,
  );

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <DraftTicker pending={waitingDrafts} />
      <WelcomeModal />
      {classifierVersion !== CLASSIFIER_VERSION && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Triage rules were updated. Old labels stay frozen until you{" "}
          <Link href="/dashboard/settings" className="font-semibold underline">
            re-run triage on your history
          </Link>
          .
        </div>
      )}
      {isBackfilling(accounts) && (
        <div className="mb-6">
          <BackfillBanner />
        </div>
      )}
      <h1 className="text-2xl font-bold">Overview</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Connected as{" "}
        {accounts.length > 1
          ? accounts.map((a) => a.email).join(" · ")
          : (accounts[0]?.email ?? user.email)}
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
        {(
          [
            ["Emails triaged", totals.processed, `${triaged.length} in the last 7 days`],
            [
              "Drafts written for you",
              totals.drafts,
              `${recent.filter((m) => m.actions?.draftCreated).length} in the last 7 days${
                recent.filter((m) => m.actions?.draftSkipReason).length
                  ? ` · ${recent.filter((m) => m.actions?.draftSkipReason).length} skipped`
                  : ""
              }`,
            ],
            [
              "Noise archived",
              totals.archived,
              `${recent.filter((m) => m.actions?.archived).length} in the last 7 days`,
            ],
          ] as const
        ).map(([label, value, sub]) => (
          <div key={label} className="rounded-2xl border border-zinc-200 p-5">
            <p className="text-3xl font-bold">{value.toLocaleString("en-US")}</p>
            <p className="mt-1 text-sm text-zinc-500">{label}</p>
            <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-900">AI credits · {credits.planName}</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              {credits.planRemaining.toLocaleString("en-US")} plan +{" "}
              {credits.bonusCredits.toLocaleString("en-US")} top-up ·{" "}
              {credits.remaining.toLocaleString("en-US")} total left · triage free / draft{" "}
              {CREDIT_COSTS.draft} / brief {CREDIT_COSTS.brief}
            </p>
          </div>
          <Link
            href="/dashboard/billing"
            className="shrink-0 text-sm font-medium text-teal-700 hover:text-teal-800"
          >
            Billing →
          </Link>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className={`h-full rounded-full ${creditPct >= 90 ? "bg-rose-500" : "bg-teal-600"}`}
            style={{ width: `${creditPct}%` }}
          />
        </div>
      </div>

      <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* Left column */}
        <div className="min-w-0">
          <section>
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">Needs you</h2>
              <span className="text-xs text-zinc-400">{NEEDS_YOU_WINDOW_LABEL}</span>
            </div>
            {needsYou.length === 0 ? (
              <p className="mt-4 rounded-xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500">
                Nothing waiting on you right now — inbox zero on replies.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-zinc-100 rounded-2xl border border-zinc-200">
                {needsYou.map((m) => (
                  <li key={m.id}>
                    <a
                      href={gmailThreadUrl(
                        emailByAccount.get(m.accountId) ?? "",
                        m.threadId,
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-4 px-5 py-3 text-sm transition hover:bg-zinc-50"
                    >
                      <span className="w-40 shrink-0 truncate font-medium">
                        {(m.fromAddress ?? "").replace(/<[^>]*>/, "").trim() || m.fromAddress}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-zinc-700">
                          {m.subject || "(no subject)"}
                        </span>
                        {m.summary && (
                          <span className="block truncate text-xs text-zinc-400">
                            {m.summary}
                          </span>
                        )}
                      </span>
                      {m.draftId && (
                        <span className="hidden shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 md:inline">
                          draft ready
                        </span>
                      )}
                      <span className="shrink-0 text-xs text-zinc-400">
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

          <section className="mt-10">
            <h2 className="text-lg font-semibold">Recent activity · last 7 days</h2>
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
                    <span className="flex-1 truncate text-zinc-600">
                      {m.subject || "(no subject)"}
                    </span>
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
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <AskWidget />

          <div className="rounded-2xl border border-zinc-200 p-5">
            <p className="text-sm font-medium text-zinc-900">Triage mix · all time</p>
            {mixTotal === 0 ? (
              <p className="mt-3 text-xs text-zinc-400">No triaged mail yet.</p>
            ) : (
              <>
                <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-zinc-100">
                  {mixCounts.map((x) => (
                    <div
                      key={x.category}
                      className={CATEGORY_DOTS[x.category]}
                      style={{ width: `${(x.count / mixTotal) * 100}%` }}
                    />
                  ))}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {mixCounts.map((x) => (
                    <li
                      key={x.category}
                      className="flex items-center gap-2 text-xs text-zinc-600"
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_DOTS[x.category]}`}
                      />
                      <span className="flex-1">{CATEGORY_NAMES[x.category]}</span>
                      <span className="font-medium text-zinc-900">{x.count}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-200 p-5">
            <p className="text-sm font-medium text-zinc-900">Emails processed · last 7 days</p>
            <div className="mt-4 flex h-24 items-end gap-2">
              {days.map((d) => (
                <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="text-[10px] tabular-nums text-zinc-400">
                    {d.count > 0 ? d.count : ""}
                  </span>
                  <div
                    className={`w-full rounded-t-md ${d.count > 0 ? "bg-teal-500/80" : "bg-zinc-100"}`}
                    style={{ height: `${Math.max(4, (d.count / maxDay) * 72)}px` }}
                  />
                  <span className="text-[10px] text-zinc-400">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
