import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, users, DEFAULT_PREFERENCES, TONE_PRESET_INSTRUCTIONS } from "@/lib/db";
import { rebuildVoiceProfile, toggleAutoRetrainVoice } from "../actions";
import { PendingButton } from "../pending-button";
import { VoiceTrainer } from "./voice-trainer";

export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const sp = await searchParams;
  const retrained = typeof sp.retrained === "string" ? Number(sp.retrained) : null;

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const prefs = user?.preferences ?? DEFAULT_PREFERENCES;
  const voice = user?.voiceProfile;

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <h1 className="text-2xl font-bold">AI Training</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Teach Wingman how you write, so every draft sounds like you — not like a bot.
      </p>

      {retrained !== null && (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Done — your voice profile was rebuilt from {retrained} recent sent emails.
        </p>
      )}

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-2">
      <div className="space-y-6">
      <section className="rounded-2xl border border-zinc-200 p-6">
        <h2 className="font-semibold">Your voice profile</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Built from your sent mail; drafts are written against this profile.
        </p>
        {voice ? (
          <dl className="mt-4 space-y-2 text-sm">
            <div>
              <dt className="inline font-medium">Greeting: </dt>
              <dd className="inline text-zinc-600">{voice.greetingStyle}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Sign-off: </dt>
              <dd className="inline text-zinc-600">{voice.signOff}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Tone: </dt>
              <dd className="inline text-zinc-600">
                {voice.tone} · {voice.formality}
              </dd>
            </div>
            <div>
              <dt className="inline font-medium">Typical length: </dt>
              <dd className="inline text-zinc-600">{voice.averageLength}</dd>
            </div>
            {voice.quirks.length > 0 && (
              <div>
                <dt className="inline font-medium">Habits: </dt>
                <dd className="inline text-zinc-600">{voice.quirks.join("; ")}</dd>
              </div>
            )}
            {voice.languages.length > 0 && (
              <div>
                <dt className="inline font-medium">Languages: </dt>
                <dd className="inline text-zinc-600">{voice.languages.join(", ")}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            No profile yet — it&apos;s built from your sent mail during setup, or train it below.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 p-6">
        <h2 className="font-semibold">Tone</h2>
        {voice ? (
          <p className="mt-2 rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">
            Your learned voice profile wins. The preset below is ignored while a profile is
            active — drafts follow the style card on the left.
          </p>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">
            No voice profile yet — drafts use the tone preset until you train one.
          </p>
        )}
        <dl className="mt-3 space-y-2 text-sm">
          {prefs.tonePreset && (
            <div>
              <dt className="inline font-medium">Preset: </dt>
              <dd className="inline capitalize text-zinc-600">{prefs.tonePreset}</dd>
              <p className="mt-1 text-xs text-zinc-400">
                {TONE_PRESET_INSTRUCTIONS[prefs.tonePreset]}
              </p>
            </div>
          )}
          <div>
            <dt className="inline font-medium">Extra instructions: </dt>
            <dd className="inline text-zinc-600">
              {prefs.toneInstructions ? `"${prefs.toneInstructions}"` : "none"}
            </dd>
          </div>
        </dl>
        <Link
          href="/dashboard/settings"
          className="mt-4 inline-block text-sm font-medium text-teal-700 hover:text-teal-800"
        >
          Edit tone instructions in Settings →
        </Link>
      </section>
      </div>

      <section className="rounded-2xl border border-zinc-200 p-6">
        <h2 className="font-semibold">Retrain</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Rebuild automatically from your recent sent mail, or hand-pick the replies that sound
          most like you.
        </p>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <form action={rebuildVoiceProfile}>
            <PendingButton
              pendingText="Re-learning from your sent mail… (~30s)"
              className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Re-learn from recent sent mail
            </PendingButton>
          </form>
        </div>
        <div className="mt-3">
          <VoiceTrainer />
        </div>

        <div className="mt-5 flex items-start justify-between gap-4 border-t border-zinc-100 pt-5">
          <div>
            <p className="text-sm font-medium text-zinc-900">Keep learning automatically</p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Once a week, Wingman quietly retrains your voice from your latest sent replies —
              so drafts keep up with how you actually write.
            </p>
          </div>
          <form action={toggleAutoRetrainVoice} className="shrink-0">
            <button
              type="submit"
              role="switch"
              aria-checked={prefs.autoRetrainVoice ?? true}
              className={`relative h-6 w-11 rounded-full transition ${
                (prefs.autoRetrainVoice ?? true) ? "bg-teal-600" : "bg-zinc-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  (prefs.autoRetrainVoice ?? true) ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </form>
        </div>
      </section>
      </div>
    </div>
  );
}
