import { google, gmail_v1 } from "googleapis";
import { decryptSecret } from "@/lib/crypto";
import type { Category } from "@/lib/db/schema";

export const CATEGORY_LABELS: Record<Category, string> = {
  to_respond: "Wingman/To Respond",
  fyi: "Wingman/FYI",
  newsletter: "Wingman/Newsletter",
  marketing: "Wingman/Marketing",
  notification: "Wingman/Notification",
  cold_email: "Wingman/Cold Email",
  money: "Wingman/Money",
  security: "Wingman/Security",
};

export function getGmailClient(encryptedRefreshToken: string): gmail_v1.Gmail {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2.setCredentials({ refresh_token: decryptSecret(encryptedRefreshToken) });
  return google.gmail({ version: "v1", auth: oauth2 });
}

/** Creates the Wingman label set if missing; returns category -> labelId map. */
export async function ensureLabels(gmail: gmail_v1.Gmail): Promise<Record<string, string>> {
  const { data } = await gmail.users.labels.list({ userId: "me" });
  const existing = new Map((data.labels ?? []).map((l) => [l.name, l.id]));
  const map: Record<string, string> = {};

  for (const [category, name] of Object.entries(CATEGORY_LABELS)) {
    const found = existing.get(name);
    if (found) {
      map[category] = found;
      continue;
    }
    const { data: created } = await gmail.users.labels.create({
      userId: "me",
      requestBody: {
        name,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
      },
    });
    map[category] = created.id!;
  }
  return map;
}

export type GmailMessageMeta = {
  id: string;
  threadId: string;
  from: string;
  fromEmail: string;
  to: string;
  subject: string;
  snippet: string;
  bodyExcerpt: string;
  date: Date;
  messageIdHeader: string;
  references: string;
  /** Present on bulk / marketing / most automated mail — never draft these. */
  listUnsubscribe: string;
  listId: string;
  autoSubmitted: string;
  precedence: string;
  labelIds: string[];
  isFromMe: boolean;
};

function header(payload: gmail_v1.Schema$MessagePart | undefined, name: string): string {
  return (
    payload?.headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? ""
  );
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractText(part: gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts?.length) {
    // Prefer a text/plain part anywhere in the tree, fall back to stripped HTML.
    for (const p of part.parts) {
      const text = extractText(p);
      if (text) return text;
    }
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeHtmlEntities(
      decodeBase64Url(part.body.data)
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    )
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

/**
 * Reply-quote headers, which Gmail localizes and often wraps across two lines,
 * e.g. "On Mon, Jun 1 ... wrote:" or "Göksel K. <g@x>, 1 Haz 2026 Pzt, 12:57
 * tarihinde ↵ şunu yazdı:". Matched against the whole body, not per line.
 */
const QUOTE_MARKERS = [
  /(^|\n)\s*On\s[\s\S]{0,220}?\bwrote:/,
  /(^|\n)[^\n]{0,220}(\n[^\n]{0,120})?\s*(şunu\s+yazdı|schrieb|a\s+écrit|escribió):/,
  /(^|\n)\s*-{2,}\s*(Original Message|Forwarded message)/i,
  /(^|\n)\s*From:\s[^\n]*\n\s*(Sent|Date):/,
];

/**
 * Keeps only the text the user wrote themselves: cuts the message at the first
 * reply-quote marker and drops ">"-quoted lines.
 */
function stripQuotedText(body: string): string {
  let cut = body.length;
  for (const re of QUOTE_MARKERS) {
    const m = re.exec(body);
    if (m && m.index < cut) cut = m.index;
  }
  return body
    .slice(0, cut)
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith(">"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** True when the text reads like something a person wrote — not a data dump, link or attachment-only send. */
function looksLikeProse(text: string): boolean {
  // Links, attachment names and inline-image placeholders aren't the user's voice.
  const cleaned = text
    .replace(/https?:\/\/\S+|www\.\S+/gi, " ")
    .replace(/<[^<>\s]+@[^<>\s]+>/g, " ")
    .replace(/\[image:[^\]]*\]/gi, " ")
    .replace(/\S+\.(zip|rar|7z|pdf|docx?|xlsx?|pptx?|csv|png|jpe?g|gif|mp4|txt)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 60) return false;
  const letters = (cleaned.match(/\p{L}/gu) ?? []).length;
  return letters / cleaned.length >= 0.5;
}

function extractHtml(part: gmail_v1.Schema$MessagePart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/html" && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  for (const p of part.parts ?? []) {
    const html = extractHtml(p);
    if (html) return html;
  }
  return "";
}

/** Raw HTML body of a message, for rendering in the app's reading pane. */
export async function getMessageHtml(
  gmail: gmail_v1.Gmail,
  messageId: string,
): Promise<string | null> {
  try {
    const { data } = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });
    return extractHtml(data.payload).trim() || null;
  } catch {
    return null;
  }
}

