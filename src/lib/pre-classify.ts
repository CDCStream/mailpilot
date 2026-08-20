import type { Category } from "@/lib/db/schema";
import { evaluateBotGate, type GateInput, type GateResult } from "@/lib/bot-gate";

export type PreClassifyResult = GateResult & {
  /** When set, skip the LLM classification call (summary may still be requested). */
  skipLlmCategory: boolean;
};

const MARKETING_FROM =
  /udemy|udemymail|ideabrowser|alphasignal|semrush|dataquest|nvidia|zapier|cambly|coursera|skillshare|mailchimp|netflix|adobe\.com/i;

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
