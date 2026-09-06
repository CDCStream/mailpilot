import type { Metadata } from "next";
import { PLANS } from "@/lib/plans";

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
  index = true,
}: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
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
    robots: index ? undefined : { index: false, follow: false },
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

export type FaqItem = { q: string; a: string };

export type BreadcrumbItem = { name: string; url: string };

/** Visible-FAQ pages only — Google requires the same Q&A on the page. */
export function faqPageLd(items: FaqItem[]): Record<string, unknown> | null {
  if (items.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/** Product schema for Inbox Wingman (homepage and other product pages). */
export function softwareApplicationLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: SITE_NAME,
    url: SITE_URL,
    image: SITE_LOGO,
    description:
      "AI Gmail assistant that triages your inbox, drafts replies in your voice, and never sends without you.",
    applicationCategory: "email productivity",
    operatingSystem: "Web",
    browserRequirements: "Requires a Google account with Gmail.",
    featureList: [
      "Gmail triage labels",
      "Voice-matched drafts",
      "Daily brief",
      "Ask your inbox",
      "Plain-English rules",
      "Multi-inbox Gmail",
    ],
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: String(PLANS.pilot.priceMonthly),
      highPrice: String(PLANS.wingman.priceMonthly),
      offerCount: 2,
      availability: "https://schema.org/InStock",
    },
    publisher: organizationLd(),
  };
}

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
