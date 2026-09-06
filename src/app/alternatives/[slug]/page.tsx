import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentCta } from "@/components/content-cta";
import { MarketingShell } from "@/components/marketing-shell";
import { ALTERNATIVES, getAlternative, type Alternative } from "@/lib/alternatives";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";
import {
  breadcrumbLd,
  clipMetaDescription,
  formatDisplayDate,
  jsonLd,
  organizationLd,
  OG_IMAGE,
  shareImages,
  SITE_LOGO,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";

type Params = { slug: string };

function pageUrl(slug: string): string {
  return `${SITE_URL}/alternatives/${slug}`;
}

function faqLd(alt: Alternative): Record<string, unknown> | null {
  if (alt.faq.length === 0) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: alt.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function generateStaticParams(): Params[] {
  return ALTERNATIVES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const alt = getAlternative(slug);
  if (!alt) return {};
  const url = pageUrl(alt.slug);
  const description = clipMetaDescription(alt.description);
  return {
    title: `${alt.nameH1} — ${SITE_NAME}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: alt.nameH1,
      description,
      url,
      type: "website",
      siteName: SITE_NAME,
      images: shareImages(alt.nameH1),
    },
    twitter: {
      card: "summary_large_image",
      title: alt.nameH1,
      description,
      images: [OG_IMAGE.url],
    },
  };
}

export default async function AlternativePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const alt = getAlternative(slug);
  if (!alt) notFound();

  const related = alt.relatedSlugs
    .map((s) => getAlternative(s))
    .filter((a): a is Alternative => a !== null);

  const crumbs = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "Alternatives", url: `${SITE_URL}/alternatives` },
    { name: alt.nameH1, url: pageUrl(alt.slug) },
  ]);

  const pageLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: alt.nameH1,
    description: alt.description,
    url: pageUrl(alt.slug),
    datePublished: alt.date,
    dateModified: alt.updated,
    publisher: organizationLd(),
    about: [
      { "@type": "SoftwareApplication", name: SITE_NAME, url: SITE_URL },
      { "@type": "SoftwareApplication", name: alt.name, url: alt.websiteHref },
    ],
  });

  const faq = faqLd(alt);

  return (
    <MarketingShell wide>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: pageLd }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(crumbs) }} />
      {faq && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faq) }} />}

      <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-zinc-900">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/alternatives" className="hover:text-zinc-900">
              Alternatives
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-zinc-700">{alt.name}</li>
        </ol>
      </nav>

      <p className="mt-6 text-sm font-medium uppercase tracking-widest text-teal-700">
        vs {alt.name}
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-900">{alt.nameH1}</h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-600">{alt.tagline}</p>
      <p className="mt-2 text-sm text-zinc-500">
        Updated {formatDisplayDate(alt.updated)} ·{" "}
        <a href={alt.websiteHref} className="underline hover:text-zinc-800" rel="nofollow noopener">
          {alt.websiteLabel}
        </a>
      </p>

      <p className="mt-6 max-w-3xl text-base leading-relaxed text-zinc-700">{alt.definition}</p>

      <div className="mt-10 overflow-x-auto rounded-2xl border border-zinc-200">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Capability</th>
              <th className="px-4 py-3 font-medium text-teal-800">{SITE_NAME}</th>
              <th className="px-4 py-3 font-medium">{alt.name}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {alt.rows.map((r) => (
              <tr key={r.label}>
                <td className="px-4 py-3 font-medium text-zinc-900">{r.label}</td>
                <td className="px-4 py-3 text-teal-800">{r.us}</td>
                <td className="px-4 py-3 text-zinc-600">{r.them}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-3xl text-xs text-zinc-500">
        Wingman Pilot is ${PLANS.pilot.priceMonthly}/mo early bird ({TRIAL_DAYS}-day trial, no card).
        Rival prices are what they published on {formatDisplayDate(alt.updated)} — confirm on their
        site.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Pick Inbox Wingman if</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700">
            {alt.whenUs.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-zinc-200 p-6">
          <h2 className="text-lg font-semibold text-zinc-900">Pick {alt.name} if</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700">
            {alt.whenThem.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      </div>

      {alt.faq.length > 0 && (
        <section className="mt-12 max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
            Frequently asked questions
          </h2>
          <div className="mt-4 space-y-4">
            {alt.faq.map((f) => (
              <div key={f.q} className="rounded-2xl border border-zinc-200 p-5">
                <h3 className="font-semibold text-zinc-900">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-12 max-w-3xl">
          <h2 className="text-lg font-semibold text-zinc-900">Related comparisons</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/alternatives/${r.slug}`}
                className="rounded-2xl border border-zinc-200 p-5 hover:border-zinc-300"
              >
                <p className="text-xs uppercase tracking-wider text-teal-700">vs {r.name}</p>
                <p className="mt-1 font-semibold text-zinc-900">{r.nameH1}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="max-w-3xl">
        <ContentCta {...alt.cta} />
      </div>
    </MarketingShell>
  );
}
