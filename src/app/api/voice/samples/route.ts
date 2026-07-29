import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, emailAccounts, users } from "@/lib/db";
import { getGmailClient, getSentTextsByIds, listSentSamples } from "@/lib/gmail";
import { buildVoiceProfile } from "@/lib/ai";

async function activeAccount(userId: string) {
  return db.query.emailAccounts.findFirst({
    where: and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, "active")),
  });
}

/** Lists recent sent emails the user can pick as voice-training samples. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await activeAccount(userId);
  if (!account) return NextResponse.json({ error: "No Gmail account connected" }, { status: 400 });

  const gmail = getGmailClient(account.refreshTokenEnc);
  try {
    const samples = await listSentSamples(gmail);
    return NextResponse.json({ samples });
  } catch (err) {
    // Token saved without the gmail.modify scope — the user must reconnect Google.
    if ((err as { code?: number })?.code === 403) {
      return NextResponse.json({ error: "gmail-permission" }, { status: 403 });
    }
    throw err;
  }
}

/** Rebuilds the voice profile from the user's hand-picked sent emails. */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body?.messageIds)
    ? body.messageIds.filter((v: unknown) => typeof v === "string").slice(0, 15)
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Pick at least one email" }, { status: 400 });
  }

  const account = await activeAccount(userId);
  if (!account) return NextResponse.json({ error: "No Gmail account connected" }, { status: 400 });

  const gmail = getGmailClient(account.refreshTokenEnc);
  const samples = await getSentTextsByIds(gmail, account.email, ids);
  if (samples.length === 0) {
    return NextResponse.json({ error: "Those emails could not be read" }, { status: 400 });
  }

  const profile = await buildVoiceProfile(samples);
  await db.update(users).set({ voiceProfile: profile }).where(eq(users.id, userId));
  return NextResponse.json({ ok: true, trainedOn: samples.length });
}
