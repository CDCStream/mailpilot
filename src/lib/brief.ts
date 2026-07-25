import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import {
  db,
  emailAccounts,
  followups,
  messages,
  users,
  DEFAULT_PREFERENCES,
  type Category,
} from "@/lib/db";
import { summarizeForBrief } from "@/lib/ai";
import { sendEmail } from "@/lib/resend";

const CATEGORY_TITLES: Record<Category, string> = {
  to_respond: "To Respond",
  fyi: "FYI",
  newsletter: "Newsletters",
  marketing: "Marketing",
  notification: "Notifications",
  cold_email: "Cold Email",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Compiles and emails the daily brief for one user. Returns false when there was nothing to send. */
export async function buildAndSendBrief(userId: string): Promise<boolean> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return false;
  const prefs = user.preferences ?? DEFAULT_PREFERENCES;
  if (!prefs.briefEnabled) return false;

  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  if (accounts.length === 0) return false;
  const accountIds = accounts.map((a) => a.id);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db.query.messages.findMany({
    where: and(inArray(messages.accountId, accountIds), gte(messages.createdAt, since)),
    orderBy: [desc(messages.receivedAt)],
    limit: 200,
  });

  // Promote overdue follow-ups to "due" and collect them.
  await db
    .update(followups)
    .set({ status: "due" })
    .where(
      and(
        inArray(followups.accountId, accountIds),
        eq(followups.status, "waiting"),
        lte(followups.dueAt, new Date()),
      ),
    );
  const dueFollowups = await db.query.followups.findMany({
    where: and(inArray(followups.accountId, accountIds), eq(followups.status, "due")),
    orderBy: [desc(followups.dueAt)],
    limit: 20,
  });

  const needsResponse = recent.filter((m) => m.category === "to_respond");
  if (recent.length === 0 && dueFollowups.length === 0) return false;

  const counts = new Map<string, number>();
  for (const m of recent) {
    if (!m.category) continue;
    counts.set(m.category, (counts.get(m.category) ?? 0) + 1);
  }

  const aiSummary = await summarizeForBrief(
    needsResponse
      .slice(0, 15)
      .map((m) => `From ${m.fromAddress}: "${m.subject}" — ${m.summary ?? m.snippet}`),
  );

  const countRows = Object.entries(CATEGORY_TITLES)
    .map(([cat, title]) => {
      const n = counts.get(cat) ?? 0;
      return n > 0
        ? `<tr><td style="padding:4px 12px 4px 0;color:#666">${title}</td><td style="padding:4px 0;font-weight:600">${n}</td></tr>`
        : "";
    })
    .join("");

  const respondRows = needsResponse
    .slice(0, 15)
    .map(
      (m) =>
        `<li style="margin-bottom:10px"><strong>${esc(m.fromAddress ?? "")}</strong> — ${esc(m.subject ?? "(no subject)")}<br/><span style="color:#666">${esc(m.summary ?? m.snippet ?? "")}</span>${m.draftId ? ' <span style="color:#0a7d32">· draft ready</span>' : ""}</li>`,
    )
    .join("");

  const followupRows = dueFollowups
    .map(
      (f) =>
        `<li style="margin-bottom:8px"><strong>${esc(f.toRecipients ?? "")}</strong> — ${esc(f.subject ?? "(no subject)")}<br/><span style="color:#666">sent ${f.sentAt.toDateString()}, no reply yet</span></li>`,
    )
    .join("");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const html = `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
    <h2 style="margin:0 0 4px">Your morning brief</h2>
    <p style="color:#666;margin:0 0 20px">${new Date().toDateString()}</p>
    ${aiSummary ? `<div style="background:#f5f7fa;border-radius:8px;padding:16px;margin-bottom:24px;white-space:pre-line">${esc(aiSummary)}</div>` : ""}
    ${respondRows ? `<h3 style="margin:0 0 8px">Needs your response (${needsResponse.length})</h3><ul style="padding-left:18px;margin:0 0 24px">${respondRows}</ul>` : ""}
    ${followupRows ? `<h3 style="margin:0 0 8px">Waiting on a reply — time to nudge (${dueFollowups.length})</h3><ul style="padding-left:18px;margin:0 0 24px">${followupRows}</ul>` : ""}
    ${countRows ? `<h3 style="margin:0 0 8px">Last 24 hours</h3><table style="border-collapse:collapse;margin-bottom:24px">${countRows}</table>` : ""}
    <p style="color:#999;font-size:13px">Sent by <a href="${appUrl}" style="color:#4f46e5">Inbox Wingman</a> · <a href="${appUrl}/dashboard/settings" style="color:#999">brief settings</a></p>
  </div>`;

  await sendEmail({
    to: user.email,
    subject: `Your inbox brief — ${needsResponse.length} to respond, ${dueFollowups.length} follow-ups`,
    html,
  });
  return true;
}