export function parseEmailAddress(raw: string): string {
  const value = typeof raw === "string" ? raw : "";
  const match = value.match(/<([^>]+)>/);
  return (match ? match[1] : value).trim().toLowerCase();
}

/** Deep link into Gmail for the right account, works even if the thread is archived. */
export function gmailThreadUrl(accountEmail: string, threadId: string): string {
  return `https://mail.google.com/mail/?authuser=${encodeURIComponent(accountEmail)}#all/${threadId}`;
}

export async function getMessageMeta(
  gmail: gmail_v1.Gmail,
  messageId: string,
  selfEmail: string,
): Promise<GmailMessageMeta | null> {
  try {
    const { data } = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });
    const from = header(data.payload, "From");
    const fromEmail = parseEmailAddress(from);
    return {
      id: data.id!,
      threadId: data.threadId!,
      from,
      fromEmail,
      to: header(data.payload, "To"),
      subject: header(data.payload, "Subject"),
      snippet: data.snippet ?? "",
      bodyExcerpt: extractText(data.payload).slice(0, 1500),
      date: new Date(Number(data.internalDate ?? Date.now())),
      messageIdHeader: header(data.payload, "Message-ID"),
      references: header(data.payload, "References"),
      listUnsubscribe: header(data.payload, "List-Unsubscribe"),
      listId: header(data.payload, "List-Id"),
      autoSubmitted: header(data.payload, "Auto-Submitted"),
      precedence: header(data.payload, "Precedence"),
      labelIds: data.labelIds ?? [],
      isFromMe: fromEmail === selfEmail.toLowerCase(),
    };
  } catch (err: unknown) {
    // Message can be deleted between history fetch and get.
    if (typeof err === "object" && err && "code" in err && (err as { code: number }).code === 404) {
      return null;
    }
    throw err;
  }
}

/** Lists recent inbox message ids (used for the initial sync). */
export async function listRecentInboxIds(gmail: gmail_v1.Gmail, max = 25): Promise<string[]> {
  const { data } = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
    maxResults: max,
  });
  return (data.messages ?? []).map((m) => m.id!);
}

/**
 * Full-text search across the whole mailbox via Gmail's own search engine
 * (bodies included, any label). Supports Gmail query syntax too.
 */
export async function searchMessageIds(
  gmail: gmail_v1.Gmail,
  q: string,
  max = 500,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < max) {
    const { data } = await gmail.users.messages.list({
      userId: "me",
      q,
      maxResults: Math.min(100, max - ids.length),
      pageToken,
    });
    for (const m of data.messages ?? []) ids.push(m.id!);
    pageToken = data.nextPageToken ?? undefined;
    if (!pageToken || (data.messages ?? []).length === 0) break;
  }
  return ids.slice(0, max);
}

/** Inbox message ids matching a Gmail search query, paginated up to max. */
export async function listInboxIdsByQuery(
  gmail: gmail_v1.Gmail,
  q: string,
  max = 300,
): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < max) {
    const { data } = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"],
      q,
      maxResults: Math.min(100, max - ids.length),
      pageToken,
    });
    for (const m of data.messages ?? []) ids.push(m.id!);
    pageToken = data.nextPageToken ?? undefined;
    if (!pageToken || (data.messages ?? []).length === 0) break;
  }
  return ids.slice(0, max);
}

