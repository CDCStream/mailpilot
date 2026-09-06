/**
 * Registry for free interactive tools served at /tools/[slug].
 * Tools are keyword-led marketing surfaces: each entry owns one tool-keyword,
 * links to related tools/articles, and ends in one product CTA.
 * The interactive component itself is mapped in src/app/tools/[slug]/page.tsx.
 */

export type FreeToolFaq = { q: string; a: string };

export type FreeTool = {
  slug: string;
  /** Page H1, ≤ 60 chars, keyword-natural. */
  name: string;
  /** Short line under the H1. */
  tagline: string;
  /** Meta description, ≤ 155 chars. */
  description: string;
  /** Primary tool-keyword (from KEYWORDS, never invented). */
  keyword: string;
  category: string;
  date: string;
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
    keyword: "email subject line tester",
    category: "Email writing",
    date: "2026-09-06",
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
    relatedToolSlugs: [],
    relatedArticleSlugs: ["email-subject-line-length"],
    cta: {
      headline: "Tired of writing emails at all?",
      body: "Inbox Wingman triages your Gmail and drafts replies in your voice — you just review and send. 14-day free trial, no card.",
      href: "/login",
      label: "Start free trial",
    },
  },
];

export function getFreeTool(slug: string): FreeTool | null {
  return FREE_TOOLS.find((t) => t.slug === slug) ?? null;
}
