import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { parseRule } from "@/lib/ai";
import { db, rules } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const instruction = String(body?.instruction ?? "").trim();
  if (!instruction || instruction.length > 300) {
    return NextResponse.json({ ok: false, error: "Write a rule (max 300 characters)." }, { status: 400 });
  }

  try {
    const parsed = await parseRule(instruction);
    await db.insert(rules).values({ userId, instruction, parsed });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("add rule failed", err);
    return NextResponse.json({ ok: false, error: "Could not add that rule." }, { status: 200 });
  }
}
