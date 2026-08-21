import type { Category } from "@/lib/db/schema";
import {
  evaluateBotGate,
  isHumanSupportReply,
  isJobAlert,
  isLinkedInSender,
  type GateInput,
  type GateResult,
} from "@/lib/bot-gate";

export type PreClassifyResult = GateResult & {
  /** When set, skip the LLM classification call (summary may still be requested). */
  skipLlmCategory: boolean;
};

const MARKETING_FROM =
  /udemy|udemymail|ideabrowser|alphasignal|semrush|dataquest|nvidia|zapier|cambly|coursera|skillshare|mailchimp|netflix|adobe\.com|oreilly|o'reilly/i;

const MARKETING_SUBJECT =
  /(\bsale\b|sal+e+|coupon|kupon|bundle offer|lowest prices|%\s*off|discount|webinar|workshop|free (access|trial)|on sale|flash sale|limited time|last chance|bogo)/i;

const NEWSLETTER_FROM = /\b(news|newsletter|digest|briefing)@/i;

/**
 * Deterministic category before the LLM. Used so repeat promo senders (Udemy
 * instructors, etc.) never flip between To Respond / Notification / Marketing.
 */
export function preClassify(input: GateInput): PreClassifyResult {
  const gate = evaluateBotGate(input);
  if (gate.skipIngest) {
    return { ...gate, skipLlmCategory: true };
  }

  if (isHumanSupportReply(input.from, input.fromEmail, input.subject ?? "")) {
    return {
      skipIngest: false,
      neverToRespond: false,
      category: "to_respond",
      reason: "support-reply",
      skipLlmCategory: true,
    };
  }

  if (
    isLinkedInSender(input.fromEmail, input.from) ||
    gate.reason === "linkedin" ||
    isJobAlert(input.from, input.fromEmail, input.subject ?? "") ||
    gate.reason === "job-alert"
  ) {
    return {
      ...gate,
      neverToRespond: true,
      category: "notification",
      reason: gate.reason === "job-alert" ? "job-alert" : "linkedin",
      skipLlmCategory: true,
    };
  }

  if (gate.category) {
    return { ...gate, skipLlmCategory: true };
  }

  const from = `${input.from} ${input.fromEmail}`;
  const subject = input.subject ?? "";

  if (NEWSLETTER_FROM.test(input.fromEmail) && !MARKETING_SUBJECT.test(subject)) {
    return {
      ...gate,
      neverToRespond: true,
      category: "newsletter",
      reason: "newsletter-local",
      skipLlmCategory: true,
    };
  }

  if (MARKETING_FROM.test(from) || MARKETING_SUBJECT.test(subject)) {
    return {
      ...gate,
      neverToRespond: true,
      category: "marketing",
      reason: MARKETING_FROM.test(from) ? "marketing-sender" : "marketing-subject",
      skipLlmCategory: true,
    };
  }

  return { ...gate, skipLlmCategory: false };
}

export function clampCategory(opts: {
  category: Category;
  summary: string | null;
  gate: GateResult;
}): Category {
  if (opts.gate.category) return opts.gate.category;
  if (
    (opts.summary == null || opts.summary.trim() === "" || opts.gate.neverToRespond) &&
    opts.category === "to_respond"
  ) {
    return "notification";
  }
  return opts.category;
}

export function senderDomain(email: string): string {
  return (email.split("@")[1] ?? "").toLowerCase().replace(/\.+$/, "");
}

/**
 * Final category after cache + LLM. Hard rules always win so a poisoned
 * domain cache cannot stamp LinkedIn as Security or a support reply as FYI.
 */
export function resolveTriageCategory(opts: {
  from: string;
  fromEmail: string;
  subject: string;
  bodyExcerpt?: string;
  pre: PreClassifyResult;
  llmOrDefault: Category;
  cached: Category | null;
}): Category {
  if (isHumanSupportReply(opts.from, opts.fromEmail, opts.subject)) return "to_respond";
  if (isJobAlert(opts.from, opts.fromEmail, opts.subject)) return "notification";
  if (isLinkedInSender(opts.fromEmail, opts.from)) return "notification";
  if (opts.pre.skipLlmCategory && opts.pre.category) return opts.pre.category;
  if (opts.cached && opts.cached !== "money" && opts.cached !== "security") return opts.cached;
  return opts.llmOrDefault;
}
