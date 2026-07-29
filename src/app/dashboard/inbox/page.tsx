import Link from "next/link";
import type { ReactNode } from "react";
import { and, count, desc, eq, ilike, inArray, isNotNull, or, sql, type SQL } from "drizzle-orm";
import { auth } from "@/auth";
import { db, emailAccounts, messages, users, CATEGORIES, type Category } from "@/lib/db";
import { classifyEmail } from "@/lib/ai";
import {
  getDraftText,
  getGmailClient,
  getMessageHtml,
  getMessageMeta,
  gmailThreadUrl,
  searchMessageIds,
} from "@/lib/gmail";
import { consumeCredits } from "@/lib/usage";
import { getActiveAccountId } from "../active-account";
import { writeDraftForMessage } from "../actions";
import {
  CATEGORY_BADGES,
  CATEGORY_DOTS,
  CATEGORY_NAMES,
  displayFrom,
  isBackfilling,
  senderDomain,
} from "../categories";
import { BackfillBanner } from "../backfill-banner";
import { SenderAvatar } from "../sender-avatar";
import { SubmitButton } from "../submit-button";
import { ImportOlderButton } from "./import-button";

const PAGE_SIZE = 80;
const MAX_LIMIT = 1000;

type Filters = {
  category?: string | null;
  flag?: string | null;
  limit?: number | null;
  from?: string | null;
  q?: string | null;
};

function inboxHref(filters: Filters, selected?: string): string {
  const qs = new URLSearchParams();
  if (filters.category) qs.set("category", filters.category);
  if (filters.flag) qs.set("flag", filters.flag);
  if (filters.from) qs.set("from", filters.from);
  if (filters.q) qs.set("q", filters.q);
  if (filters.limit && filters.limit > PAGE_SIZE) qs.set("limit", String(filters.limit));
  if (selected) qs.set("m", selected);
  const s = qs.toString();
  return s ? `/dashboard/inbox?${s}` : "/dashboard/inbox";
}

function initialOf(from: string): string {
  const c = from.trim().charAt(0).toUpperCase();
  return /[A-Z0-9ĞÜŞİÖÇ]/.test(c) ? c : "@";
}

