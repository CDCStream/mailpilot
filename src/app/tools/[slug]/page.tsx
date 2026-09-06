import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentCta } from "@/components/content-cta";
import { MarketingShell } from "@/components/marketing-shell";
import { SubjectLineChecker } from "@/components/tools/subject-line-checker";
import { getArticle } from "@/lib/blog";
import { FREE_TOOLS, getFreeTool } from "@/lib/free-tools";
import { jsonLd, SITE_NAME, SITE_URL } from "@/lib/seo";

/** Maps a tool slug to its interactive client component. */
const TOOL_COMPONENTS: Record<string, React.ComponentType> = {
  "email-subject-line-tester": SubjectLineChecker,
};

type Params = { slug: string };

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
  const url = `${SITE_URL}/tools/${tool.slug}`;
  return {
    title: `${tool.name} — ${SITE_NAME}`,
    description: tool.description,
    alternates: { canonical: url },
    openGraph: { title: tool.name, description: tool.description, url, type: "website" },
    twitter: { card: "summary", title: tool.name, description: tool.description },
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

  const appLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.name,
    description: tool.description,
    url: `${SITE_URL}/tools/${tool.slug}`,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  });

  const faqLd =
    tool.faq.length > 0
      ? jsonLd({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: tool.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        })
      : null;

  return (
    <MarketingShell wide>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: appLd }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />}

      <nav className="text-sm text-zinc-500">
        <Link href="/tools" className="hover:text-zinc-900">
          ← Free tools
        </Link>
      </nav>

      <p className="mt-6 text-sm font-medium uppercase tracking-widest text-teal-700">
        {tool.category}
      </p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-900">{tool.name}</h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-600">{tool.tagline}</p>

      <div className="mt-8 max-w-3xl">
        <ToolComponent />
      </div>

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
