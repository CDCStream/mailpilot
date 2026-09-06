import type { MetadataRoute } from "next";

/** App surfaces stay closed. Marketing + AI answer engines stay open. */
const PRIVATE = ["/dashboard/", "/api/", "/onboarding/"];

/**
 * Named allow for the crawlers the launch checklist cares about.
 * Cloudflare currently prepends its own Disallow for GPTBot/ClaudeBot —
 * origin rules only win after that managed block is turned off.
 */
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE,
      },
      {
        userAgent: AI_CRAWLERS,
        allow: "/",
        disallow: PRIVATE,
      },
    ],
    sitemap: "https://www.inboxwingman.com/sitemap.xml",
    host: "https://www.inboxwingman.com",
  };
}