/** Paints occurrences of the search term yellow, like every mail client does. */
function highlight(text: string, term: string): ReactNode {
  if (!term) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.split(new RegExp(`(${escaped})`, "gi")).map((part, i) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <mark key={i} className="rounded-sm bg-yellow-200 px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

/** Turns bare URLs in plain-text email bodies into clickable links. */
function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s)\]>"']+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={i}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="break-all text-teal-700 underline underline-offset-2 hover:text-teal-900"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const sp = await searchParams;

  const category =
    typeof sp.category === "string" && (CATEGORIES as readonly string[]).includes(sp.category)
      ? (sp.category as Category)
      : null;
  const flag = sp.flag === "drafted" || sp.flag === "archived" ? sp.flag : null;
  const selectedId = typeof sp.m === "string" ? sp.m : null;
  const fromFilter = typeof sp.from === "string" ? sp.from.trim().slice(0, 100) : "";
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(PAGE_SIZE, Number.parseInt(String(sp.limit ?? ""), 10) || PAGE_SIZE),
  );
  const filters: Filters = {
    category,
    flag,
    limit,
    from: fromFilter || null,
    q: q || null,
  };

  const allAccounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  // The sidebar switcher scopes the inbox to one Gmail account (cookie-based).
  const activeAccountId = await getActiveAccountId();
  const accounts = allAccounts.some((a) => a.id === activeAccountId)
    ? allAccounts.filter((a) => a.id === activeAccountId)
    : allAccounts;
  const allAccountIds = allAccounts.map((a) => a.id);
  const accountIds = accounts.map((a) => a.id);
  const emailByAccount = new Map(allAccounts.map((a) => [a.id, a.email]));

  // Full-body search runs through Gmail's own search engine; the local
  // subject/snippet/summary match keeps things working if Gmail is unreachable.
  let gmailMatchIds: string[] = [];
  if (q) {
    const searchable = accounts.filter((a) => a.status === "active");
    const perAccount = await Promise.all(
      searchable.map(async (a) => {
        try {
          return await searchMessageIds(getGmailClient(a.refreshTokenEnc), q, 500);
        } catch {
          return [] as string[];
        }
      }),
    );
    gmailMatchIds = perAccount.flat();
  }

  const like = (term: string) => `%${term.replace(/[%_\\]/g, "\\$&")}%`;
  const conditions: SQL[] = [];
  if (category) conditions.push(eq(messages.category, category));
  if (flag === "drafted") conditions.push(isNotNull(messages.draftId));
  if (flag === "archived") {
    conditions.push(sql`(${messages.actions}->>'archived')::boolean`);
  }
  if (fromFilter) conditions.push(ilike(messages.fromAddress, like(fromFilter)));
  if (q) {
    const textMatch = or(
      ilike(messages.subject, like(q)),
      ilike(messages.snippet, like(q)),
      ilike(messages.summary, like(q)),
    )!;
    conditions.push(
      gmailMatchIds.length
        ? or(textMatch, inArray(messages.gmailMessageId, gmailMatchIds))!
        : textMatch,
    );
  }

  const rows = accountIds.length
    ? await db.query.messages.findMany({
        where: and(inArray(messages.accountId, accountIds), ...conditions),
        orderBy: [desc(messages.receivedAt)],
        limit,
      })
    : [];
  const visible = rows;

  // Real total for the current filter — the list itself is paginated.
  const [{ n: totalCount } = { n: 0 }] = accountIds.length
    ? await db
        .select({ n: count() })
        .from(messages)
        .where(and(inArray(messages.accountId, accountIds), ...conditions))
    : [];

  // Selected email — also findable when it's outside the current filter.
  const selected = selectedId
    ? (visible.find((m) => m.id === selectedId) ??
      (allAccountIds.length
        ? await db.query.messages.findFirst({
            where: and(eq(messages.id, selectedId), inArray(messages.accountId, allAccountIds)),
          })
        : undefined))
    : undefined;

  // Pull the body live from Gmail for the reading pane (best effort) — HTML for
  // faithful rendering, text as fallback — and auto-generate the AI summary if
  // this email doesn't have one yet.
  let selectedBody: string | null = null;
  let selectedHtml: string | null = null;
  let selectedDraftText: string | null = null;
  let selectedSummary: string | null = selected?.summary ?? null;
  if (selected) {
    const account = accounts.find((a) => a.id === selected.accountId);
    if (account && account.status === "active") {
      try {
        const gmail = getGmailClient(account.refreshTokenEnc);
        const meta = await getMessageMeta(gmail, selected.gmailMessageId, account.email);
        selectedBody = meta?.bodyExcerpt || null;
        selectedHtml = await getMessageHtml(gmail, selected.gmailMessageId);
        if (selected.draftId) {
          selectedDraftText = await getDraftText(gmail, selected.draftId);
        }

        if (!selectedSummary && meta && (await consumeCredits(userId, "triage"))) {
          const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
          const classification = await classifyEmail({
            from: meta.from,
            to: meta.to,
            subject: meta.subject,
            bodyExcerpt: meta.bodyExcerpt,
            summaryLanguage: user?.preferences?.summaryLanguage,
          });
          selectedSummary = classification.summary;
          // Only the summary — category stays with the triage pipeline.
          await db
            .update(messages)
            .set({ summary: classification.summary })
            .where(eq(messages.id, selected.id));
        }
      } catch {
        selectedBody = null;
      }
    }
  }

  const chip = (active: boolean) =>
    `shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-medium transition ${
      active
        ? "border-teal-600 bg-teal-600 text-white"
        : "border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-800"
    }`;

  const selectedFrom = selected ? displayFrom(selected.fromAddress) : "";
  const selectedGmailUrl = selected
    ? gmailThreadUrl(emailByAccount.get(selected.accountId) ?? "", selected.threadId)
    : "";

  // Render the email's real HTML in a sandboxed iframe (scripts blocked,
  // links open in a new tab), like a proper mail client.
  const BASE_TAG = '<base target="_blank">';
  let selectedSrcDoc: string | null = null;
  if (selectedHtml) {
    if (/<head[\s>]/i.test(selectedHtml)) {
      selectedSrcDoc = selectedHtml.replace(/<head([^>]*)>/i, `<head$1>${BASE_TAG}`);
    } else if (/<html[\s>]/i.test(selectedHtml)) {
      selectedSrcDoc = selectedHtml.replace(/<html([^>]*)>/i, `<html$1><head>${BASE_TAG}</head>`);
    } else {
      selectedSrcDoc = `<!doctype html><html><head><meta charset="utf-8">${BASE_TAG}<style>body{margin:16px;font:14px/1.6 -apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#27272a;word-break:break-word}img{max-width:100%;height:auto}</style></head><body>${selectedHtml}</body></html>`;
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white lg:h-dvh lg:flex-row lg:overflow-hidden">
      {/* ---- List column ---- */}
      <div
        className={`w-full flex-col border-zinc-100 lg:flex lg:w-[400px] lg:shrink-0 lg:border-r ${
          selected ? "hidden" : "flex"
        }`}
      >
        <div className="border-b border-zinc-100 px-5 pb-3 pt-6">
          {isBackfilling(accounts) && (
            <div className="mb-3">
              <BackfillBanner />
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <h1 className="text-xl font-bold tracking-tight">Inbox</h1>
            <span className="text-xs tabular-nums text-zinc-400">
              {totalCount} email{totalCount === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            <Link
              href={inboxHref({ ...filters, category: null, flag: null })}
              className={chip(!category && !flag)}
            >
              All
            </Link>
            {CATEGORIES.map((c) => (
              <Link
                key={c}
                href={inboxHref({ ...filters, category: c, flag: null })}
                className={chip(category === c)}
              >
                {CATEGORY_NAMES[c]}
              </Link>
            ))}
            <Link
              href={inboxHref({ ...filters, category: null, flag: "drafted" })}
              className={chip(flag === "drafted")}
            >
              Has draft
            </Link>
            <Link
              href={inboxHref({ ...filters, category: null, flag: "archived" })}
              className={chip(flag === "archived")}
            >
              Archived
            </Link>
          </div>

          <form method="GET" action="/dashboard/inbox" className="mt-3 flex items-center gap-1.5">
            {category && <input type="hidden" name="category" value={category} />}
            {flag && <input type="hidden" name="flag" value={flag} />}
            <input
              type="text"
              name="from"
              defaultValue={fromFilter}
              placeholder="From…"
              className="w-0 min-w-0 flex-1 rounded-full border border-zinc-200 px-3 py-1.5 text-xs outline-none placeholder:text-zinc-400 focus:border-teal-500"
            />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Search full email text…"
              className="w-0 min-w-0 flex-[1.4] rounded-full border border-zinc-200 px-3 py-1.5 text-xs outline-none placeholder:text-zinc-400 focus:border-teal-500"
            />
            <button
              type="submit"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-700"
              aria-label="Search"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
            </button>
            {(fromFilter || q) && (
              <Link
                href={inboxHref({ category, flag })}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 hover:border-zinc-400 hover:text-zinc-900"
                aria-label="Clear search"
              >
                ×
              </Link>
            )}
          </form>

          <div className="mt-3 flex items-center justify-between gap-3">
            <ImportOlderButton />
            <span className="shrink-0 text-[10px] text-zinc-400">max 300 · 1 credit each</span>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 text-zinc-300">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="mt-4 text-sm font-medium text-zinc-700">Nothing here yet</p>
            <p className="mt-1 text-xs text-zinc-400">
              New emails show up within a couple of minutes of arriving.
            </p>
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-zinc-50 overflow-y-auto">
            {visible.map((m) => {
              const isSelected = m.id === selectedId;
              const from = displayFrom(m.fromAddress);
              return (
                <li key={m.id}>
                  <Link
                    href={inboxHref(filters, m.id)}
                    scroll={false}
                    className={`flex gap-3 border-l-[3px] px-4 py-3 transition ${
                      isSelected
                        ? "border-teal-600 bg-teal-50/60"
                        : "border-transparent hover:bg-zinc-50"
                    }`}
                  >
                    <span className="mt-0.5">
                      <SenderAvatar
                        domain={senderDomain(m.fromAddress)}
                        initial={initialOf(from)}
                        colorClass={m.category ? CATEGORY_DOTS[m.category] : "bg-zinc-300"}
                      />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-zinc-900">
                          {highlight(from, fromFilter)}
                        </span>
                        <span className="shrink-0 text-[11px] text-zinc-400">
                          {m.receivedAt?.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          }) ?? ""}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] text-zinc-600">
                        {highlight(m.subject || "(no subject)", q)}
                      </span>
                      {q && m.snippet && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500">
                          {highlight(m.snippet, q)}
                        </span>
                      )}
                      <span className="mt-1.5 flex items-center gap-1.5">
                        {m.category ? (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CATEGORY_BADGES[m.category]}`}
                          >
                            {CATEGORY_NAMES[m.category]}
                          </span>
                        ) : (
                          <span className="rounded-md bg-zinc-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                            processing
                          </span>
                        )}
                        {m.actions?.draftCreated && (
                          <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                            draft
                          </span>
                        )}
                        {m.actions?.archived && (
                          <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                            archived
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {totalCount > limit && limit < MAX_LIMIT && (
              <li>
                <Link
                  href={inboxHref({ ...filters, limit: limit + PAGE_SIZE }, selectedId ?? undefined)}
                  scroll={false}
                  className="block px-4 py-3 text-center text-xs font-medium text-teal-700 hover:bg-teal-50/60"
                >
                  Show {Math.min(PAGE_SIZE, totalCount - limit)} more
                </Link>
              </li>
            )}
          </ul>
        )}
      </div>

      {/* ---- Reading pane ---- */}
      <div
        className={`min-w-0 flex-1 flex-col bg-zinc-50/50 ${selected ? "flex" : "hidden lg:flex"}`}
      >
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-teal-600 shadow-sm ring-1 ring-zinc-100">
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="mt-5 text-base font-semibold text-zinc-900">Pick an email</p>
            <p className="mt-1 max-w-xs text-sm text-zinc-500">
              You&apos;ll get the AI summary, the message itself, and a one-click reply draft.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-zinc-100 bg-white px-6 pb-4 pt-5 lg:px-10">
              <Link
                href={inboxHref(filters)}
                className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 lg:hidden"
              >
                ← Back to list
              </Link>
              <div className="flex items-start justify-between gap-4">
                <h2 className="min-w-0 truncate text-xl font-bold tracking-tight text-zinc-900">
                  {selected.subject || "(no subject)"}
                </h2>
                {selected.category && (
                  <span
                    className={`mt-1 shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_BADGES[selected.category]}`}
                  >
                    {CATEGORY_NAMES[selected.category]}
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-3">
                <SenderAvatar
                  domain={senderDomain(selected.fromAddress)}
                  initial={initialOf(selectedFrom)}
                  colorClass={selected.category ? CATEGORY_DOTS[selected.category] : "bg-zinc-300"}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900">{selectedFrom}</p>
                  <p className="truncate text-xs text-zinc-400">{selected.fromAddress}</p>
                </div>
                <span className="ml-auto shrink-0 text-xs text-zinc-400">
                  {selected.receivedAt?.toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  }) ?? ""}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 lg:px-10">
              {selectedSummary && (
                <div className="rounded-2xl border border-sky-200 bg-sky-50/70 px-5 py-4">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-sky-700">
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5-2 2m-7 7-2 2m11 0-2-2m-7-7-2-2" strokeLinecap="round" />
                    </svg>
                    AI summary
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-sky-950">
                    {selectedSummary}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selected.actions?.archived && (
                      <span className="rounded-full bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                        ✓ Archived for you
                      </span>
                    )}
                    {selected.actions?.ruleApplied && (
                      <span className="rounded-full border border-sky-300 bg-white px-2.5 py-1 text-[11px] font-medium text-sky-800">
                        Rule: {selected.actions.ruleApplied}
                      </span>
                    )}
                    {selected.draftId && (
                      <span className="rounded-full border border-sky-300 bg-white px-2.5 py-1 text-[11px] font-medium text-sky-800">
                        Reply draft waiting in Gmail
                      </span>
                    )}
                  </div>
                </div>
              )}

              {selectedSrcDoc ? (
                <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <iframe
                    srcDoc={selectedSrcDoc}
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    title="Email content"
                    className="h-[62vh] w-full"
                  />
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-zinc-100 bg-white px-6 py-5 shadow-sm">
                  <p className="whitespace-pre-line text-[15px] leading-relaxed text-zinc-800">
                    {linkify(selectedBody ?? selected.snippet ?? "(no preview available)")}
                  </p>
                </div>
              )}

              {selectedDraftText && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/60 px-6 py-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-700">
                      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="5" y="8" width="14" height="10" rx="2" />
                        <path d="M12 8V5m0 0h.01M9 13h.01M15 13h.01M9.5 16h5" strokeLinecap="round" />
                      </svg>
                      Your AI reply draft
                    </p>
                    <a
                      href={selectedGmailUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-xs font-semibold text-emerald-700 underline-offset-2 hover:underline"
                    >
                      Edit &amp; send in Gmail →
                    </a>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-emerald-950">
                    {selectedDraftText}
                  </p>
                </div>
              )}
            </div>

            {/* Action bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 bg-white px-6 py-4 lg:px-10">
              <a
                href={selectedGmailUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Open in Gmail
              </a>
              {selected.draftId ? (
                <a
                  href={selectedGmailUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Draft ready — open in Gmail
                </a>
              ) : (
                <form action={writeDraftForMessage}>
                  <input type="hidden" name="messageId" value={selected.id} />
                  <SubmitButton
                    pendingLabel="Writing your draft…"
                    className="inline-flex items-center gap-2 rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-teal-700"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m14.5-6.5-2 2m-7 7-2 2m11 0-2-2m-7-7-2-2" strokeLinecap="round" />
                    </svg>
                    Draft a reply with AI
                  </SubmitButton>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
