import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { ALTERNATIVES } from "@/lib/alternatives";
import {
  breadcrumbLd,
  jsonLd,
  organizationLd,
  SITE_LOGO,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";

const TITLE = "Alternatives — Inbox Wingman vs Fyxer and AI Emaily";
const DESCRIPTION =
  "Honest comparisons: Inbox Wingman vs Fyxer and vs AI Emaily. Gmail add-on, never sends without you. 14-day trial, no card.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/alternatives` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/alternatives`,
    type: "website",
    siteName: SITE_NAME,
    images: [{ url: SITE_LOGO, alt: SITE_NAME }],
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION, images: [SITE_LOGO] },
};

export default function AlternativesIndexPage() {
  const collectionLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Inbox Wingman alternatives",
    description: DESCRIPTION,
    url: `${SITE_URL}/alternatives`,
    publisher: organizationLd(),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: ALTERNATIVES.length,
      itemListElement: ALTERNATIVES.map((a, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: a.nameH1,
        url: `${SITE_URL}/alternatives/${a.slug}`,
        description: a.description,
      })),
    },
  });

  const crumbs = jsonLd(
    breadcrumbLd([
      { name: "Home", url: SITE_URL },
      { name: "Alternatives", url: `${SITE_URL}/alternatives` },
    ]),
  );

  return (
    <MarketingShell wide>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: collectionLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: crumbs }} />

      <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-zinc-900">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-zinc-700">Alternatives</li>
        </ol>
      </nav>

      <p className="mt-6 text-sm font-medium uppercase tracking-widest text-teal-700">Compare</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Inbox Wingman alternatives</h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-600">
        Two products people compare us to: Fyxer (a Gmail/Outlook add-on that never sends) and AI
        Emaily (a new client that can send on Autopilot). We stay in Gmail and never send without
        you.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
        Competitor features and prices are taken from their public sites as of 6 September 2026.
        Check theirs before you buy — they change.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {ALTERNATIVES.map((a) => (
          <Link
            key={a.slug}
            href={`/alternatives/${a.slug}`}
            className="group rounded-2xl border border-zinc-200 p-6 transition hover:border-zinc-300 hover:shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-teal-700">
              vs {a.name}
            </p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-900 group-hover:underline">
              {a.nameH1}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{a.definition}</p>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-sm text-zinc-600">
        Want the product-vs-manual view? See{" "}
        <Link href="/compare" className="font-medium text-zinc-900 underline">
          Compare
        </Link>
        .
      </p>
    </MarketingShell>
  );
}
