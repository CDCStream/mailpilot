/**
 * Competitor alternative pages at /alternatives/[slug].
 * Facts about rivals come from their public sites (as of the `updated` date).
 * Do not invent features, prices, or send-behavior.
 */

export type AlternativeFaq = { q: string; a: string };
export type AlternativeRow = { label: string; us: string; them: string };

export type Alternative = {
  slug: string;
  /** Competitor product name. */
  name: string;
  websiteLabel: string;
  websiteHref: string;
  keyword: string;
  /** Page H1. */
  nameH1: string;
  tagline: string;
  description: string;
  definition: string;
  date: string;
  updated: string;
  rows: AlternativeRow[];
  whenUs: string[];
  whenThem: string[];
  faq: AlternativeFaq[];
  relatedSlugs: string[];
  cta: { headline: string; body: string; href: string; label: string };
};

export const ALTERNATIVES: Alternative[] = [
  {
    slug: "fyxer",
    name: "Fyxer",
    websiteLabel: "fyxer.com",
    websiteHref: "https://www.fyxer.com",
    keyword: "fyxer alternative",
    nameH1: "Fyxer alternative for Gmail",
    tagline:
      "Inbox Wingman vs Fyxer: both sit on top of Gmail and never send without you. Wingman is Gmail-only, credit-metered, and built for freelance developers and small studios.",
    description:
      "Looking for a Fyxer alternative? Inbox Wingman triages Gmail, drafts in your voice, and never sends without you — 14-day trial, no card.",
    definition:
      "A Fyxer alternative is a Gmail AI assistant that sorts mail and drafts replies without sending. Inbox Wingman does that inside Gmail; Fyxer also covers Outlook, meetings, and calendar.",
    date: "2026-09-06",
    updated: "2026-09-06",
    rows: [
      {
        label: "Where it lives",
        us: "Inside Gmail",
        them: "Inside Gmail or Outlook",
      },
      {
        label: "Sends without you",
        us: "Never",
        them: "Never (their help center is explicit)",
      },
      {
        label: "Triage labels",
        us: "Yes — To Respond, FYI, Newsletter, Marketing, Notification, Cold Email, Money, Security",
        them: "Yes — categories such as To Respond, FYI, Marketing",
      },
      {
        label: "Voice-matched drafts",
        us: "Yes, in Gmail — you review and send",
        them: "Yes — drafts land for you to send",
      },
      {
        label: "Daily brief",
        us: "One morning email with replies you owe and deadlines",
        them: "Not their core product — they lead with inbox + meetings",
      },
      {
        label: "Ask your inbox",
        us: "Yes (AI credits)",
        them: "Fyxer Chat on Professional",
      },
      {
        label: "Meeting notetaker / calendar",
        us: "No",
        them: "Yes — notes, scheduling (more on Professional)",
      },
      {
        label: "HubSpot / file training",
        us: "No",
        them: "Professional plan",
      },
      {
        label: "Outlook",
        us: "No — Gmail only",
        them: "Yes",
      },
      {
        label: "Trial",
        us: "14 days, no card",
        them: "7 days",
      },
      {
        label: "Starting price (public, Sep 2026)",
        us: "Pilot from the pricing page — credit-metered",
        them: "Starter $30/mo, or $22.50/mo billed annually",
      },
    ],
    whenUs: [
      "You live in Gmail and do not need Outlook.",
      "You want a daily brief and Ask inbox, not a meeting notetaker.",
      "You want a longer no-card trial and credit-based AI so draft cost stays visible.",
      "You are a freelance developer or a small studio, not an exec-assistant rollout.",
    ],
    whenThem: [
      "You need Outlook as well as Gmail.",
      "You want a notetaker in video calls and calendar scheduling in the same product.",
      "You want HubSpot, file uploads to train the assistant, or a specialist onboarding session.",
      "You are buying seats for a larger team (their Enterprise starts at 50 users).",
    ],
    faq: [
      {
        q: "Is Inbox Wingman a Fyxer alternative?",
        a: "Yes, if you want AI triage and voice-matched drafts on Gmail without a new inbox. Both products draft and wait for you to send. Fyxer also covers Outlook, meetings, and calendar; Wingman does not.",
      },
      {
        q: "Does Fyxer send emails for you?",
        a: "No. Fyxer’s own help center says it cannot send on your behalf — it only drafts. Inbox Wingman is the same: never sends without you.",
      },
      {
        q: "Does Inbox Wingman work with Outlook?",
        a: "No. Wingman is Gmail-only. If you need Outlook, Fyxer is the closer fit.",
      },
      {
        q: "How do the trials compare?",
        a: "Wingman is 14 days with no card. Fyxer publicly offers a 7-day trial. Confirm current terms on each site before you start.",
      },
    ],
    relatedSlugs: ["aiemaily"],
    cta: {
      headline: "Stay in Gmail. Never send without you.",
      body: "Connect Gmail and try Inbox Wingman for 14 days — no card. Triage, drafts in your voice, one daily brief.",
      href: "/login",
      label: "Start free trial",
    },
  },
  {
    slug: "aiemaily",
    name: "AI Emaily",
    websiteLabel: "aiemaily.com",
    websiteHref: "https://aiemaily.com",
    keyword: "ai emaily alternative",
    nameH1: "AI Emaily alternative that stays in Gmail",
    tagline:
      "Inbox Wingman vs AI Emaily: they are a new multi-provider client with optional Autopilot send. Wingman stays inside Gmail and never sends without you.",
    description:
      "Looking for an AI Emaily alternative that does not replace Gmail? Inbox Wingman triages and drafts in Gmail, never sends without you. 14-day trial, no card.",
    definition:
      "An AI Emaily alternative depends on whether you want a new email client. AI Emaily is a universal inbox with Copilot and Autopilot (Autopilot can send inside your rules). Inbox Wingman is a Gmail add-on that never sends.",
    date: "2026-09-06",
    updated: "2026-09-06",
    rows: [
      {
        label: "What it is",
        us: "Gmail add-on — you keep Gmail",
        them: "New AI-native email client",
      },
      {
        label: "Providers",
        us: "Gmail only",
        them: "Gmail, Outlook, iCloud, Fastmail, Proton, IMAP",
      },
      {
        label: "Sends without you",
        us: "Never",
        them: "Autopilot can send, schedule, and file inside rules you set (delay + undo)",
      },
      {
        label: "Default mode",
        us: "Drafts wait in Gmail for you",
        them: "Manual, Copilot, or Autopilot — you pick the authority",
      },
      {
        label: "Triage",
        us: "Labels inside Gmail",
        them: "Triage inside their client",
      },
      {
        label: "Voice-matched drafts",
        us: "Yes",
        them: "Yes",
      },
      {
        label: "Daily brief",
        us: "Morning email, deep-linked to Gmail threads",
        them: "Living Brief (they also mention Slack / Telegram on paid plans)",
      },
      {
        label: "Ask your inbox",
        us: "Yes, grounded in triaged Gmail",
        them: "Smart Search & Ask across the unified inbox",
      },
      {
        label: "Apps",
        us: "Works in Gmail (web / app you already use)",
        them: "Their web, macOS, iOS, Android clients",
      },
      {
        label: "Trial / free",
        us: "14-day product trial, no card",
        them: "Free plan exists; paid Pro / Autopilot (their llms.txt: $17.99 / $29.99 per month)",
      },
    ],
    whenUs: [
      "You want to keep working in Gmail, not learn a new client.",
      "You do not want any product to send mail for you — not even with an undo window.",
      "Your world is Gmail (work + personal), not iCloud / Proton / IMAP.",
      "You want labels and drafts to live in the inbox your clients already know.",
    ],
    whenThem: [
      "You want one client for Gmail, Outlook, iCloud, Fastmail, Proton, or IMAP.",
      "You want Autopilot to send or schedule inside a domain allow-list.",
      "You want on-device AI or bring-your-own-key.",
      "You are fine leaving Gmail’s UI for a new inbox.",
    ],
    faq: [
      {
        q: "Is Inbox Wingman an AI Emaily alternative?",
        a: "Only if you want AI on Gmail without switching clients. AI Emaily is a new inbox that can act (including send on Autopilot). Wingman stays in Gmail and never sends.",
      },
      {
        q: "Does AI Emaily send email automatically?",
        a: "On Autopilot, yes — inside rules they document (confidence floor, domain allow-list, send delay you can undo). Copilot stages drafts for one-click approval. Wingman has no send path at all.",
      },
      {
        q: "Does Inbox Wingman replace Gmail?",
        a: "No. You connect Gmail, keep your labels and threads there, and review drafts in Gmail. AI Emaily is designed as the place you read and send mail.",
      },
      {
        q: "Which one is cheaper?",
        a: "AI Emaily publishes a free tier and paid Pro / Autopilot plans. Wingman is a paid Gmail product with a 14-day no-card trial. Compare current numbers on each pricing page — they change.",
      },
    ],
    relatedSlugs: ["fyxer"],
    cta: {
      headline: "Keep Gmail. Skip Autopilot.",
      body: "Inbox Wingman triages and drafts in the inbox you already have. It never sends without you. 14-day free trial, no card.",
      href: "/login",
      label: "Start free trial",
    },
  },
];

export function getAlternative(slug: string): Alternative | null {
  return ALTERNATIVES.find((a) => a.slug === slug) ?? null;
}
