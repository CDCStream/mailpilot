import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, emailAccounts, users } from "@/lib/db";
import { inngest } from "@/inngest/client";

/** Kicks off the one-time account setup (labels, voice profile, initial triage). */
export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await db.query.emailAccounts.findFirst({
    where: eq(emailAccounts.userId, userId),
  });
  if (!account) {
    return NextResponse.json(
      { error: "No Gmail account connected. Sign in with Google again and grant access." },
      { status: 400 },
    );
  }

  await inngest.send({ name: "app/account.connected", data: { accountId: account.id } });
  return NextResponse.json({ started: true });
}

/** Polled by the onboarding screen to know when setup finished. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const account = await db.query.emailAccounts.findFirst({
    where: eq(emailAccounts.userId, userId),
  });

  return NextResponse.json({
    hasAccount: Boolean(account),
    labelsReady: Boolean(account?.labelMap),
    voiceReady: Boolean(user?.voiceProfile),
    done: Boolean(user?.onboardedAt),
  });
}
