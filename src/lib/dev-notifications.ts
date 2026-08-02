import type { Category } from "@/lib/db";

/**
 * Developer-notification taxonomy for technical-founder inboxes.
 * Runs before / alongside AI classification so we never draft LinkedIn
 * invites, Dependabot noise, or CI failures — and so the brief can surface
 * real incidents instead.
 */
export type DevSignalKind =
  | "silent_archive"
  | "incident"
  | "action_no_draft"
  | "human_reply"
  | "deadline_no_draft"
  | "noreply_no_draft";

export type DevSignal = {
  kind: DevSignalKind;
  /** Override AI category when set. */
  category: Category;
  forceArchive: boolean;
  skipDraft: boolean;
  /** Hint for brief / UI (not persisted as a separate column yet). */
  briefTag?: "incident" | "deadline" | "action";
  /** Prefer this one-liner over (or as seed for) the AI summary. */
  summaryHint?: string;
};

type Input = {
  from: string;
  fromEmail: string;
  subject: string;
  bodyExcerpt: string;
};

function haystack(input: Input): string {
  return `${input.from} ${input.fromEmail} ${input.subject} ${input.bodyExcerpt}`.toLowerCase();
}

function emailLocal(fromEmail: string): string {
  return (fromEmail.split("@")[0] ?? "").toLowerCase();
}

function domainOf(fromEmail: string): string {
  return (fromEmail.split("@")[1] ?? "").toLowerCase();
}

const NOREPLY_LOCAL =
  /^(noreply|no-reply|no_reply|donotreply|do-not-reply|do_not_reply|mailer-daemon|mailerdaemon|notifications?|notify|alerts?|automated|auto|bounce|postmaster|support-noreply)$/i;

/** Categories that must never get an auto (or on-demand) reply draft. */
const NEVER_DRAFT_CATEGORIES = new Set<Category>([
  "notification",
  "newsletter",
  "marketing",
  "cold_email",
]);

/**
 * Hard draft gate — runs after classification. Any true → do not draft.
 * This is the overnight fix for "NOTIFICATION labeled, still drafted".
 *
 * 1) noreply / notifications / +reply-style addresses
 * 2) List-Unsubscribe header (bulk / marketing / bot mail)
 * 3) Non-human categories
 */
export function shouldBlockDraft(input: {
  fromEmail: string;
  from?: string;
  category: Category | null | undefined;
  listUnsubscribe?: string | null;
}): boolean {
  if (input.category && NEVER_DRAFT_CATEGORIES.has(input.category)) return true;

  const unsub = (input.listUnsubscribe ?? "").trim();
  if (unsub.length > 0) return true;

  const email = input.fromEmail.toLowerCase();
  const local = emailLocal(email);
  const blob = `${input.from ?? ""} ${email}`.toLowerCase();

  if (NOREPLY_LOCAL.test(local)) return true;
  if (/no[-_]?reply|do[-_]?not[-_]?reply|mailer-daemon/.test(email)) return true;
  // Google-style "...-reply+hash@..." and "+reply" local-parts
  if (/\+reply|reply\+|notifications?@/i.test(email)) return true;
  if (/\b(noreply|no-reply|donotreply|do-not-reply)\b/i.test(blob)) return true;

  return false;
}

const SILENT_BOT_DOMAINS = [
  "dependabot.com",
  "renovatebot.com",
  "noreply.github.com", // often PR bots; human review handled separately via subject
];

const INCIDENT_SENDERS = [
  "vercel.com",
  "ct.vercel.com",
  "notifications.vercel.com",
  "gitlab.com",
  "circleci.com",
  "buildkite.com",
  "travis-ci.com",
  "travis-ci.org",
  "sentry.io",
  "alerts.sentry.io",
  "noreply@sentry.io",
];

/**
 * Returns a hard signal when the message matches a known developer pattern,
 * otherwise null (fall through to AI classification).
 */
