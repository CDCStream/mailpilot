import { eq } from "drizzle-orm";
import { db, blogArticles } from "@/lib/db";

export type OutrankArticle = {
  id?: unknown;
  title?: unknown;
  slug?: unknown;
  content_markdown?: unknown;
  meta_description?: unknown;
  image_url?: unknown;
  tags?: unknown;
  created_at?: unknown;
};

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeSlug(raw: unknown): string | null {
  const slug = String(raw ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug || slug.length > 120 || !SLUG_RE.test(slug)) return null;
  return slug;
}

function asTags(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean).slice(0, 20) : [];
}

function publishedAt(value: unknown): Date {
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export function extractArticles(body: unknown): OutrankArticle[] {
  if (!body || typeof body !== "object") return [];
  const event = body as { event_type?: unknown; data?: unknown };
  const data = event.data;
  if (!data || typeof data !== "object") return [];
  const payload = data as { articles?: unknown; article?: unknown };

  if (event.event_type === "update_article" && payload.article && typeof payload.article === "object") {
    return [payload.article as OutrankArticle];
  }
  if (Array.isArray(payload.articles)) {
    return payload.articles.filter((a): a is OutrankArticle => !!a && typeof a === "object");
  }
  return [];
}

/** Upsert one Outrank article. File-based slugs are left alone by the reader. */
export async function upsertOutrankArticle(raw: OutrankArticle): Promise<{ slug: string } | { error: string }> {
  const slug = normalizeSlug(raw.slug);
  const title = String(raw.title ?? "").trim();
  if (!slug) return { error: "invalid slug" };
  if (!title) return { error: "missing title" };

  const description = String(raw.meta_description ?? "").trim().slice(0, 200);
  const content = String(raw.content_markdown ?? "");
  const tags = asTags(raw.tags);
  const imageUrl = raw.image_url ? String(raw.image_url) : null;
  const outrankId = raw.id != null ? String(raw.id) : null;
  const published = publishedAt(raw.created_at);

  const values = {
    outrankId,
    slug,
    title,
    description,
    content,
    tags,
    imageUrl,
    status: "published" as const,
    publishedAt: published,
    updatedAt: new Date(),
  };

  const existing = await db
    .select({ id: blogArticles.id, publishedAt: blogArticles.publishedAt })
    .from(blogArticles)
    .where(eq(blogArticles.slug, slug))
    .limit(1);

  if (existing[0]) {
    await db
      .update(blogArticles)
      .set({
        ...values,
        publishedAt: existing[0].publishedAt,
      })
      .where(eq(blogArticles.slug, slug));
  } else {
    await db.insert(blogArticles).values(values);
  }

  return { slug };
}
