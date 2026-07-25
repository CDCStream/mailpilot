import { google, gmail_v1 } from "googleapis";
import { decryptSecret } from "@/lib/crypto";
import type { Category } from "@/lib/db/schema";

export const CATEGORY_LABELS: Record<Category, string> = {
  to_respond: "MailPilot/To Respond",
  fyi: "MailPilot/FYI",
  newsletter: "MailPilot/Newsletter",
  marketing: "MailPilot/Marketing",
  notification: "MailPilot/Notification",
  cold_email: "MailPilot/Cold Email",
};

/** Categories that are safe to auto-archive when the user opts in. */
export const LOW_PRIORITY_CATEGORIES: Category[] = ["newsletter", "marketing", "cold_email"];

export function getGmailClient(encryptedRefreshToken: string): gmail_v1.Gmail {
  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  oauth2.setCredentials({ refresh_token: decryptSecret(encryptedRefreshToken) });
  return google.gmail({ version: "v1", auth: oauth2 });
}

/** Creates the MailPilot label set if missing; returns category -> labelId map. */
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
    return decodeBase64Url(part.body.data)
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

export function parseEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match ? match[1] : raw).trim().toLowerCase();
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

export type HistoryResult = {
  newHistoryId: string;
  addedInboxIds: string[];
  addedSentIds: string[];
  /** true when the stored historyId is too old and a full resync is needed */
  historyExpired: boolean;
};

/** Incremental sync via history.list since the stored historyId. */
export async function listHistory(
  gmail: gmail_v1.Gmail,
  startHistoryId: string,
): Promise<HistoryResult> {
  const addedInbox = new Set<string>();
  const addedSent = new Set<string>();
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
          if (labels.includes("SENT") && !labels.includes("DRAFT")) addedSent.add(id);
        }
      }
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (err: unknown) {
    if (typeof err === "object" && err && "code" in err && (err as { code: number }).code === 404) {
      return { newHistoryId: startHistoryId, addedInboxIds: [], addedSentIds: [], historyExpired: true };
    }
    throw err;
  }

  return {
    newHistoryId,
    addedInboxIds: [...addedInbox],
    addedSentIds: [...addedSent],
    historyExpired: false,
  };
}

export async function getCurrentHistoryId(gmail: gmail_v1.Gmail): Promise<string> {
  const { data } = await gmail.users.getProfile({ userId: "me" });
  return String(data.historyId);
}

/**
 * Registers (or renews) Gmail push notifications to a Pub/Sub topic.
 * Watches INBOX + SENT so both triage and follow-up tracking stay push-driven.
 * Returns the expiration timestamp reported by Google (~7 days out).
 */
export async function startWatch(gmail: gmail_v1.Gmail, topicName: string): Promise<Date> {
  const { data } = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName,
      labelIds: ["INBOX", "SENT"],
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
    const body = meta.bodyExcerpt.slice(0, 800);
    if (body.length > 40) out.push({ subject: meta.subject, body });
    if (out.length >= 30) break;
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
