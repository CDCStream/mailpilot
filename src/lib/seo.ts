/** Canonical base for marketing/SEO surfaces (matches sitemap.ts). */
export const SITE_URL = "https://www.inboxwingman.com";

export const SITE_NAME = "Inbox Wingman";

/** Serialize a JSON-LD object for a <script type="application/ld+json"> tag. */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
