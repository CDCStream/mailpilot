import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentCta } from "@/components/content-cta";
import { MarketingShell } from "@/components/marketing-shell";
import { SignatureGenerator } from "@/components/tools/signature-generator";
import { SubjectLineChecker } from "@/components/tools/subject-line-checker";
import { UnsubscribeHelper } from "@/components/tools/unsubscribe-helper";
import { getArticle } from "@/lib/blog";
import { FREE_TOOLS, getFreeTool, type FreeTool } from "@/lib/free-tools";
import {
  absoluteUrl,
  breadcrumbLd,
  clipMetaDescription,
  faqPageLd,
  formatDisplayDate,
  jsonLd,
  organizationLd,
  SITE_LOGO,
  SITE_NAME,
  SITE_URL,
} from "@/lib/seo";

/** Maps a tool slug to its interactive client component. */
const TOOL_COMPONENTS: Record<string, React.ComponentType> = {
  "email-subject-line-tester": SubjectLineChecker,
  "email-signature-generator": SignatureGenerator,
  "gmail-unsubscribe": UnsubscribeHelper,
};

type Params = { slug: string };

function toolUrl(slug: string): string {
  return `${SITE_URL}/tools/${slug}`;
}

function webApplicationLd(tool: FreeTool): Record<string, unknown> {
  const url = toolUrl(tool.slug);
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.name,
    description: tool.description,
    url,
    image: SITE_LOGO,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript. Runs in a modern web browser.",
    isAccessibleForFree: true,
    featureList: tool.howTo.steps.map((s) => s.name),
    datePublished: tool.date,
    dateModified: tool.updated,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    publisher: organizationLd(),
  };
}

function howToLd(tool: FreeTool): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: tool.howTo.name,
    description: tool.definition,
    totalTime: tool.howTo.totalTime,
    image: SITE_LOGO,
    tool: { "@type": "HowToTool", name: tool.name, url: toolUrl(tool.slug) },
    step: tool.howTo.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
}

function faqLd(tool: FreeTool): Record<string, unknown> | null {
  return faqPageLd(tool.faq);
}

export function generateStaticParams(): Params[] {
  return FREE_TOOLS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tool = getFreeTool(slug);
  if (!tool) return {};
  const url = toolUrl(tool.slug);
  const image = { url: SITE_LOGO, alt: SITE_NAME };
  const description = clipMetaDescription(tool.description);
  return {
    title: `${tool.name} — ${SITE_NAME}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: tool.name,
      description,
      url,
      type: "website",
      siteName: SITE_NAME,
      images: [image],
    },
    twitter: {
      card: "summary",
      title: tool.name,
      description,
      images: [absoluteUrl("/logo.png")],
    },
  };
}

export default async function ToolPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const tool = getFreeTool(slug);
  const ToolComponent = TOOL_COMPONENTS[slug];
  if (!tool || !ToolComponent) notFound();

  const relatedTools = tool.relatedToolSlugs
    .map((s) => getFreeTool(s))
    .filter((t): t is NonNullable<typeof t> => t !== null);
  const relatedArticles = (
    await Promise.all(tool.relatedArticleSlugs.map((s) => getArticle(s)))
  ).filter((a): a is NonNullable<typeof a> => a !== null);

  const crumbs = breadcrumbLd([
    { name: "Home", url: SITE_URL },
    { name: "Free tools", url: `${SITE_URL}/tools` },
    { name: tool.name, url: toolUrl(tool.slug) },
  ]);
  const faq = faqLd(tool);

  return (
    <MarketingShell wide>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(webApplicationLd(tool)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(howToLd(tool)) }}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(crumbs) }} />
      {faq && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(faq) }} />
      )}

      <nav aria-label="Breadcrumb" className="text-sm text-zinc-500">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-zinc-900">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/tools" className="hover:text-zinc-900">
              Free tools
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-zinc-700">{tool.name}</li>
        </ol>
      </nav>

      <p className="mt-6 text-sm font-medium uppercase tracking-widest text-teal-700">
        {tool.category}
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-900">{tool.name}</h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-600">{tool.tagline}</p>
      <p className="mt-2 text-sm text-zinc-500">
        Updated {formatDisplayDate(tool.updated)} · Free · Runs in your browser
      </p>

      <p className="mt-6 max-w-3xl text-base leading-relaxed text-zinc-700">{tool.definition}</p>

      <div className="mt-8 max-w-3xl">
        <ToolComponent />
      </div>

      <section className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{tool.howTo.name}</h2>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-zinc-700">
          {tool.howTo.steps.map((s) => (
            <li key={s.name}>
              <span className="font-semibold text-zinc-900">{s.name}.</span> {s.text}
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-12 max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900">What this tool is not</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-zinc-700">
          {tool.notThis.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      {tool.faq.length > 0 && (
        <section className="mt-12 max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
            Frequently asked questions
          </h2>
          <div className="mt-4 space-y-4">
            {tool.faq.map((f) => (
              <div key={f.q} className="rounded-2xl border border-zinc-200 p-5">
                <h3 className="font-semibold text-zinc-900">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(relatedTools.length > 0 || relatedArticles.length > 0) && (
        <section className="mt-12 max-w-3xl">
          <h2 className="text-lg font-semibold text-zinc-900">Related</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {relatedTools.map((t) => (
              <Link
                key={t.slug}
                href={`/tools/${t.slug}`}
                className="rounded-2xl border border-zinc-200 p-5 hover:border-zinc-300"
              >
                <p className="text-xs uppercase tracking-wider text-teal-700">Free tool</p>
                <p className="mt-1 font-semibold text-zinc-900">{t.name}</p>
              </Link>
            ))}
            {relatedArticles.map((a) => (
              <Link
                key={a.slug}
                href={`/blog/${a.slug}`}
                className="rounded-2xl border border-zinc-200 p-5 hover:border-zinc-300"
              >
                <p className="text-xs uppercase tracking-wider text-teal-700">From the blog</p>
                <p className="mt-1 font-semibold text-zinc-900">{a.title}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="max-w-3xl">
        <ContentCta {...tool.cta} />
      </div>
    </MarketingShell>
  );
}
