import { ALTERNATIVES } from "@/lib/alternatives";
import { getPublishedFileArticles } from "@/lib/blog";
import { FREE_TOOLS } from "@/lib/free-tools";
import {
  CREDIT_COSTS,
  EARLY_BIRD_SEATS,
  PLANS,
  TRIAL_CREDITS,
  TRIAL_DAYS,
} from "@/lib/plans";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { USE_CASE_HUB, USE_CASES } from "@/lib/use-cases";

/** llmstxt.org files for answer engines. File-only — no database. */

const CACHE = "public, s-maxage=3600, stale-while-revalidate=86400";

export function llmsTxtResponse(body: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": CACHE,
    },
  });
}

function pricingBlurb(): string {
  const p = PLANS.pilot;
  const w = PLANS.wingman;
  return [
    `Pilot $${p.priceMonthly}/mo early-bird (list $${p.listMonthly}) — ${p.credits} credits, ${p.maxAccounts} Gmail accounts. ${p.tagline}.`,
    `Wingman $${w.priceMonthly}/mo early-bird (list $${w.listMonthly}) — ${w.credits} credits, ${w.maxAccounts} Gmail accounts. ${w.tagline}.`,
    `Early-bird prices are for the first ${EARLY_BIRD_SEATS} customers. ${TRIAL_DAYS}-day free trial with ${TRIAL_CREDITS} credits, no card.`,
    `Triage is free. Credits: draft ${CREDIT_COSTS.draft}, brief ${CREDIT_COSTS.brief}, ask ${CREDIT_COSTS.ask}. Top-ups need an active plan and never expire.`,
  ].join(" ");
}