export type HistoryResult = {
  newHistoryId: string;
  addedInboxIds: string[];
  /** true when the stored historyId is too old and a full resync is needed */
  historyExpired: boolean;
};

/** Incremental sync via history.list since the stored historyId. */
export async function listHistory(
  gmail: gmail_v1.Gmail,
  startHistoryId: string,
): Promise<HistoryResult> {
  const addedInbox = new Set<string>();
  let newHistoryId = startHistoryId;
  let pageToken: string | undefined;

  try {
    do {
      const { data } = await gmail.users.history.list({
        userId: "me",
        startHistoryId,
        historyTypes: ["messageAdded"],
        pageToken,
        maxResults: 100,
      });
      newHistoryId = data.historyId ?? newHistoryId;
      for (const h of data.history ?? []) {
        for (const added of h.messagesAdded ?? []) {
          const labels = added.message?.labelIds ?? [];
          const id = added.message?.id;
          if (!id) continue;
          if (labels.includes("INBOX") && !labels.includes("DRAFT")) addedInbox.add(id);
        }
      }
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (err: unknown) {
    if (typeof err === "object" && err && "code" in err && (err as { code: number }).code === 404) {
      return { newHistoryId: startHistoryId, addedInboxIds: [], historyExpired: true };
    }
    throw err;
  }

  return {
    newHistoryId,
    addedInboxIds: [...addedInbox],
    historyExpired: false,
  };
}

export async function getCurrentHistoryId(gmail: gmail_v1.Gmail): Promise<string> {
  const { data } = await gmail.users.getProfile({ userId: "me" });
  return String(data.historyId);
}

/**
 * Registers (or renews) Gmail push notifications to a Pub/Sub topic.
 * Watches INBOX so triage stays push-driven.
 * Returns the expiration timestamp reported by Google (~7 days out).
 */
export async function startWatch(gmail: gmail_v1.Gmail, topicName: string): Promise<Date> {
  const { data } = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName,
      labelIds: ["INBOX"],
      labelFilterBehavior: "include",
    },
  });
  return new Date(Number(data.expiration ?? Date.now() + 6 * 24 * 60 * 60 * 1000));
}

export async function applyLabels(
  gmail: gmail_v1.Gmail,
  messageId: string,
  addLabelIds: string[],
  removeLabelIds: string[] = [],
): Promise<void> {
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { addLabelIds, removeLabelIds },
  });
}

