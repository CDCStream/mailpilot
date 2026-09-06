import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleMarkdown } from "@/components/article-markdown";
import { ContentCta } from "@/components/content-cta";
import { MarketingShell } from "@/components/marketing-shell";
import { getAllArticles, getArticle } from "@/lib/blog";
import { FREE_TOOLS } from "@/lib/free-tools";
import { JsonLd } from "@/components/json-ld";
import { absoluteUrl, clipMetaDescription, faqPageLd, jsonLd, SITE_NAME, SITE_URL } from "@/lib/seo";

type Params = { slug: string };

export const dynamicParams = true;

export async function generateStaticParams(): Promise<Params[]> {
  return (await getAllArticles()).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return {};
  const url = article.canonical ?? `${SITE_URL}/blog/${article.slug}`;
  const description = clipMetaDescription(article.description);
  const ogImage = {
    url: absoluteUrl(article.featuredImage || "/logo.png"),
    alt: article.featuredImageAlt || SITE_NAME,
  };
  return {
    title: `${article.title} — ${SITE_NAME}`,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: article.title,
      description,
      url,
      type: "article",
      siteName: SITE_NAME,
      publishedTime: article.date,
      modifiedTime: article.updated ?? undefined,
      images: [ogImage],
    },
    twitter: {
      card: "summary",
      title: article.title,
      description,
      images: [ogImage.url],
    },
  };
}

export default async function BlogArticlePage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) notFound();

  const related = (
    await Promise.all(article.relatedSlugs.map((s) => getArticle(s)))
  ).filter((a): a is NonNullable<typeof a> => a !== null);
  const relatedTools = FREE_TOOLS.filter((t) => article.relatedToolSlugs.includes(t.slug));

  const articleLd = jsonLd({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    dateModified: article.updated ?? article.date,
    image: absoluteUrl(article.featuredImage),
    author: { "@type": "Organization", name: article.author, url: SITE_URL },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
    mainEntityOfPage: `${SITE_URL}/blog/${article.slug}`,
  });

  return (
    <MarketingShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: articleLd }} />
      <JsonLd data={faqPageLd(article.faq)} />

      <nav className="text-sm text-zinc-500">
        <Link href="/blog" className="hover:text-zinc-900">
          ← Blog
        </Link>
      </nav>

      <article className="mt-6">
        <p className="text-sm font-medium uppercase tracking-widest text-teal-700">
          {article.category}
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-900">{article.title}</h1>
        <p className="mt-4 text-sm text-zinc-500">
          {new Date(article.date + "T00:00:00Z").toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
          {article.updated ? ` · Updated ${article.updated}` : ""} · {article.readingMinutes} min
          read · {article.author}
        </p>

        <div className="mt-8">
          <ArticleMarkdown content={article.content} />
        </div>
      </article>

      {article.faq.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">
            Frequently asked questions
          </h2>
          <div className="mt-4 space-y-4">
            {article.faq.map((f) => (
              <div key={f.q} className="rounded-2xl border border-zinc-200 p-5">
                <h3 className="font-semibold text-zinc-900">{f.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.a}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {(related.length > 0 || relatedTools.length > 0) && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-zinc-900">Keep reading</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {related.map((r) => (
              <Link
                key={r.slug}
                href={`/blog/${r.slug}`}
                className="rounded-2xl border border-zinc-200 p-5 hover:border-zinc-300"
              >
                <p className="text-xs uppercase tracking-wider text-teal-700">{r.category}</p>
                <p className="mt-1 font-semibold text-zinc-900">{r.title}</p>
              </Link>
            ))}
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
          </div>
        </section>
      )}

      <ContentCta {...article.cta} />
    </MarketingShell>
  );
}
