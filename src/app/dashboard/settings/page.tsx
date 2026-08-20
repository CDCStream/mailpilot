import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import {
  db,
  emailAccounts,
  users,
  DEFAULT_PREFERENCES,
  SUMMARY_LANGUAGES,
  resolveInboxMode,
  type Category,
} from "@/lib/db";

const CUSTOM_ARCHIVE_OPTIONS: { id: Category; label: string }[] = [
  { id: "newsletter", label: "Newsletters" },
  { id: "marketing", label: "Marketing" },
  { id: "notification", label: "Notifications" },
  { id: "cold_email", label: "Cold email" },
  { id: "fyi", label: "FYI" },
  { id: "money", label: "Money" },
  { id: "security", label: "Security" },
];
import { maxAccountsFor } from "@/lib/plans";
import { resolveCreditLimit } from "@/lib/usage";
import { disconnectAccount, updatePreferences } from "../actions";
import { PendingButton } from "../pending-button";
import { DeleteAccountSection } from "./delete-account";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const sp = await searchParams;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const prefs = user?.preferences ?? DEFAULT_PREFERENCES;
  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  const { plan, planName } = await resolveCreditLimit(userId);
  const maxAccounts = maxAccountsFor(plan);
  const canAdd = accounts.length < maxAccounts;

  const linked = typeof sp.linked === "string" ? sp.linked : null;
  const setupDeferred = sp.setup === "deferred";
  const error = typeof sp.error === "string" ? sp.error : null;
  const saved = sp.saved === "1";

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <h1 className="text-2xl font-bold">Settings</h1>

      {saved && (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✓ Changes saved successfully.
        </p>
      )}
      {linked && (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Connected {linked}.{" "}
          {setupDeferred
            ? "Setup (labels & import) will start automatically within the next half hour."
            : "Labels and sync are starting in the background."}
        </p>
      )}
      {error === "account_limit" && (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Your {planName} plan allows {maxAccounts} Gmail account
          {maxAccounts > 1 ? "s" : ""}.{" "}
          <Link href="/dashboard/billing" className="font-semibold underline">
            Upgrade to Wingman
          </Link>{" "}
          for up to 10 inboxes.
        </p>
      )}
      {error && error !== "account_limit" && (
        <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Couldn&apos;t connect that Gmail ({error.replaceAll("_", " ")}). Try again.
        </p>
      )}

      <section className="mt-8 rounded-2xl border border-zinc-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-semibold">Gmail accounts</h2>
            <p className="mt-1 text-xs text-zinc-500">
              {accounts.length} of {maxAccounts} on {planName}
              {plan === "pilot" || plan === "trial"
                ? " · Wingman unlocks up to 10 inboxes"
                : ""}
            </p>
          </div>
          {canAdd ? (
            <Link
              href="/api/gmail/link"
              className="rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
            >
              Connect Gmail
            </Link>
          ) : (
            <Link
              href="/dashboard/billing"
              className="rounded-full border border-zinc-300 px-4 py-2 text-xs font-medium hover:bg-zinc-50"
            >
              Upgrade for more
            </Link>
          )}
        </div>
        <ul className="mt-4 divide-y divide-zinc-100">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <p className="font-medium">{a.email}</p>
                <p className="text-xs text-zinc-500">
                  {a.status === "active" ? "Syncing" : a.status}
                  {a.lastSyncedAt ? ` · last sync ${a.lastSyncedAt.toLocaleString()}` : ""}
                </p>
              </div>
              {accounts.length > 1 && (
                <form
                  action={async () => {
                    "use server";
                    await disconnectAccount(a.id);
                  }}
                >
                  <button
                    type="submit"
                    className="text-xs font-medium text-rose-500 hover:text-rose-700"
                  >
                    Disconnect
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <form action={updatePreferences} className="mt-8 grid items-start gap-8 xl:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 p-6">
          <h2 className="font-semibold">What stays in your inbox</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Every email is labeled either way; this only controls what gets archived out of the
            inbox.
          </p>
          <div className="mt-4 space-y-3">
            {[
              {
                id: "focus",
                title: "Only what needs my attention",
                desc: "Newsletters, marketing, notifications and cold email are archived after labeling.",
              },
              {
                id: "quiet",
                title: "Keep my inbox, hide the junk",
                desc: "Newsletters, marketing and cold email are archived. Notifications stay.",
              },
              {
                id: "label_only",
                title: "Just label — don't move anything",
                desc: "Nothing leaves your inbox; Wingman only adds labels.",
              },
            ].map((opt) => (
              <label
                key={opt.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3.5 text-sm has-[:checked]:border-zinc-900 has-[:checked]:ring-1 has-[:checked]:ring-zinc-900"
              >
                <input
                  type="radio"
                  name="inboxMode"
                  value={opt.id}
                  defaultChecked={resolveInboxMode(prefs) === opt.id}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="font-medium text-zinc-900">{opt.title}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">{opt.desc}</span>
                </span>
              </label>
            ))}

            <div className="rounded-xl border border-zinc-200 p-3.5 text-sm has-[input[type=radio]:checked]:border-zinc-900 has-[input[type=radio]:checked]:ring-1 has-[input[type=radio]:checked]:ring-zinc-900">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="inboxMode"
                  value="custom"
                  defaultChecked={resolveInboxMode(prefs) === "custom"}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <span className="font-medium text-zinc-900">
                    Custom — I&apos;ll pick per category
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    Choose exactly which categories get moved out of your inbox.
                  </span>
                </span>
              </label>
              <div className="mt-3 grid gap-2 pl-7 sm:grid-cols-2">
                {CUSTOM_ARCHIVE_OPTIONS.map((cat) => (
                  <label
                    key={cat.id}
                    className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600"
                  >
                    <input
                      type="checkbox"
                      name="archiveCategories"
                      value={cat.id}
                      defaultChecked={(prefs.archiveCategories ?? []).includes(cat.id)}
                      className="h-3.5 w-3.5"
                    />
                    Archive {cat.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <label className="mt-5 flex items-start gap-3 border-t border-zinc-100 pt-5 text-sm">
            <input
              type="checkbox"
              name="respectUserLabels"
              defaultChecked={prefs.respectUserLabels ?? true}
              className="mt-0.5 h-4 w-4"
            />
            <span>
              <span className="font-medium text-zinc-900">Respect my categories</span>
              <span className="mt-0.5 block text-xs text-zinc-500">
                If you (or your own Gmail filters) already labeled an email, Wingman won&apos;t
                re-label or archive it in Gmail — it still shows up here with an AI summary.
              </span>
            </span>
          </label>
        </section>

        <section className="rounded-2xl border border-zinc-200 p-6">
          <h2 className="font-semibold">Drafts</h2>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-zinc-600">When should Wingman write reply drafts?</span>
            <select
              name="draftStyle"
              defaultValue={
                !prefs.draftsEnabled ? "manual" : (prefs.draftStyle ?? "everything")
              }
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-600"
            >
              <option value="everything">
                Automatically, as soon as a &ldquo;To Respond&rdquo; email arrives
              </option>
              <option value="important_only">
                Automatically, but only for urgent or high-stakes emails (saves credits)
              </option>
              <option value="manual">
                Only when I click &ldquo;Draft a reply with AI&rdquo; in the Inbox — never automatically
              </option>
            </select>
            <span className="mt-1 block text-xs text-zinc-500">
              You can always trigger a draft manually from the Inbox reading pane, whichever
              mode you pick.
            </span>
          </label>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-zinc-600">
              Delete unused drafts after (days, 0 = never)
            </span>
            <input
              type="number"
              name="draftCleanupDays"
              min={0}
              max={90}
              defaultValue={prefs.draftCleanupDays ?? 14}
              className="w-32 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-teal-600"
            />
            <span className="mt-1 block text-xs text-zinc-500">
              Wingman drafts you never sent are quietly removed from Gmail so they don&apos;t
              pile up. Drafts you edited count as unused until sent.
            </span>
          </label>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-zinc-600">Extra tone instructions (optional)</span>
            <span className="mb-2 block text-xs text-zinc-500">
              Used only when you don&apos;t have a voice profile yet. Once AI Training builds a
              profile from your sent mail, that profile wins over any Warm/Direct preset here.
            </span>
            <textarea
              name="toneInstructions"
              defaultValue={prefs.toneInstructions}
              maxLength={500}
              rows={3}
              placeholder="e.g. Keep replies under 5 sentences. Never use exclamation marks."
              className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-teal-600"
            />
          </label>
        </section>

        <section className="rounded-2xl border border-zinc-200 p-6">
          <h2 className="font-semibold">AI summaries</h2>
          <label className="mt-4 block text-sm">
            <span className="mb-1 block text-zinc-600">Summary language</span>
            <select
              name="summaryLanguage"
              defaultValue={prefs.summaryLanguage ?? "en"}
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-teal-600"
            >
              {Object.entries(SUMMARY_LANGUAGES).map(([code, label]) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-zinc-500">
              Used for the one-line email summaries and your daily brief digest. Applies to
              emails processed after you save — existing summaries keep their language.
            </span>
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
                className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-teal-600"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600">Timezone (IANA)</span>
              <input
                type="text"
                name="timezone"
                defaultValue={prefs.timezone}
                placeholder="Europe/Istanbul"
                className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-teal-600"
              />
            </label>
          </div>
        </section>

        <div className="flex items-center gap-4 xl:col-span-2">
          <PendingButton
            pendingText="Saving…"
            className="rounded-full bg-teal-600 px-8 py-3 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Save settings
          </PendingButton>
          {saved && (
            <span className="text-sm font-medium text-emerald-700">✓ Changes saved successfully</span>
          )}
        </div>
      </form>

      <div className="mt-8 grid items-start gap-8 xl:grid-cols-2">
      <section className="rounded-2xl border border-zinc-200 p-6">
        <h2 className="font-semibold">Your voice profile</h2>
        <p className="mt-2 text-sm text-zinc-500">
          Voice training moved to its own page — review your profile and retrain it there.
        </p>
        <Link
          href="/dashboard/training"
          className="mt-3 inline-block text-sm font-medium text-teal-700 hover:text-teal-800"
        >
          Go to AI Training →
        </Link>
      </section>

      <DeleteAccountSection
        email={user?.email ?? session!.user.email ?? ""}
        accountEmails={accounts.map((a) => a.email)}
      />
      </div>
    </div>
  );
}
