import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { FREE_TOOLS } from "@/lib/free-tools";
import {
  breadcrumbLd,
  jsonLd,
  marketingMetadata,
  organizationLd,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";

const DESCRIPTION =
  "Free, no-signup Gmail tools: subject line tester, email signature generator, and unsubscribe helper. Everything runs in your browser.";

export const metadata = marketingMetadata({
  title: "Inbox Wingman Free Tools — Subject tester, signature, unsubscribe",
  description: DESCRIPTION,
  path: "/tools",
});

export default function ToolsIndexPage() {
  const collectionLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Free email tools",
    description: DESCRIPTION,
    url: `${SITE_URL}/tools`,
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: SITE_URL },
    publisher: organizationLd(),
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: FREE_TOOLS.length,
      itemListElement: FREE_TOOLS.map((t, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: t.name,
        url: `${SITE_URL}/tools/${t.slug}`,
        description: t.description,
      })),
    },
  });

  const crumbs = jsonLd(
    breadcrumbLd([
      { name: "Home", url: SITE_URL },
      { name: "Free tools", url: `${SITE_URL}/tools` },
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
          <li className="text-zinc-700">Free tools</li>
        </ol>
      </nav>

      <p className="mt-6 text-sm font-medium uppercase tracking-widest text-teal-700">Resources</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Free email tools</h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-600">
        Free email tools from Inbox Wingman: no signup, no Gmail access, nothing stored. Each tool
        runs in your browser and answers one job — test a subject, build a signature, or plan a
        Gmail unsubscribe.
      </p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-500">
        These tools do not connect to your inbox and do not send mail. Inbox Wingman, the product,
        is a separate Gmail assistant that triages mail and drafts replies — it never sends without
        you.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {FREE_TOOLS.map((t) => (
          <Link
            key={t.slug}
            href={`/tools/${t.slug}`}
            className="group rounded-2xl border border-zinc-200 p-6 transition hover:border-zinc-300 hover:shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-teal-700">
              {t.category}
            </p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-900 group-hover:underline">
              {t.name}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{t.definition}</p>
          </Link>
        ))}
      </div>
    </MarketingShell>
  );
}
