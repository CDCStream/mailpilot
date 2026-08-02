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
import { consumeCredits } from "@/lib/usage";

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
    .map(
      (t) =>
        `<li style="margin-bottom:10px;color:#3f3f46;font-size:14px;line-height:1.6">${esc(t)}</li>`,
    )
    .join("");
}

/** One rounded section card with an emoji badge and colored accent (email-safe markup). */
function sectionCard(opts: {
  emoji: string;
  title: string;
  accent: string; // badge background
  accentText: string; // badge/title color
  subtitle?: string;
  body: string;
}): string {
  return `
  <tr><td style="padding:0 24px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #e4e4e7;border-radius:14px">
      <tr><td style="padding:18px 22px 6px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="width:30px;height:30px;background:${opts.accent};border-radius:8px;text-align:center;font-size:15px;line-height:30px">${opts.emoji}</td>
          <td style="padding-left:10px;font-size:15px;font-weight:700;color:${opts.accentText}">${opts.title}</td>
        </tr></table>
        ${opts.subtitle ? `<p style="margin:10px 0 0;color:#a1a1aa;font-size:12px;line-height:1.5">${opts.subtitle}</p>` : ""}
      </td></tr>
      <tr><td style="padding:10px 22px 18px">${opts.body}</td></tr>
    </table>
  </td></tr>`;
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
    .map((m, i) => {
      const email = accountEmailById.get(m.accountId) ?? "";
      const url = gmailThreadUrl(email, m.threadId);
      return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${i > 0 ? "border-top:1px solid #f4f4f5;" : ""}">
        <tr><td style="padding:12px 0">
          <p style="margin:0;font-size:14px;color:#18181b"><strong>${esc(m.fromAddress ?? "")}</strong></p>
          <p style="margin:4px 0 0"><a href="${url}" style="color:#0f766e;font-size:14px;font-weight:600;text-decoration:none">${esc(m.subject ?? "(no subject)")}</a></p>
          ${m.summary || m.snippet ? `<p style="margin:4px 0 0;color:#71717a;font-size:13px;line-height:1.5">${esc(m.summary ?? m.snippet ?? "")}</p>` : ""}
          <p style="margin:8px 0 0">
            ${m.draftId ? `<a href="${url}" style="display:inline-block;background:#ecfdf5;color:#047857;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;text-decoration:none;margin-right:6px">✓ Draft ready</a>` : ""}
            <a href="${url}" style="display:inline-block;background:#f4f4f5;color:#3f3f46;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;text-decoration:none">Open in Gmail →</a>
          </p>
        </td></tr>
      </table>`;
    })
    .join("");

  const countChips = Object.entries(CATEGORY_TITLES)
    .map(([cat, title]) => {
      const n = counts.get(cat) ?? 0;
      return n > 0
        ? `<span style="display:inline-block;background:#f4f4f5;border-radius:999px;padding:6px 14px;font-size:12px;color:#52525b;margin:0 6px 6px 0;white-space:nowrap">${title}&nbsp;&nbsp;<strong style="color:#18181b;font-size:13px">${n}</strong></span>`
        : "";
    })
    .join("");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const dateLabel = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const html = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;font-family:-apple-system,'Segoe UI',Roboto,sans-serif">
    <tr><td align="center" style="padding:32px 12px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">

        <!-- Header -->
        <tr><td style="background:#0f766e;border-radius:16px 16px 0 0;padding:26px 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td>
              <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                <td><img src="${appUrl}/logo-96.png" width="34" height="34" alt="" style="display:block;border-radius:8px" /></td>
                <td style="padding-left:10px;color:#ffffff;font-size:15px;font-weight:700">Inbox Wingman</td>
              </tr></table>
              <p style="margin:18px 0 2px;color:#99f6e4;font-size:12px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase">${dateLabel}</p>
              <p style="margin:0;color:#ffffff;font-size:24px;font-weight:800">Your morning brief</p>
            </td>
          </tr></table>
        </td></tr>

        <tr><td style="height:20px;background:#f4f5f7"></td></tr>

        ${
          digest.overview
            ? sectionCard({
                emoji: "☕",
                title: "The gist",
                accent: "#f0fdfa",
                accentText: "#0f766e",
                body: `<p style="margin:0;color:#3f3f46;font-size:14px;line-height:1.7;white-space:pre-line">${esc(digest.overview)}</p>`,
              })
            : ""
        }
        ${
          digest.deadlines.length
            ? sectionCard({
                emoji: "⏰",
                title: "Deadlines & action items",
                accent: "#fffbeb",
                accentText: "#b45309",
                body: `<ul style="padding-left:18px;margin:0">${bulletList(digest.deadlines)}</ul>`,
              })
            : ""
        }
        ${
          respondRows
            ? sectionCard({
                emoji: "✉️",
                title: `Needs your response (${needsResponse.length})`,
                accent: "#fff1f2",
                accentText: "#be123c",
                body: respondRows,
              })
            : ""
        }
        ${
          digest.newsletterHighlights.length
            ? sectionCard({
                emoji: "📰",
                title: "From your newsletters",
                accent: "#eff6ff",
                accentText: "#1d4ed8",
                subtitle:
                  "Key takeaways so you can skip the reading — the originals are under their Wingman labels in Gmail.",
                body: `<ul style="padding-left:18px;margin:0">${bulletList(digest.newsletterHighlights)}</ul>`,
              })
            : ""
        }
        ${
          digest.logistics.length
            ? sectionCard({
                emoji: "📦",
                title: "Bills, orders & deliveries",
                accent: "#f5f3ff",
                accentText: "#6d28d9",
                body: `<ul style="padding-left:18px;margin:0">${bulletList(digest.logistics)}</ul>`,
              })
            : ""
        }
        ${
          countChips
            ? sectionCard({
                emoji: "📊",
                title: "Last 24 hours",
                accent: "#f0fdfa",
                accentText: "#0f766e",
                body: countChips,
              })
            : ""
        }

        <!-- Footer -->
        <tr><td align="center" style="padding:8px 24px 4px">
          <a href="${appUrl}/dashboard" style="display:inline-block;background:#0f766e;color:#ffffff;font-size:14px;font-weight:700;padding:11px 28px;border-radius:999px;text-decoration:none">Open your dashboard</a>
        </td></tr>
        <tr><td align="center" style="padding:16px 24px 8px">
          <p style="margin:0;color:#a1a1aa;font-size:12px">
            Sent by <a href="${appUrl}" style="color:#0f766e;text-decoration:none;font-weight:600">Inbox Wingman</a>
            &nbsp;·&nbsp; <a href="${appUrl}/dashboard/billing" style="color:#a1a1aa">credits</a>
            &nbsp;·&nbsp; <a href="${appUrl}/dashboard/briefs" style="color:#a1a1aa">brief settings</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>`;

  const subjectParts = [`${needsResponse.length} to respond`];
  if (digest.deadlines.length > 0) subjectParts.push(`${digest.deadlines.length} deadlines`);

  const subject = `Your inbox brief — ${subjectParts.join(", ")}`;
  // Save first — the dashboard copy must survive even if email delivery fails
  // (e.g. Resend key missing or the provider is down).
  await db.insert(briefs).values({ userId, subject, html });
  try {
    await sendEmail({ to: user.email, subject, html });
  } catch (e) {
    console.error("brief saved but email delivery failed", e);
  }
  return true;
}
