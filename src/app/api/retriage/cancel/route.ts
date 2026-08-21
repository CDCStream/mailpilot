import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requestRetriageCancel } from "@/lib/retriage-enqueue";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await requestRetriageCancel(userId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("retriage cancel failed", err);
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
