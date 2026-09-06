/** Canonical base for marketing/SEO surfaces (matches sitemap.ts). */
export const SITE_URL = "https://www.inboxwingman.com";

export const SITE_NAME = "Inbox Wingman";

/** Serialize a JSON-LD object for a <script type="application/ld+json"> tag. */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/** Local `/logo.png` or a remote Outrank image URL → absolute URL for OG/JSON-LD. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
