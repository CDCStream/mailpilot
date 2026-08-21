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
  /** Persisted at ingest so re-triage can run without the raw Gmail payload. */
  hasListUnsubscribe?: boolean;
  isAutoSubmitted?: boolean;
  isBulkPrecedence?: boolean;
  hasListId?: boolean;
};

export function headerFlagsFromMeta(headers: {
  listUnsubscribe?: string | null;
  listId?: string | null;
  autoSubmitted?: string | null;
  precedence?: string | null;
}): Required<Pick<GateHeaders, "hasListUnsubscribe" | "isAutoSubmitted" | "isBulkPrecedence" | "hasListId">> {
  const unsub = (headers.listUnsubscribe ?? "").trim();
  const listId = (headers.listId ?? "").trim();
  const auto = (headers.autoSubmitted ?? "").toLowerCase();
  const prec = (headers.precedence ?? "").toLowerCase();
  return {
    hasListUnsubscribe: unsub.length > 0,
    hasListId: listId.length > 0,
    isAutoSubmitted: auto.includes("auto-generated") || auto.includes("auto-replied"),
    isBulkPrecedence: /\b(bulk|list|junk)\b/.test(prec),
  };
}

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
  if (!headers) return { bulk: false, newsletter: false };
  try {
    const unsub = String(headers.listUnsubscribe ?? "").trim();
    const listId = String(headers.listId ?? "").trim();
    const auto = String(headers.autoSubmitted ?? "").toLowerCase();
    const prec = String(headers.precedence ?? "").toLowerCase();
    const newsletter = headers.hasListId === true || listId.length > 0;
    const bulk =
      headers.hasListUnsubscribe === true ||
      headers.isAutoSubmitted === true ||
      headers.isBulkPrecedence === true ||
      unsub.length > 0 ||
      newsletter ||
      auto.includes("auto-generated") ||
      auto.includes("auto-replied") ||
      /\b(bulk|list|junk)\b/.test(prec);
    return { bulk, newsletter };
  } catch {
    return { bulk: false, newsletter: false };
  }
}

const MONEY_RE =
  /(payment.{0,48}(unsuccessful|failed|couldn't process|could not process)|(couldn't|could not) process payment|failed payment|invoice|receipt|subscription.{0,24}renew|card (expir|declin)|visa ending|charged to|payout|past due|billing)/i;

/** Must be an event on the user's own account — never a job title or a policy memo. */
const SECURITY_RE =
  /(two-factor|2fa|mfa|security (alert|advisory|key was|code for your)|g[uü]venlik uyar[ıi]s[ıi]|access tokens? expir|password (changed|reset)|new (device|sign-in|login) (detected|on your|to your|from)|sign-in detected|login from a new|granular access token|couldn't sign you in|suspicious (sign-?in|login)|data breach|breach affecting your|giri[sş] do[gğ]rulama|verification code)/i;

/** Policy / promo / vendor-compliance copy that is not a security event. */
const NOT_SECURITY_RE =
  /(still interested|household|sub-processors?|privacy polic|cookie polic|terms of (use|service)|how to update your|seo prep|course (prep|launch)|an update on .{0,60}(privacy|sub-processor))/i;

/** Mixed-intent social networks — a domain cache must never label the whole mailbox. */
export function isLinkedInSender(fromEmail: string, from = ""): boolean {
  const blob = `${from} ${fromEmail}`.toLowerCase();
  return /linkedin\.com|lnkd\.in|\bvia linkedin\b/.test(blob);
}

/** Hiring digest / "Company is hiring" — never the user's own account. */
export function isHiringNotice(from: string, fromEmail: string, subject = ""): boolean {
  const blob = `${from} ${fromEmail} ${subject}`.toLowerCase();
  return /\bis hiring\b|hiring for (a |an )|we're hiring|we are hiring/.test(blob);
}

export function isAccountSecurityText(subject: string, bodyExcerpt = "", fromEmail = ""): boolean {
  if (isLinkedInSender(fromEmail) || isHiringNotice("", fromEmail, subject)) return false;
  const blob = `${fromEmail} ${subject} ${bodyExcerpt}`;
  if (NOT_SECURITY_RE.test(blob)) return false;
  return SECURITY_RE.test(blob);
}

/** LinkedIn (and similar) job-alert machines — never a security event. */
export function isJobAlert(from: string, fromEmail: string, subject = ""): boolean {
  const blob = `${from} ${fromEmail} ${subject}`.toLowerCase();
  if (isHiringNotice(from, fromEmail, subject)) return true;
  if (/jobalerts?(?:-noreply)?@|job.?alerts/i.test(blob)) return true;
  if (/linkedin\.com/i.test(fromEmail) && /job alert|jobs? you may|new jobs? for you|similar to /i.test(blob)) {
    return true;
  }
  return false;
}

const SUPPORT_LOCAL = new Set(["support", "hello", "team", "help"]);

/** A human support agent replying on a thread the user opened. Role inboxes are not bots. */
export function isHumanSupportReply(from: string, fromEmail: string, subject = ""): boolean {
  if (isBotSender(fromEmail, from)) return false;
  if (isJobAlert(from, fromEmail, subject)) return false;
  if (isOwnAppSender(fromEmail)) return false;
  if (isLinkedInSender(fromEmail, from)) return false;
  const local = localPart(fromEmail);
  const replied = /^(re|fw|fwd)\s*:/i.test(subject.trim());
  const supportish =
    SUPPORT_LOCAL.has(local) ||
    /^(support|hello|team|help)[-+.]/i.test(local) ||
    /\bsupport\b/i.test(from);
  return replied && supportish;
}

/** Subject/body heuristics that outrank generic notification. */
export function detectObligationCategory(
  subject: string,
  bodyExcerpt: string,
  fromEmail: string,
  from = "",
): Category | null {
  if (isJobAlert(from, fromEmail, subject)) return null;
  if (isLinkedInSender(fromEmail, from) && !isAccountSecurityText(subject, bodyExcerpt, fromEmail)) {
    return null;
  }
  if (isAccountSecurityText(subject, bodyExcerpt, fromEmail)) return "security";
  if (MONEY_RE.test(`${fromEmail} ${subject} ${bodyExcerpt}`)) return "money";
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

  const subject = input.subject ?? "";
  const body = input.bodyExcerpt ?? "";
  if (isLinkedInSender(email, input.from)) {
    return {
      skipIngest: false,
      neverToRespond: true,
      category: "notification",
      reason: "linkedin",
    };
  }

  if (isJobAlert(input.from, email, subject)) {
    return {
      skipIngest: false,
      neverToRespond: true,
      category: "notification",
      reason: "job-alert",
    };
  }

  const obligation = detectObligationCategory(
    input.subject ?? "",
    input.bodyExcerpt ?? "",
    email,
    input.from,
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
