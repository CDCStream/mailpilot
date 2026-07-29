import type { ParsedRule } from "@/lib/db";

export type RuleTemplate = {
  id: string;
  title: string;
  blurb: string;
  /** If true, UI shows a domain input (e.g. acme.com). */
  needsDomain?: boolean;
  instruction: string | ((domain: string) => string);
  parsed: ParsedRule | ((domain: string) => ParsedRule);
};

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: "skip-newsletter-drafts",
    title: "Skip newsletter drafts",
    blurb: "Don't write reply drafts for newsletters.",
    instruction: "Never draft replies to newsletters",
    parsed: {
      conditions: [{ field: "category", op: "is", value: "newsletter" }],
      actions: [{ type: "skip_draft" }],
      description: "Skip drafting replies for newsletters",
    },
  },
  {
    id: "archive-newsletters",
    title: "Archive newsletters",
    blurb: "Label and archive newsletters out of the inbox.",
    instruction: "Archive newsletters immediately",
    parsed: {
      conditions: [{ field: "category", op: "is", value: "newsletter" }],
      actions: [{ type: "archive" }],
      description: "Archive newsletter emails after labeling",
    },
  },
  {
    id: "archive-marketing",
    title: "Archive marketing",
    blurb: "Clear promo mail from the inbox automatically.",
    instruction: "Archive marketing emails",
    parsed: {
      conditions: [{ field: "category", op: "is", value: "marketing" }],
      actions: [{ type: "archive" }],
      description: "Archive marketing emails after labeling",
    },
  },
  {
    id: "archive-cold",
    title: "Archive cold email",
    blurb: "Pitch / spam-like cold outreach leaves the inbox.",
    instruction: "Archive cold emails immediately",
    parsed: {
      conditions: [{ field: "category", op: "is", value: "cold_email" }],
      actions: [{ type: "archive" }],
      description: "Archive cold emails after labeling",
    },
  },
  {
    id: "vip-domain",
    title: "VIP domain",
    blurb: "Star mail from a domain you never want to miss.",
    needsDomain: true,
    instruction: (domain) => `Star anything from ${domain}`,
    parsed: (domain) => ({
      conditions: [{ field: "domain", op: "equals", value: domain.toLowerCase() }],
      actions: [{ type: "star" }, { type: "keep_in_inbox" }],
      description: `Star and keep emails from ${domain.toLowerCase()} in the inbox`,
    }),
  },
  {
    id: "skip-domain-drafts",
    title: "Never draft for a domain",
    blurb: "Useful for accountants, bots, or automated senders.",
    needsDomain: true,
    instruction: (domain) => `Never draft replies to ${domain}`,
    parsed: (domain) => ({
      conditions: [{ field: "domain", op: "equals", value: domain.toLowerCase() }],
      actions: [{ type: "skip_draft" }],
      description: `Skip drafting replies for senders at ${domain.toLowerCase()}`,
    }),
  },
];
