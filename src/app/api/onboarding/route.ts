import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import {
  db,
  emailAccounts,
  users,
  DEFAULT_PREFERENCES,
  TONE_PRESET_INSTRUCTIONS,
  type InboxMode,
  type Persona,
  type TonePreset,
} from "@/lib/db";
import { inngest } from "@/inngest/client";

const INBOX_MODES: InboxMode[] = ["focus", "quiet", "label_only"];
const PERSONAS: Persona[] = ["founder", "agency", "sales", "support", "personal"];
const TONE_PRESETS: TonePreset[] = ["warm", "direct", "formal", "playful"];

/** Kicks off the one-time account setup (labels, voice profile, initial triage). */
export async function POST(req: Request) {
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

  // Persist the onboarding choices before the initial triage so they're honored from email #1.
  const body = await req.json().catch(() => ({}));
  const mode = INBOX_MODES.includes(body?.inboxMode) ? (body.inboxMode as InboxMode) : null;
  const persona = PERSONAS.includes(body?.persona) ? (body.persona as Persona) : null;
  const tone = TONE_PRESETS.includes(body?.tonePreset) ? (body.tonePreset as TonePreset) : null;
  const voiceSampleIds: string[] = Array.isArray(body?.voiceSampleIds)
    ? body.voiceSampleIds.filter((v: unknown) => typeof v === "string").slice(0, 15)
    : [];

  if (mode || persona || tone) {
    const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
    const current = user?.preferences ?? DEFAULT_PREFERENCES;
    await db
      .update(users)
      .set({
        preferences: {
          ...current,
          ...(mode ? { inboxMode: mode, archiveLowPriority: mode !== "label_only" } : {}),
          ...(persona ? { persona } : {}),
          ...(tone
            ? {
                tonePreset: tone,
                // Seed the free-form instructions unless the user already wrote their own.
                toneInstructions: current.toneInstructions || TONE_PRESET_INSTRUCTIONS[tone],
              }
            : {}),
        },
      })
      .where(eq(users.id, userId));
  }

  await inngest.send({
    name: "app/account.connected",
    data: { accountId: account.id, voiceSampleIds },
  });
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
