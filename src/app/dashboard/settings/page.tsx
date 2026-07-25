import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, users, DEFAULT_PREFERENCES } from "@/lib/db";
import { rebuildVoiceProfile, updatePreferences } from "../actions";

export default async function SettingsPage() {
  const session = await auth();
  const user = await db.query.users.findFirst({ where: eq(users.id, session!.user.id) });
  const prefs = user?.preferences ?? DEFAULT_PREFERENCES;
  const voice = user?.voiceProfile;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <form action={updatePreferences} className="mt-8 space-y-8">
        <section className="rounded-2xl border border-zinc-200 p-6">
          <h2 className="font-semibold">Triage</h2>
          <label className="mt-4 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="archiveLowPriority"
              defaultChecked={prefs.archiveLowPriority}
              className="h-4 w-4"
            />
            Archive newsletters, marketing and cold email out of my inbox after labeling
          </label>
        </section>

        <section className="rounded-2xl border border-zinc-200 p-6">
          <h2 className="font-semibold">Drafts</h2>
          <label className="mt-4 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="draftsEnabled"
              defaultChecked={prefs.draftsEnabled}
              className="h-4 w-4"
            />
            Automatically draft replies for emails that need a response
          </label>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-zinc-600">
              Extra tone instructions (optional)
            </span>
            <textarea
              name="toneInstructions"
              defaultValue={prefs.toneInstructions}
              maxLength={500}
              rows={3}
              placeholder="e.g. Keep replies under 5 sentences. Never use exclamation marks."
              className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
            />
          </label>
        </section>

        <section className="rounded-2xl border border-zinc-200 p-6">
          <h2 className="font-semibold">Daily brief</h2>
          <label className="mt-4 flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="briefEnabled"
              defaultChecked={prefs.briefEnabled}
              className="h-4 w-4"
            />
            Send me a daily brief email
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600">Send at (local hour, 0–23)</span>
              <input
                type="number"
                name="briefHour"
                min={0}
                max={23}
                defaultValue={prefs.briefHour}
                className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600">Timezone (IANA)</span>
              <input
                type="text"
                name="timezone"
                defaultValue={prefs.timezone}
                placeholder="Europe/Istanbul"
                className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
              />
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 p-6">
          <h2 className="font-semibold">Follow-ups</h2>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-zinc-600">
              Flag sent emails with no reply after (days)
            </span>
            <input
              type="number"
              name="followUpDays"
              min={1}
              max={14}
              defaultValue={prefs.followUpDays}
              className="w-32 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-indigo-500"
            />
          </label>
        </section>

        <button
          type="submit"
          className="rounded-full bg-zinc-900 px-8 py-3 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          Save settings
        </button>
      </form>

      <section className="mt-8 rounded-2xl border border-zinc-200 p-6">
        <h2 className="font-semibold">Your voice profile</h2>
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
            {voice.quirks.length > 0 && (
              <div>
                <dt className="inline font-medium">Habits: </dt>
                <dd className="inline text-zinc-600">{voice.quirks.join("; ")}</dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="mt-3 text-sm text-zinc-500">
            No profile yet — it&apos;s built from your sent mail during setup.
          </p>
        )}
        <form action={rebuildVoiceProfile} className="mt-5">
          <button
            type="submit"
            className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-50"
          >
            Re-learn my voice from recent sent mail
          </button>
        </form>
      </section>
    </div>
  );
}
