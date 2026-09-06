import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { desc } from "drizzle-orm";
import { db, blogArticles } from "@/lib/db";

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

function loadFileArticles(): Article[] {
  if (!fs.existsSync(BLOG_DIR)) return [];
  return fs
    .readdirSync(BLOG_DIR)
    .filter((f) => /\.mdx?$/.test(f))
    .map((f) => parseArticle(path.join(BLOG_DIR, f)))
    .filter((a): a is Article => a !== null);
}

/** File-backed published posts only — no database. Used by /llms.txt. */
export function getPublishedFileArticles(): Article[] {
  return loadFileArticles()
    .filter((a) => a.status === "published")
    .sort((a, b) => b.date.localeCompare(a.date));
}

function fromDbRow(row: typeof blogArticles.$inferSelect): Article {
  const date = row.publishedAt.toISOString().slice(0, 10);
  const updated = row.updatedAt.toISOString().slice(0, 10);
  const words = row.content.split(/\s+/).filter(Boolean).length;
  return {
    title: row.title,
    slug: row.slug,
    description: row.description,
    keyword: "",
    secondaryKeywords: [],
    tags: row.tags ?? [],
    category: "Guides",
    date,
    updated: updated !== date ? updated : null,
    author: "Inbox Wingman",
    status: row.status === "published" ? "published" : "draft",
    featuredImage: row.imageUrl || "/logo.png",
    featuredImageAlt: row.title,
    canonical: null,
    faq: [],
    relatedSlugs: [],
    relatedToolSlugs: [],
    cta: DEFAULT_CTA,
    content: row.content,
    readingMinutes: Math.max(1, Math.round(words / 200)),
  };
}

async function loadDbArticles(): Promise<Article[]> {
  try {
    const rows = await db.select().from(blogArticles).orderBy(desc(blogArticles.publishedAt));
    return rows.map(fromDbRow);
  } catch (error) {
    console.error("blog_articles read failed:", error);
    return [];
  }
}

export async function getAllArticles(options?: { includeUnpublished?: boolean }): Promise<Article[]> {
  const [files, dbRows] = await Promise.all([
    Promise.resolve(loadFileArticles()),
    loadDbArticles(),
  ]);
  // File articles win on slug collision so the in-repo stub cannot be overwritten.
  const bySlug = new Map<string, Article>();
  for (const a of dbRows) bySlug.set(a.slug, a);
  for (const a of files) bySlug.set(a.slug, a);
  return [...bySlug.values()]
    .filter((a) => options?.includeUnpublished || a.status === "published")
    .sort((a, b) => b.date.localeCompare(a.date));
}

export async function getArticle(slug: string): Promise<Article | null> {
  return (await getAllArticles()).find((a) => a.slug === slug) ?? null;
}
