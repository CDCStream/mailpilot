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

export const SITE_LOGO = absoluteUrl("/logo.png");

export type BreadcrumbItem = { name: string; url: string };

/** Publisher / org node reused on tool, blog, and CollectionPage JSON-LD. */
export function organizationLd(): Record<string, unknown> {
  return {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: SITE_LOGO },
    email: "support@inboxwingman.com",
  };
}

export function breadcrumbLd(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function formatDisplayDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
