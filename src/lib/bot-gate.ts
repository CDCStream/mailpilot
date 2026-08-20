import type { Category } from "@/lib/db/schema";

/** Local-part / domain tokens that mean "this is a machine, not a person waiting." */
export const BOT_SENDER_RE =
  /(^|[.\-_+])(no-?reply|donotreply|do-?not-?reply|notifications?|mailer|bounce|postmaster|automated)([.\-_+]|@|$)/i;

const OWN_HOSTS = new Set(["inboxwingman.com", "www.inboxwingman.com"]);

export type GateHeaders = {
  listUnsubscribe?: string | null;
  listId?: string | null;
  autoSubmitted?: string | null;
  precedence?: string | null;
};

export type GateInput = {
  from: string;
  fromEmail: string;
  subject?: string;
  bodyExcerpt?: string;
  headers?: GateHeaders;
};

export type GateResult = {
  /** Drop the message entirely (own-domain mail, e.g. our own brief). */
  skipIngest: boolean;
  /** Never classify as To Respond; never draft. */
  neverToRespond: boolean;
  /** Suggested category when the gate is sure. */
  category: Category | null;
  reason: string;
};

function localPart(email: string): string {
  return (email.split("@")[0] ?? "").toLowerCase();
}

function domainOf(email: string): string {
  return (email.split("@")[1] ?? "").toLowerCase().replace(/\.+$/, "");
}

export function appOwnHosts(): Set<string> {
  const hosts = new Set(OWN_HOSTS);
  try {
    const u = process.env.NEXT_PUBLIC_APP_URL;
    if (u) hosts.add(new URL(u).hostname.toLowerCase().replace(/^www\./, ""));
  } catch {
    /* ignore */
  }
  return hosts;
}

export function isOwnAppSender(fromEmail: string): boolean {
  const domain = domainOf(fromEmail);
  const roots = appOwnHosts();
  for (const h of roots) {
    if (domain === h || domain.endsWith(`.${h}`)) return true;
  }
  return false;
}

/** Local-parts that never expect a human reply even if they miss the bot regex. */
const NEVER_REPLY_LOCAL = new Set([
  "news",
  "newsletter",
  "privacy",
  "digest",
  "briefing",
  "updates",
  "noreply",
  "no-reply",
  "donotreply",
  "mailer",
  "bounce",
  "postmaster",
]);

export function isBotSender(fromEmail: string, fromDisplay = ""): boolean {
  const email = fromEmail.toLowerCase();
  const local = localPart(email);
  const domain = domainOf(email);
  const blob = `${fromDisplay} ${email}`;
  if (BOT_SENDER_RE.test(local) || BOT_SENDER_RE.test(email) || BOT_SENDER_RE.test(blob)) {
    return true;
  }
  if (NEVER_REPLY_LOCAL.has(local)) return true;
  if (/noreply|donotreply|do-not-reply|mailer-daemon/i.test(domain)) return true;
  if (/no[-_]?reply|do[-_]?not[-_]?reply/i.test(email)) return true;
  return false;
}

function hasBulkHeaders(headers: GateHeaders | undefined): { bulk: boolean; newsletter: boolean } {
  const unsub = (headers?.listUnsubscribe ?? "").trim();
  const listId = (headers?.listId ?? "").trim();
  const auto = (headers?.autoSubmitted ?? "").toLowerCase();
  const prec = (headers?.precedence ?? "").toLowerCase();
  const newsletter = listId.length > 0;
  const bulk =
    unsub.length > 0 ||
    newsletter ||
    auto.includes("auto-generated") ||
    auto.includes("auto-replied") ||
    /\b(bulk|list|junk)\b/.test(prec);
  return { bulk, newsletter };
}

const MONEY_RE =
  /(payment.{0,48}(unsuccessful|failed|couldn't process|could not process)|(couldn't|could not) process payment|failed payment|invoice|receipt|subscription.{0,24}renew|card (expir|declin)|visa ending|charged to|payout|past due|billing)/i;

const SECURITY_RE =
  /(two-factor|2fa|security (alert|key|code)|g[uü]venlik uyar[ıi]s[ıi]|access tokens? expir|password (changed|reset)|new (device|sign-in)|login from|granular access token)/i;

/** Subject/body heuristics that outrank generic notification. */
export function detectObligationCategory(
  subject: string,
  bodyExcerpt: string,
  fromEmail: string,
): Category | null {
  const text = `${fromEmail} ${subject} ${bodyExcerpt}`;
  if (SECURITY_RE.test(text)) return "security";
  if (MONEY_RE.test(text)) return "money";
  return null;
}

/**
 * Hard pre-classification gate. Runs before any LLM call.
 * If neverToRespond, the message must not be `to_respond` and must not get a draft.
 */
export function evaluateBotGate(input: GateInput): GateResult {
  const email = input.fromEmail.toLowerCase();

  if (isOwnAppSender(email)) {
    return {
      skipIngest: true,
      neverToRespond: true,
      category: null,
      reason: "own-domain",
    };
  }

  const obligation = detectObligationCategory(
    input.subject ?? "",
    input.bodyExcerpt ?? "",
    email,
  );
  const { bulk, newsletter } = hasBulkHeaders(input.headers);
  const bot = isBotSender(email, input.from);

  if (obligation) {
    return {
      skipIngest: false,
      neverToRespond: true,
      category: obligation,
      reason: obligation === "money" ? "money-heuristic" : "security-heuristic",
    };
  }

  if (bot || bulk) {
    return {
      skipIngest: false,
      neverToRespond: true,
      category: null,
      reason: bot ? "bot-sender" : newsletter ? "list-id" : "bulk-header",
    };
  }

  return {
    skipIngest: false,
    neverToRespond: false,
    category: null,
    reason: "pass",
  };
}

export function canBeToRespond(opts: {
  summary: string | null | undefined;
  gate: GateResult;
  category: Category;
}): boolean {
  if (opts.gate.neverToRespond) return false;
  if (opts.summary == null || opts.summary.trim() === "") return false;
  return opts.category === "to_respond";
}
