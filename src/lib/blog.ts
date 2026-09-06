import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

/**
 * File-based blog: one markdown file per article in content/blog/*.md.
 * Frontmatter is the single source of truth; no database, no CMS.
 * Kept schema-compatible with an Outrank-style webhook (title, slug,
 * content markdown, meta description, image, tags) for a later ingest.
 */

export type ArticleFaq = { q: string; a: string };

export type ArticleCta = {
  headline: string;
  body: string;
  href: string;
  label: string;
};

export type ArticleStatus = "draft" | "review" | "published";

export type Article = {
  title: string;
  slug: string;
  description: string;
  keyword: string;
  secondaryKeywords: string[];
  tags: string[];
  category: string;
  date: string;
  updated: string | null;
  author: string;
  status: ArticleStatus;
  featuredImage: string;
  featuredImageAlt: string;
  canonical: string | null;
  faq: ArticleFaq[];
  relatedSlugs: string[];
  relatedToolSlugs: string[];
  cta: ArticleCta;
  /** Markdown body (below the frontmatter). */
  content: string;
  readingMinutes: number;
};

const BLOG_DIR = path.join(process.cwd(), "content", "blog");

const DEFAULT_CTA: ArticleCta = {
  headline: "Let Wingman triage your Gmail",
  body: "Clients surfaced, bots quieted, drafts in your voice. 14-day free trial, no card.",
  href: "/login",
  label: "Start free trial",
};

function toIsoDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string" && value) return value.slice(0, 10);
  return "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function parseArticle(filePath: string): Article | null {
  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  const slug = String(data.slug || path.basename(filePath).replace(/\.mdx?$/, ""));
  const title = String(data.title || "");
  if (!title || !slug) return null;

  const status: ArticleStatus =
    data.status === "published" || data.status === "review" ? data.status : "draft";

  const faq: ArticleFaq[] = Array.isArray(data.faq)
    ? data.faq
        .map((f: { q?: unknown; a?: unknown }) => ({ q: String(f?.q ?? ""), a: String(f?.a ?? "") }))
        .filter((f: ArticleFaq) => f.q && f.a)
    : [];

  const ctaData = (data.cta ?? {}) as Partial<ArticleCta>;
  const cta: ArticleCta = {
    headline: ctaData.headline || DEFAULT_CTA.headline,
    body: ctaData.body || DEFAULT_CTA.body,
    href: ctaData.href || DEFAULT_CTA.href,
    label: ctaData.label || DEFAULT_CTA.label,
  };

  const words = content.split(/\s+/).filter(Boolean).length;

  return {
    title,
    slug,
    description: String(data.description || ""),
    keyword: String(data.keyword || ""),
    secondaryKeywords: asStringArray(data.secondaryKeywords),
    tags: asStringArray(data.tags),
    category: String(data.category || "Guides"),
    date: toIsoDate(data.date),
    updated: data.updated ? toIsoDate(data.updated) : null,
    author: String(data.author || "Inbox Wingman"),
    status,
    featuredImage: String(data.featuredImage || "/logo.png"),
    featuredImageAlt: String(data.featuredImageAlt || "Inbox Wingman"),
    canonical: data.canonical ? String(data.canonical) : null,
    faq,
    relatedSlugs: asStringArray(data.relatedSlugs),
    relatedToolSlugs: asStringArray(data.relatedToolSlugs),
    cta,
    content,
    readingMinutes: Math.max(1, Math.round(words / 200)),
  };
}

export function getAllArticles(options?: { includeUnpublished?: boolean }): Article[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  const files = fs.readdirSync(BLOG_DIR).filter((f) => /\.mdx?$/.test(f));
  const articles = files
    .map((f) => parseArticle(path.join(BLOG_DIR, f)))
    .filter((a): a is Article => a !== null)
    .filter((a) => options?.includeUnpublished || a.status === "published");
  return articles.sort((a, b) => b.date.localeCompare(a.date));
}

export function getArticle(slug: string): Article | null {
  return getAllArticles().find((a) => a.slug === slug) ?? null;
}
