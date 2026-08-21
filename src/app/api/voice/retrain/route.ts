import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { buildVoiceProfile } from "@/lib/ai";
import { db, emailAccounts, users } from "@/lib/db";
import { getGmailClient, listRecentSentTexts } from "@/lib/gmail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const account = await db.query.emailAccounts.findFirst({
      where: and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, "active")),
    });
    if (!account) return NextResponse.json({ ok: false, error: "No Gmail account" }, { status: 200 });

    const gmail = getGmailClient(account.refreshTokenEnc);
    const samples = await listRecentSentTexts(gmail, account.email, 40);
    const profile = await buildVoiceProfile(samples);
    await db.update(users).set({ voiceProfile: profile }).where(eq(users.id, userId));
    return NextResponse.json({ ok: true, retrained: samples.length });
  } catch (err) {
    console.error("voice retrain failed", err);
    return NextResponse.json({ ok: false, error: "Retrain failed" }, { status: 200 });
  }
}
