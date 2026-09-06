import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { processNextDraft, writeDraftForMessageId } from "@/lib/draft-writer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Writes the requested message, or the next eligible auto-draft. */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const messageId = String(body?.messageId ?? "");

  try {
    const result = messageId
      ? await writeDraftForMessageId(userId, messageId, { manual: true })
      : await processNextDraft(userId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("draft tick failed", err);
    return NextResponse.json({ status: "error", reason: "tick-error" }, { status: 500 });
  }
}
