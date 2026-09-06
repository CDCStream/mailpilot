import type { Metadata } from "next";

/** Canonical base for marketing/SEO surfaces (matches sitemap.ts). */
export const SITE_URL = "https://www.inboxwingman.com";

export const SITE_NAME = "Inbox Wingman";

/** Google typically displays ~155 characters of a meta description. */
export const META_DESC_MAX = 155;

export function clipMetaDescription(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= META_DESC_MAX) return trimmed;
  return `${trimmed.slice(0, META_DESC_MAX - 1).trimEnd()}…`;
}

/** Unique title, ≤155-char description, canonical, OG image, and Twitter card. */
export function marketingMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const desc = clipMetaDescription(description);
  const url =
    path === "/" || path === ""
      ? SITE_URL
      : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  const images = [{ url: SITE_LOGO, alt: SITE_NAME }];
  return {
    title,
    description: desc,
    alternates: { canonical: url },
    openGraph: {
      title,
      description: desc,
      url,
      type: "website",
      siteName: SITE_NAME,
      images,
    },
    twitter: {
      card: "summary",
      title,
      description: desc,
      images: [SITE_LOGO],
    },
  };
}

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
