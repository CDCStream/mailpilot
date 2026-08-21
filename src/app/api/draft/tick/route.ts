import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { processNextDraft } from "@/lib/draft-writer";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Writes one queued or eligible auto-draft. */
export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const result = await processNextDraft(userId);
    return NextResponse.json(result);
  } catch (err) {
    console.error("draft tick failed", err);
    return NextResponse.json({ status: "error", reason: "tick-error" }, { status: 500 });
  }
}
