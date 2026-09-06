import { ALTERNATIVES } from "@/lib/alternatives";
import { getPublishedFileArticles } from "@/lib/blog";
import { FREE_TOOLS } from "@/lib/free-tools";
import { SITE_NAME, SITE_URL } from "@/lib/seo";

/** llmstxt.org summary for answer engines. File-only — no database. */
export function buildLlmsTxt(): string {
  const articles = getPublishedFileArticles();

  const product = [
    `- [Home](${SITE_URL}/): AI email assistant for Gmail. Triage, voice-matched drafts, daily brief. Never sends without you.`,
    `- [Features](${SITE_URL}/features): Smart triage, drafts, daily brief, Ask inbox, rules, multi-inbox Gmail.`,
    `- [Compare](${SITE_URL}/compare): Gmail add-on vs doing it manually vs a full AI client.`,
    `- [Alternatives](${SITE_URL}/alternatives): Inbox Wingman vs Fyxer and vs AI Emaily.`,
    `- [Use cases](${SITE_URL}/use-cases): Freelance developers and small studios.`,
    `- [Docs](${SITE_URL}/docs): How the product works.`,
    `- [About](${SITE_URL}/about): Company and product principles.`,
    `- [Security](${SITE_URL}/security): Privacy and security posture.`,
    `- [Pricing](${SITE_URL}/#pricing): Pilot and Wingman plans. 14-day free trial, no card.`,
  ].join("\n");

  const tools = FREE_TOOLS.map(
    (t) => `- [${t.name}](${SITE_URL}/tools/${t.slug}): ${t.definition}`,
  ).join("\n");

  const alternatives = ALTERNATIVES.map(
    (a) => `- [${a.nameH1}](${SITE_URL}/alternatives/${a.slug}): ${a.definition}`,
  ).join("\n");

  const blog = articles
    .map((a) => `- [${a.title}](${SITE_URL}/blog/${a.slug}): ${a.description}`)
    .join("\n");

  return `# ${SITE_NAME}

> AI email assistant for Gmail. Triage incoming mail, draft replies in your voice, and send one morning brief. Never sends without you. Gmail only.

${SITE_NAME} is for freelance developers and small studios. It lives inside Gmail. It does not train on customer mail. It is not an Outlook or Yahoo client, not an autopilot sender, and not a bulk unsubscriber.

The free tools on this site run entirely in the browser. They do not connect to Gmail, do not store input, and do not send email.

## Product

${product}

## Alternatives

- [Alternatives](${SITE_URL}/alternatives): Named-product comparisons.
${alternatives}

## Free tools

- [Free email tools](${SITE_URL}/tools): Index of no-signup utilities.
${tools}

## Blog

- [Blog](${SITE_URL}/blog): Guides on Gmail, subjects, and inbox cleanup.
${blog || "- No published articles yet."}

## Contact

- Email: support@inboxwingman.com
- [Contact](${SITE_URL}/contact)
- [Privacy](${SITE_URL}/privacy) / [Terms](${SITE_URL}/terms)

## Optional

- [llms.txt](${SITE_URL}/llms.txt): this file
`;
}