export function buildLlmsTxt(): string {
  const articles = getPublishedFileArticles();

  const product = [
    `- [Home](${SITE_URL}/): AI email assistant for Gmail. Triage, voice-matched drafts, daily brief. Never sends without you.`,
    `- [Features](${SITE_URL}/features): Smart triage, drafts, daily brief, Ask inbox, rules, multi-inbox Gmail.`,
    `- [Compare](${SITE_URL}/compare): Gmail add-on vs doing it manually vs a full AI client.`,
    `- [Alternatives](${SITE_URL}/alternatives): Inbox Wingman vs Fyxer and vs AI Emaily.`,
    `- [Use cases](${SITE_URL}/use-cases): Freelance developers and small studios.`,
    ...USE_CASES.map(
      (c) => `- [${c.nameH1}](${SITE_URL}/use-cases/${c.slug}): ${c.tagline}`,
    ),
    `- [Docs](${SITE_URL}/docs): How the product works.`,
    `- [About](${SITE_URL}/about): Company and product principles.`,
    `- [Security](${SITE_URL}/security): Privacy and security posture.`,
    `- [Pricing](${SITE_URL}/#pricing): ${pricingBlurb()}`,
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
- [llms-full.txt](${SITE_URL}/llms-full.txt): the same pages inlined
`;
}

function bullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function faqBlock(items: { q: string; a: string }[]): string {
  return items.map((item) => `### ${item.q}\n\n${item.a}`).join("\n\n");
}

export function buildLlmsFullTxt(): string {
  const articles = getPublishedFileArticles();
  const p = PLANS.pilot;
  const w = PLANS.wingman;

  const features = [
    [
      "Smart triage",
      "Every incoming message is classified the moment it lands and labeled inside Gmail: To Respond, FYI, Newsletter, Marketing, Notification, Cold Email, Money, Security. Optional auto-archive for low-priority noise.",
    ],
    [
      "Voice-matched drafts",
      "Wingman learns your tone from sent mail and drops a ready-to-send reply into the thread. You review, edit, and send. It never sends for you.",
    ],
    [
      "Daily brief",
      "One morning email: replies you owe, deadlines and action items extracted from your mail, key takeaways from your newsletters, and bills and deliveries — every item deep-linked to the thread in Gmail.",
    ],
    [
      "Ask your inbox",
      "Chat with your whole inbox in plain language. Answers come from your triaged mail with conversation memory, never invented (uses AI credits).",
    ],
    [
      "Rules and templates",
      "Write rules in plain English, or use one-click templates — archive newsletters, skip cold-email drafts, star a VIP domain. Applied on every triage.",
    ],
    [
      "Multi-inbox Gmail",
      `Connect up to ${p.maxAccounts} Gmail accounts on Pilot, or ${w.maxAccounts} on Wingman.`,
    ],
    [
      "Credit-based AI",
      `Triage is unlimited and free. A voice draft costs ${CREDIT_COSTS.draft} credits, a daily brief ${CREDIT_COSTS.brief}, Ask inbox ${CREDIT_COSTS.ask}.`,
    ],
    [
      "Private by design",
      "We store labels and metadata, not full email bodies. Tokens are encrypted at rest. Your mail is never used to train models.",
    ],
  ]
    .map(([title, body]) => `### ${title}\n\n${body}`)
    .join("\n\n");

  const compareRows = [
    ["Works inside Gmail", "Yes", "Yes", "No — new inbox"],
    ["AI triage labels", "Yes", "You", "Varies"],
    ["Voice-matched drafts", "Yes", "You", "Sometimes"],
    ["Sends without you", "Never", "You", "Often optional"],
    ["Credit-based cost control", "Yes", "n/a", "Rare"],
    ["Ask your inbox (AI chat)", "Yes", "n/a", "Rare"],
    ["Learning curve", "Minutes", "Years of pain", "Days–weeks"],
  ]
    .map(
      ([label, wingman, manual, client]) =>
        `- ${label}: Inbox Wingman — ${wingman}; manual Gmail — ${manual}; full AI client — ${client}`,
    )
    .join("\n");

  const useCases = [
    ...USE_CASES.map((c) => {
      const pains = c.pains.map((p) => `- ${p.title}: ${p.body}`).join("\n");
      const scenes = c.scenes.map((s) => `- ${s.title}: ${s.body}`).join("\n");
      return `### ${c.nameH1}\n\nSource: ${SITE_URL}/use-cases/${c.slug}\n\n${c.intro}\n\nPains:\n${pains}\n\nWhat Wingman does:\n${scenes}`;
    }),
    ...USE_CASE_HUB.filter((c) => !c.href).map((c) => `### ${c.title}\n\n${c.body}`),
  ].join("\n\n");

  const alternatives = ALTERNATIVES.map((a) => {
    const rows = a.rows
      .map((row) => `- ${row.label}: Inbox Wingman — ${row.us}; ${a.name} — ${row.them}`)
      .join("\n");
    return `### ${a.nameH1}

${a.definition}

${a.tagline}

Facts about ${a.name} are from ${a.websiteLabel} as of ${a.updated}. Do not treat this as ${a.name}'s own docs.

${rows}

Choose Inbox Wingman when:
${bullets(a.whenUs)}

Choose ${a.name} when:
${bullets(a.whenThem)}

${faqBlock(a.faq)}
`;
  }).join("\n");

  const tools = FREE_TOOLS.map((t) => {
    const steps = t.howTo.steps.map((s, i) => `${i + 1}. ${s.name}: ${s.text}`).join("\n");
    return `### ${t.name}

${t.definition}

${t.tagline}

Not this:
${bullets(t.notThis)}

${t.howTo.name}:
${steps}

${faqBlock(t.faq)}
`;
  }).join("\n");

  const blog = articles
    .map(
      (a) => `### ${a.title}

Source: ${SITE_URL}/blog/${a.slug}

${a.content.trim()}
`,
    )
    .join("\n");

  return `# ${SITE_NAME}

> AI email assistant for Gmail. Triage incoming mail, draft replies in your voice, and send one morning brief. Never sends without you. Gmail only.

${SITE_NAME} is for freelance developers and small studios. It lives inside Gmail. It does not train on customer mail. It is not an Outlook or Yahoo client, not an autopilot sender, and not a bulk unsubscriber.

The free tools on this site run entirely in the browser. They do not connect to Gmail, do not store input, and do not send email.

This file inlines the marketing pages linked from [llms.txt](${SITE_URL}/llms.txt). Legal pages stay at their URLs.

## Product

Inbox Wingman is an AI email assistant that lives inside Gmail. We started it because busy founders and operators do not need another inbox — they need triage, drafts that sound like them, and a morning brief without the babysitting.

Product principles: never send without you, meter AI so costs stay predictable, and stay honest about privacy. No autopilot spam, no training on your mail. Gmail only — shipping fast.

## Features

${features}

## Pricing

${pricingBlurb()}

- Pilot features: ${p.features.join("; ")}
- Wingman features: ${w.features.join("; ")}

## Compare

Wingman is a Gmail add-on, not another inbox. You stay where you already work.

${compareRows}

- Is Inbox Wingman a new inbox? No. It is a Gmail add-on. Labels and drafts appear in Gmail.
- Does it send email without you? Never.
- Named-product pages: [Fyxer](${SITE_URL}/alternatives/fyxer), [AI Emaily](${SITE_URL}/alternatives/aiemaily). Competitor facts there are taken from their public sites.

## Use cases

Built for people who get 50+ emails a day and still need to sound human.

${useCases}

## Docs

1. Connect Gmail — Sign in with Google and grant gmail.modify so Wingman can apply labels and create drafts. Add a test user in Google Cloud while the app is in testing mode.
2. Onboarding — We create colored Gmail labels (To Respond, FYI, Notification, and the rest), learn your voice from recent sent mail, and triage a sample of your inbox.
3. Credits — The ${TRIAL_DAYS}-day trial includes ${TRIAL_CREDITS} credits. Costs: triage ${CREDIT_COSTS.triage} · draft ${CREDIT_COSTS.draft} · brief ${CREDIT_COSTS.brief} · ask ${CREDIT_COSTS.ask}. Top-ups need an active plan and never expire.
4. Rules — Open Rules and add plain English or a template. Rules run on every new message after classification.
5. Extra Gmail accounts — Settings → Connect Gmail. Limits depend on your plan. Each account gets its own labels and sync.

## Security

Inbox Wingman is Google Verified and CASA Tier 2 AL1 accredited (In Compliance, TAC Security / App Defense Alliance).

- Your mail is never used to train general AI models — ours or anyone else's.
- Gmail refresh tokens are encrypted at rest with AES-256-GCM. Access tokens are never stored.
- We keep metadata and short summaries — not full message bodies.
- Classification and drafting go through OpenAI via its API. Provider data is not used to train their models; they may retain it briefly (up to 30 days) for abuse monitoring.
- Use of Gmail data adheres to the Google API Services User Data Policy, including Limited Use.
- Legal: [Privacy](${SITE_URL}/privacy), [Terms](${SITE_URL}/terms), [DPA](${SITE_URL}/dpa), [Sub-processors](${SITE_URL}/subprocessors), [Secrets](${SITE_URL}/security/secrets).

## Alternatives

Named-product comparisons. Competitor facts come from their public sites as of each page's updated date.

${alternatives}

## Free tools

Index: ${SITE_URL}/tools

${tools}

## Blog

${blog || "No published articles yet."}

## Contact

- Email: support@inboxwingman.com
- [Contact](${SITE_URL}/contact)

## Optional

- [llms.txt](${SITE_URL}/llms.txt): curated index
- [llms-full.txt](${SITE_URL}/llms-full.txt): this file
`;
}
