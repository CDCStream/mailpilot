/**
 * Registry for free interactive tools served at /tools/[slug].
 * Tools are keyword-led marketing surfaces: each entry owns one tool-keyword,
 * links to related tools/articles, and ends in one product CTA.
 * The interactive component itself is mapped in src/app/tools/[slug]/page.tsx.
 */

export type FreeToolFaq = { q: string; a: string };

export type FreeToolHowToStep = { name: string; text: string };

export type FreeTool = {
  slug: string;
  /** Page H1, ≤ 60 chars, keyword-natural. */
  name: string;
  /** Short line under the H1. */
  tagline: string;
  /** Meta description, ≤ 155 chars. */
  description: string;
  /** One-sentence definition for AEO/GEO (first sentence = the answer). */
  definition: string;
  /** Honest limits — what this tool does not do. */
  notThis: string[];
  /** Visible how-to + HowTo JSON-LD. */
  howTo: { name: string; totalTime: string; steps: FreeToolHowToStep[] };
  /** Primary tool-keyword (from KEYWORDS, never invented). */
  keyword: string;
  category: string;
  date: string;
  updated: string;
  faq: FreeToolFaq[];
  relatedToolSlugs: string[];
  relatedArticleSlugs: string[];
  cta: { headline: string; body: string; href: string; label: string };
};

