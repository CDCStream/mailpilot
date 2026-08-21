import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requestDraft } from "@/lib/draft-writer";

export const dynamic = "force-dynamic";

/** Enqueue a manual draft. Generation happens on /api/draft/tick. */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const messageId = String(body?.messageId ?? "");
  if (!messageId) return NextResponse.json({ ok: false, error: "messageId required" }, { status: 400 });

  try {
    const result = await requestDraft(userId, messageId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("draft start failed", err);
    return NextResponse.json({ ok: false, error: "Failed to queue draft" }, { status: 200 });
  }
}
