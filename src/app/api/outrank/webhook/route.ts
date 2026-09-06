import { timingSafeEqual } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextRequest } from "next/server";
import { extractArticles, upsertOutrankArticle } from "@/lib/outrank";

function bearerOk(header: string | null, expected: string): boolean {
  if (!header?.startsWith("Bearer ") || !expected) return false;
  const got = Buffer.from(header.slice(7));
  const want = Buffer.from(expected);
  if (got.length !== want.length) return false;
  return timingSafeEqual(got, want);
}

export async function POST(request: NextRequest) {
  const secret = process.env.OUTRANK_WEBHOOK_TOKEN ?? "";
  if (!secret) {
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  }
  if (!bearerOk(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Invalid access token" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const incoming = extractArticles(body);
  if (incoming.length === 0) {
    return Response.json({ message: "Webhook processed successfully", slugs: [] });
  }

  const slugs: string[] = [];
  for (const article of incoming) {
    const result = await upsertOutrankArticle(article);
    if ("slug" in result) slugs.push(result.slug);
    else console.warn("outrank article skipped:", result.error);
  }

  revalidatePath("/blog");
  revalidatePath("/sitemap.xml");
  for (const slug of slugs) revalidatePath(`/blog/${slug}`);

  return Response.json({ message: "Webhook processed successfully", slugs });
}
