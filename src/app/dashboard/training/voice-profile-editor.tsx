"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { VoiceProfile } from "@/lib/db";
import { saveVoiceProfile } from "../actions";

export function VoiceProfileEditor({
  voice,
  locked,
}: {
  voice: VoiceProfile | null;
  locked?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current: VoiceProfile = {
    greetingStyle: voice?.greetingStyle ?? "",
    signOff: voice?.signOff ?? "",
    tone: voice?.tone ?? "",
    formality: voice?.formality ?? "",
    averageLength: voice?.averageLength ?? "",
    quirks: voice?.quirks ?? [],
    languages: voice?.languages ?? [],
  };

  async function onSave(formData: FormData) {
    setSaving(true);
    setError(null);
    try {
      const result = await saveVoiceProfile(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    } catch {
      setError("Couldn’t save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div>
        <div className="mt-4 flex items-start justify-between gap-3">
          {voice ? (
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="inline font-medium">Greeting: </dt>
                <dd className="inline text-zinc-600">{voice.greetingStyle}</dd>
              </div>
              <div>
                <dt className="inline font-medium">Sign-off: </dt>
                <dd className="inline whitespace-pre-line text-zinc-600">{voice.signOff}</dd>
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
              {current.quirks.length > 0 && (
                <div>
                  <dt className="inline font-medium">Habits: </dt>
                  <dd className="inline text-zinc-600">{current.quirks.join("; ")}</dd>
                </div>
              )}
              {current.languages.length > 0 && (
                <div>
                  <dt className="inline font-medium">Languages: </dt>
                  <dd className="inline text-zinc-600">{current.languages.join(", ")}</dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-zinc-500">
              No profile yet — edit one by hand, or train it from sent mail.
            </p>
          )}
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium hover:bg-zinc-50"
          >
            Edit
          </button>
        </div>
        {locked && voice ? (
          <p className="mt-3 text-xs text-zinc-500">
            Your edits are locked. Weekly auto-learn won&apos;t overwrite them. Retrain below
            rebuilds from sent mail.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form action={(fd) => void onSave(fd)} className="mt-4 space-y-3">
      <label className="block text-sm">
        <span className="font-medium">Greeting</span>
        <input
          name="greetingStyle"
          defaultValue={current.greetingStyle}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Sign-off</span>
        <textarea
          name="signOff"
          defaultValue={current.signOff}
          rows={3}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium">Tone</span>
          <input
            name="tone"
            defaultValue={current.tone}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">Formality</span>
          <input
            name="formality"
            defaultValue={current.formality}
            className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="font-medium">Typical length</span>
        <input
          name="averageLength"
          defaultValue={current.averageLength}
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Habits</span>
        <textarea
          name="quirks"
          defaultValue={current.quirks.join("\n")}
          rows={5}
          placeholder="One habit per line"
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Languages</span>
        <input
          name="languages"
          defaultValue={current.languages.join(", ")}
          placeholder="English, Turkish"
          className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm"
        />
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