export function detectDevNotification(input: Input): DevSignal | null {
  const text = haystack(input);
  const local = emailLocal(input.fromEmail);
  const domain = domainOf(input.fromEmail);
  const subject = input.subject.toLowerCase();

  // --- Dependabot / Renovate: bury quietly ---
  if (
    text.includes("dependabot") ||
    text.includes("renovate bot") ||
    text.includes("renovate[bot]") ||
    SILENT_BOT_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`)) ||
    (/github\.com$/i.test(domain) &&
      /dependabot|renovate|github-actions\[bot\]/i.test(input.from))
  ) {
    return {
      kind: "silent_archive",
      category: "notification",
      forceArchive: true,
      skipDraft: true,
      summaryHint: "Dependency bot update — auto-archived.",
    };
  }

  // --- GitHub review requested: a human is waiting ---
  if (
    (/github\.com$/i.test(domain) || text.includes("github.com")) &&
    /(review requested|requested your review|asked you to review)/i.test(
      `${input.subject} ${input.bodyExcerpt}`,
    )
  ) {
    return {
      kind: "human_reply",
      category: "to_respond",
      forceArchive: false,
      skipDraft: false,
      briefTag: "action",
      summaryHint: "GitHub review requested — someone is waiting on you.",
    };
  }

  // --- Vercel / CI deploy failures → incident in brief, never draft ---
  if (
    INCIDENT_SENDERS.some((d) => domain === d || domain.endsWith(`.${d}`) || text.includes(d)) &&
    /(fail|failed|failure|error|broken|down|incident|deploy(ment)? (failed|error)|build failed|alert)/i.test(
      subject,
    )
  ) {
    return {
      kind: "incident",
      category: "notification",
      forceArchive: false,
      skipDraft: true,
      briefTag: "incident",
      summaryHint: `Incident: ${input.subject.slice(0, 120)}`,
    };
  }

  // --- Sentry volume / issue alerts (even without "failed" in subject) ---
  if (
    /sentry\.io$/i.test(domain) ||
    text.includes("sentry.io") ||
    /^sentry\b/i.test(input.from)
  ) {
    return {
      kind: "incident",
      category: "notification",
      forceArchive: false,
      skipDraft: true,
      briefTag: "incident",
      summaryHint: `Sentry: ${input.subject.slice(0, 120)}`,
    };
  }

  // --- Linear / Jira assignment: action item, not a prose reply ---
  if (
    /(linear\.app|atlassian\.net|jira\.|trello\.com)$/i.test(domain) ||
    text.includes("linear.app") ||
    (/\bjira\b/i.test(text) && /(assigned|mentioned you|you were assigned)/i.test(text))
  ) {
    if (/(assigned|mentioned you|you were assigned|added you)/i.test(text)) {
      return {
        kind: "action_no_draft",
        category: "to_respond",
        forceArchive: false,
        skipDraft: true,
        briefTag: "action",
        summaryHint: `Assignment: ${input.subject.slice(0, 120)}`,
      };
    }
  }

  // --- Adobe Sign / DocuSign / domain verification: deadline, no draft ---
  if (
    /(adobesign|adobe\.com|docusign\.net|docusign\.com|hello\.docusign)/i.test(domain) ||
    /(signature|e-?sign|approve.*(document|agreement)|domain verification|verify your domain|dns verification)/i.test(
      text,
    )
  ) {
    if (
      /(sign|signature|approv|verify|verification|action required|needs your)/i.test(text)
    ) {
      return {
        kind: "deadline_no_draft",
        category: "to_respond",
        forceArchive: false,
        skipDraft: true,
        briefTag: "deadline",
        summaryHint: `Action / signature needed: ${input.subject.slice(0, 120)}`,
      };
    }
  }

  // --- LinkedIn invites & social noreply noise ---
  if (
    /linkedin\.com$/i.test(domain) ||
    text.includes("linkedin.com")
  ) {
    if (
      /(invitation|invited you to connect|wants to connect|added you|endorsed you|viewed your profile)/i.test(
        text,
      )
    ) {
      return {
        kind: "noreply_no_draft",
        category: "notification",
        forceArchive: true,
        skipDraft: true,
        summaryHint: "LinkedIn social notification — no reply needed.",
      };
    }
  }

  // --- Generic noreply / do-not-reply senders ---
  if (
    NOREPLY_LOCAL.test(local) ||
    /no[-_]?reply|do[-_]?not[-_]?reply|mailer-daemon/i.test(input.fromEmail) ||
    /do not reply|this (email|message) was sent from an unmonitored/i.test(text)
  ) {
    return {
      kind: "noreply_no_draft",
      category: "notification",
      forceArchive: false,
      skipDraft: true,
      summaryHint: input.subject.slice(0, 160) || "Automated notification.",
    };
  }

  return null;
}