export const FREE_TOOLS: FreeTool[] = [
  // STUB TOOL — demonstrates the pipeline. Real tools are built one-per-keyword
  // from the KEYWORDS plan.
  {
    slug: "email-subject-line-tester",
    name: "Free Email Subject Line Tester",
    tagline:
      "Paste a subject line and instantly see how it truncates on desktop and mobile Gmail, plus common issues that hurt open rates.",
    description:
      "Test your email subject line for free: live Gmail desktop and mobile previews, character count, and checks for caps, punctuation, and filler words.",
    definition:
      "An email subject line tester shows how a subject will look in a typical Gmail desktop and mobile inbox list, and flags length, all-caps words, stacked punctuation, and filler openers before you send.",
    notThis: [
      "It does not send email or change anything in Gmail.",
      "It does not predict or guarantee open rates.",
      "Truncation is approximate — real devices and fonts vary.",
    ],
    howTo: {
      name: "How to test an email subject line",
      totalTime: "PT1M",
      steps: [
        {
          name: "Paste the subject",
          text: "Type or paste your subject line into the tester. Nothing is sent to a server.",
        },
        {
          name: "Read the inbox preview",
          text: "Check the desktop (~65 characters) and mobile (~38 characters) previews to see what gets cut.",
        },
        {
          name: "Fix flagged checks",
          text: "Front-load the point, stay under about 60 characters, drop all-caps, stacked punctuation, extra emoji, and filler openers like “quick question”.",
        },
        {
          name: "Copy it into Gmail",
          text: "Use the revised subject when you compose in Gmail.",
        },
      ],
    },
    keyword: "email subject line tester",
    category: "Email writing",
    date: "2026-09-06",
    updated: "2026-09-06",
    faq: [
      {
        q: "Is this subject line tester free?",
        a: "Yes — it runs entirely in your browser, requires no signup, and nothing you type is sent to a server or stored.",
      },
      {
        q: "What does the tester check?",
        a: "Character count against typical desktop (~60–70) and mobile (~30–40) display limits, all-caps words, stacked punctuation, emoji count, and filler openers like \u201cquick question\u201d that waste visible characters.",
      },
      {
        q: "What is the ideal subject line length?",
        a: "Keep the essential part within the first 40 characters so it survives mobile truncation, and stay under roughly 60 characters overall.",
      },
    ],
    relatedToolSlugs: ["email-signature-generator", "gmail-unsubscribe"],
    relatedArticleSlugs: ["email-subject-line-length"],
    cta: {
      headline: "Tired of writing emails at all?",
      body: "Inbox Wingman triages your Gmail and drafts replies in your voice — you just review and send. 14-day free trial, no card.",
      href: "/login",
      label: "Start free trial",
    },
  },
  {
    slug: "email-signature-generator",
    name: "Free Email Signature Generator",
    tagline:
      "Build a clean, Gmail-ready plain-text signature from your name, title, and contact details — then copy it into Gmail settings.",
    description:
      "Free email signature generator: type your details, preview a Gmail-ready signature, and copy it. Runs in your browser — nothing is stored.",
    definition:
      "A free email signature generator builds a plain-text signature from your name, title, company, and contact details so you can paste it into Gmail Settings.",
    notThis: [
      "It does not create HTML, image, or banner signatures.",
      "It does not log into Gmail or store what you type.",
      "It is not a marketing-email or newsletter builder.",
    ],
    howTo: {
      name: "How to create a Gmail email signature",
      totalTime: "PT2M",
      steps: [
        {
          name: "Enter your details",
          text: "Fill in name, title, company, email, phone, and website. Skip any field you do not want in the signature.",
        },
        {
          name: "Preview the plain-text signature",
          text: "The preview updates in the browser. Keep it short: name, role, one contact line.",
        },
        {
          name: "Copy the signature",
          text: "Click Copy signature.",
        },
        {
          name: "Paste it in Gmail Settings",
          text: "Open Gmail → Settings → See all settings → General → Signature. Paste, then click Save Changes.",
        },
      ],
    },
    keyword: "free email signature generator",
    category: "Email writing",
    date: "2026-09-06",
    updated: "2026-09-06",
    faq: [
      {
        q: "Is this email signature generator free?",
        a: "Yes. It runs in your browser, needs no signup, and never sends or stores what you type.",
      },
      {
        q: "How do I add this signature in Gmail?",
        a: "Open Gmail → Settings → See all settings → General → Signature. Paste the copied text, then scroll down and click Save Changes.",
      },
      {
        q: "Why is this a plain-text signature?",
        a: "Plain text survives every client and avoids the bulky HTML blocks that look broken in Gmail. Keep it short: name, role, one contact line.",
      },
    ],
    relatedToolSlugs: ["email-subject-line-tester", "gmail-unsubscribe"],
    relatedArticleSlugs: ["email-subject-line-length"],
    cta: {
      headline: "A signature is the easy part",
      body: "Inbox Wingman triages your Gmail and drafts replies in your voice — you just review and send. 14-day free trial, no card.",
      href: "/login",
      label: "Start free trial",
    },
  },
  {
    slug: "gmail-unsubscribe",
    name: "Gmail Unsubscribe Helper",
    tagline:
      "Paste noisy senders, get a keep / filter / unsubscribe suggestion, and copy a Gmail search you can run yourself.",
    description:
      "Free Gmail unsubscribe helper: paste senders, get unsubscribe vs filter suggestions, and copy a from: search. Nothing is sent to a server.",
    definition:
      "A Gmail unsubscribe helper reviews a list of senders and suggests unsubscribe, filter, or keep — then gives you a from: search to run in Gmail yourself.",
    notThis: [
      "It never opens Gmail, never clicks Unsubscribe, and never sends email.",
      "It is not a bulk unsubscriber or inbox cleaner.",
      "Suggestions are heuristics — you decide what to keep.",
    ],
    howTo: {
      name: "How to unsubscribe from emails in Gmail",
      totalTime: "PT3M",
      steps: [
        {
          name: "Paste senders",
          text: "List noisy senders one per line — an address, a domain, or a From line.",
        },
        {
          name: "Read the suggestion",
          text: "Unsubscribe marketing and noreply lists. Filter invoices and receipts so they skip the inbox. Keep people you actually write back to.",
        },
        {
          name: "Copy the Gmail query",
          text: "Copy the from: search the helper builds.",
        },
        {
          name: "Finish in Gmail",
          text: "Paste the query into Gmail search. Open a message and use Gmail’s Unsubscribe link when it appears. Do not reply “stop”.",
        },
      ],
    },
    keyword: "gmail unsubscribe",
    category: "Inbox cleanup",
    date: "2026-09-06",
    updated: "2026-09-06",
    faq: [
      {
        q: "Does this tool unsubscribe me automatically?",
        a: "No. It never opens Gmail, never clicks unsubscribe links, and never sends email. You copy a search and finish the steps in Gmail.",
      },
      {
        q: "How do I unsubscribe in Gmail?",
        a: "Open a message from that sender. If Gmail shows an Unsubscribe link next to the address, use that. Do not reply “stop” or “unsubscribe” — those replies often bounce or confirm the address.",
      },
      {
        q: "When should I filter instead of unsubscribe?",
        a: "Keep receipts, invoices, and billing mail. Filter them so they skip the inbox and land in a label. Unsubscribe from newsletters and noreply marketing you never open.",
      },
    ],
    relatedToolSlugs: ["email-signature-generator", "email-subject-line-tester"],
    relatedArticleSlugs: ["unsubscribe-on-gmail"],
    cta: {
      headline: "Unsubscribing is a start. Triage is the habit.",
      body: "Inbox Wingman sorts what still arrives, drafts the replies that matter, and leaves newsletters out of your morning. 14-day free trial, no card.",
      href: "/login",
      label: "Start free trial",
    },
  },
];

export function getFreeTool(slug: string): FreeTool | null {
  return FREE_TOOLS.find((t) => t.slug === slug) ?? null;
}
