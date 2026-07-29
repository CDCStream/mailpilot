import { and, desc, eq, gte, inArray } from "drizzle-orm";
import {
  db,
  briefs,
  emailAccounts,
  messages,
  users,
  DEFAULT_PREFERENCES,
  type Category,
} from "@/lib/db";
import { buildBriefDigest, type BriefDigest } from "@/lib/ai";
import { gmailThreadUrl } from "@/lib/gmail";
import { sendEmail } from "@/lib/resend";
import { consumeCredits, getCreditBalance } from "@/lib/usage";

const CATEGORY_TITLES: Record<Category, string> = {
  to_respond: "To Respond",
  fyi: "FYI",
  newsletter: "Newsletters",
  marketing: "Marketing",
  notification: "Notifications",
  cold_email: "Cold Email",
};

const EMPTY_DIGEST: BriefDigest = {
  overview: "",
  newsletterHighlights: [],
  deadlines: [],
  logistics: [],
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function bulletList(items: string[]): string {
  return items
    .map((t) => `<li style="margin-bottom:8px;color:#333">${esc(t)}</li>`)
    .join("");
}

function briefLine(m: { fromAddress: string | null; subject: string | null; summary: string | null; snippet: string | null }): string {
  return `From ${m.fromAddress}: "${m.subject}" — ${m.summary ?? m.snippet ?? ""}`;
}

/** Compiles and emails the daily brief for one user. Returns false when there was nothing to send. */
export async function buildAndSendBrief(
  userId: string,
  opts?: { ignoreEnabled?: boolean },
): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return false;
  const prefs = user.preferences ?? DEFAULT_PREFERENCES;
  // Manual "generate now" still works when the daily schedule is switched off.
  if (!prefs.briefEnabled && !opts?.ignoreEnabled) return false;

  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  if (accounts.length === 0) return false;
  const accountIds = accounts.map((a) => a.id);
  const accountEmailById = new Map(accounts.map((a) => [a.id, a.email]));

  // By arrival time, not import time — a backfill shouldn't flood the brief.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db.query.messages.findMany({
    where: and(inArray(messages.accountId, accountIds), gte(messages.receivedAt, since)),
    orderBy: [desc(messages.receivedAt)],
    limit: 200,
  });

  const needsResponse = recent.filter((m) => m.category === "to_respond");
  if (recent.length === 0) return false;

  const counts = new Map<string, number>();
  for (const m of recent) {
    if (!m.category) continue;
    counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
  }

  // One AI call covers the overview, newsletter takeaways, deadlines and logistics.
  let digest = EMPTY_DIGEST;
  if (await consumeCredits(userId, "brief")) {
    const correspondence = recent
      .filter((m) => m.category === "to_respond" || m.category === "fyi")
      .slice(0, 25)
      .map(briefLine);
    const newsletters = recent
      .filter((m) => m.category === "newsletter" || m.category === "marketing")
      .slice(0, 25)
      .map(briefLine);
    const notifications = recent
      .filter((m) => m.category === "notification")
      .slice(0, 25)
      .map(briefLine);
    digest = await buildBriefDigest({
      correspondence,
      newsletters,
      notifications,
      summaryLanguage: prefs.summaryLanguage,
    });
  }

  const respondRows = needsResponse
    .slice(0, 15)
    .map((m) => {
      const email = accountEmailById.get(m.accountId) ?? "";
      const url = gmailThreadUrl(email, m.threadId);
      return `<li style="margin-bottom:10px"><strong>${esc(m.fromAddress ?? "")}</strong> — <a href="${url}" style="color:#111;text-decoration:underline">${esc(m.subject ?? "(no subject)")}</a><br/><span style="color:#666">${esc(m.summary ?? m.snippet ?? "")}</span>${m.draftId ? ` · <a href="${url}" style="color:#0a7d32;text-decoration:underline">draft ready</a>` : ""}</li>`;
    })
    .join("");

  const countRows = Object.entries(CATEGORY_TITLES)
    .map(([cat, title]) => {
      const n = counts.get(cat) ?? 0;
      return n > 0
        ? `<tr><td style="padding:4px 12px 4px 0;color:#666">${title}</td><td style="padding:4px 0;font-weight:600">${n}</td></tr>`
        : "";
    })
    .join("");

  const credits = await getCreditBalance(userId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
    <h2 style="margin:0 0 4px">Your morning brief</h2>
    <p style="color:#666;margin:0 0 8px">${new Date().toDateString()}</p>
    <p style="color:#0f766e;font-size:13px;margin:0 0 20px">${credits.remaining.toLocaleString("en-US")} AI credits left (${credits.planRemaining.toLocaleString("en-US")} plan + ${credits.bonusCredits.toLocaleString("en-US")} top-up · ${credits.planName})</p>
    ${digest.overview ? `<div style="background:#f5f7fa;border-radius:8px;padding:16px;margin-bottom:24px;white-space:pre-line">${esc(digest.overview)}</div>` : ""}
    ${digest.deadlines.length ? `<h3 style="margin:0 0 8px">⏰ Deadlines &amp; action items</h3><ul style="padding-left:18px;margin:0 0 24px">${bulletList(digest.deadlines)}</ul>` : ""}
    ${respondRows ? `<h3 style="margin:0 0 8px">Needs your response (${needsResponse.length})</h3><ul style="padding-left:18px;margin:0 0 24px">${respondRows}</ul>` : ""}
    ${digest.newsletterHighlights.length ? `<h3 style="margin:0 0 8px">📰 From your newsletters</h3><p style="color:#999;font-size:12px;margin:0 0 8px">Key takeaways so you can skip the reading — the originals are under their Wingman labels in Gmail.</p><ul style="padding-left:18px;margin:0 0 24px">${bulletList(digest.newsletterHighlights)}</ul>` : ""}
    ${digest.logistics.length ? `<h3 style="margin:0 0 8px">📦 Bills, orders &amp; deliveries</h3><ul style="padding-left:18px;margin:0 0 24px">${bulletList(digest.logistics)}</ul>` : ""}
    ${countRows ? `<h3 style="margin:0 0 8px">Last 24 hours</h3><table style="border-collapse:collapse;margin-bottom:24px">${countRows}</table>` : ""}
    <p style="color:#999;font-size:13px">Sent by <a href="${appUrl}" style="color:#0f766e">Inbox Wingman</a> · <a href="${appUrl}/dashboard/billing" style="color:#999">credits</a> · <a href="${appUrl}/dashboard/settings" style="color:#999">brief settings</a></p>
  </div>`;

  const subjectParts = [`${needsResponse.length} to respond`];
  if (digest.deadlines.length > 0) subjectParts.push(`${digest.deadlines.length} deadlines`);

  const subject = `Your inbox brief — ${subjectParts.join(", ")}`;
  await sendEmail({ to: user.email, subject, html });
  // Keep a copy so the user can re-read briefs in the dashboard.
  await db.insert(briefs).values({ userId, subject, html });
  return true;
}