/** Creates a reply draft inside the original thread so it shows up natively in Gmail. */
export async function createReplyDraft(
  gmail: gmail_v1.Gmail,
  opts: {
    threadId: string;
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string;
    references?: string;
  },
): Promise<string> {
  const subject = opts.subject.toLowerCase().startsWith("re:")
    ? opts.subject
    : `Re: ${opts.subject}`;

  const headers = [
    `To: ${opts.to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
  ];
  if (opts.inReplyTo) headers.push(`In-Reply-To: ${opts.inReplyTo}`);
  const references = [opts.references, opts.inReplyTo].filter(Boolean).join(" ").trim();
  if (references) headers.push(`References: ${references}`);

  const raw = Buffer.from(headers.join("\r\n") + "\r\n\r\n" + opts.body, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const { data } = await gmail.users.drafts.create({
    userId: "me",
    requestBody: { message: { raw, threadId: opts.threadId } },
  });
  return data.id!;
}

/**
 * Body text of a Gmail draft, for showing the AI reply inline in the app.
 * Returns null when the draft no longer exists (sent or discarded).
 */
export async function getDraftText(
  gmail: gmail_v1.Gmail,
  draftId: string,
): Promise<string | null> {
  try {
    const { data } = await gmail.users.drafts.get({
      userId: "me",
      id: draftId,
      format: "full",
    });
    return extractText(data.message?.payload).trim() || null;
  } catch (err: unknown) {
    const code =
      typeof err === "object" && err && "code" in err ? (err as { code: number }).code : 0;
    if (code === 404 || code === 400) return null;
    throw err;
  }
}

/**
 * Deletes a Gmail draft. Returns false when the draft no longer exists —
 * i.e. the user already sent or discarded it.
 */
export async function deleteDraft(gmail: gmail_v1.Gmail, draftId: string): Promise<boolean> {
  try {
    await gmail.users.drafts.delete({ userId: "me", id: draftId });
    return true;
  } catch (err: unknown) {
    const code =
      typeof err === "object" && err && "code" in err ? (err as { code: number }).code : 0;
    if (code === 404 || code === 400) return false;
    throw err;
  }
}

/** Fetches recent sent messages' text (for building the voice profile). */
export async function listRecentSentTexts(
  gmail: gmail_v1.Gmail,
  selfEmail: string,
  max = 50,
): Promise<{ subject: string; body: string }[]> {
  const { data } = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["SENT"],
    maxResults: max,
  });
  const out: { subject: string; body: string }[] = [];
  for (const m of data.messages ?? []) {
    const meta = await getMessageMeta(gmail, m.id!, selfEmail);
    if (!meta) continue;
    const body = stripQuotedText(meta.bodyExcerpt).slice(0, 800);
    if (body.length > 40) out.push({ subject: meta.subject, body });
    if (out.length >= 30) break;
  }
  return out;
}

export type SentSample = {
  id: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
};

/** Lists recent sent messages so the user can pick voice-training samples. */
export async function listSentSamples(
  gmail: gmail_v1.Gmail,
  max = 60,
): Promise<SentSample[]> {
  const { data } = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["SENT"],
    maxResults: max,
  });
  const out: SentSample[] = [];
  for (const m of data.messages ?? []) {
    const { data: msg } = await gmail.users.messages.get({
      userId: "me",
      id: m.id!,
      format: "full",
    });
    // Show only what the user wrote themselves — skips attachment-only sends,
    // pure quotes and pasted data, and avoids the HTML-escaped Gmail snippet.
    const ownText = stripQuotedText(extractText(msg.payload));
    if (!looksLikeProse(ownText)) continue;
    out.push({
      id: msg.id!,
      to: header(msg.payload, "To"),
      subject: header(msg.payload, "Subject") || "(no subject)",
      snippet: ownText
        .replace(/\[image:[^\]]*\]/gi, " ")
        .replace(/https?:\/\/\S+/gi, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200),
      date: new Date(Number(msg.internalDate ?? Date.now())).toISOString(),
    });
    if (out.length >= 40) break;
  }
  return out;
}

/** Fetches the full text of specific sent messages (user-picked voice-training samples). */
export async function getSentTextsByIds(
  gmail: gmail_v1.Gmail,
  selfEmail: string,
  messageIds: string[],
): Promise<{ subject: string; body: string }[]> {
  const out: { subject: string; body: string }[] = [];
  for (const id of messageIds) {
    const meta = await getMessageMeta(gmail, id, selfEmail);
    if (!meta) continue;
    const body = stripQuotedText(meta.bodyExcerpt).slice(0, 800);
    if (body.length > 0) out.push({ subject: meta.subject, body });
  }
  return out;
}

/** Checks whether a thread already contains a reply from someone other than the user. */
export async function threadHasExternalReplyAfter(
  gmail: gmail_v1.Gmail,
  threadId: string,
  selfEmail: string,
  afterMs: number,
): Promise<boolean> {
  const { data } = await gmail.users.threads.get({
    userId: "me",
    id: threadId,
    format: "metadata",
    metadataHeaders: ["From", "Date"],
  });
  for (const msg of data.messages ?? []) {
    const from = parseEmailAddress(
      msg.payload?.headers?.find((h) => h.name?.toLowerCase() === "from")?.value ?? "",
    );
    const ts = Number(msg.internalDate ?? 0);
    if (from && from !== selfEmail.toLowerCase() && ts > afterMs) return true;
  }
  return false;
}

