"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type SentSample = {
  id: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
};

const MAX_SAMPLES = 10;

/** Lets the user hand-pick sent emails and retrain the voice profile on them. */
export function VoiceTrainer() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [samples, setSamples] = useState<SentSample[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setOpen(true);
    if (samples !== null) return;
    try {
      const res = await fetch("/api/voice/samples");
      if (!res.ok) throw new Error();
      const data: { samples: SentSample[] } = await res.json();
      setSamples(data.samples);
    } catch {
      setSamples([]);
      setMessage("Couldn't load your sent mail right now — try again in a minute.");
    }
  }

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id)
        ? prev.filter((v) => v !== id)
        : prev.length >= MAX_SAMPLES
          ? prev
          : [...prev, id],
    );
  }

  async function train() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/voice/samples", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageIds: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      setMessage(`Done — your voice profile was rebuilt from ${data.trainedOn} emails.`);
      setSelected([]);
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error && err.message ? err.message : "Training failed — try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={load}
        className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-50"
      >
        Pick specific replies to learn from
      </button>
    );
  }

  return (
    <div className="mt-2">
      <p className="text-sm text-zinc-600">
        Select 3–{MAX_SAMPLES} sent emails that sound like you. The voice profile is rebuilt from
        only these.
      </p>

      {samples === null ? (
        <p className="mt-4 text-sm text-zinc-500">Loading your recent sent mail…</p>
      ) : samples.length === 0 && !message ? (
        <p className="mt-4 text-sm text-zinc-500">No suitable sent emails found yet.</p>
      ) : (
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto pr-1">
          {samples.map((s) => {
            const isSelected = selected.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                aria-pressed={isSelected}
                className={`w-full rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? "border-teal-600 bg-teal-50/50 ring-1 ring-teal-600"
                    : "border-zinc-200 hover:border-zinc-400"
                }`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-medium text-zinc-900">{s.subject}</span>
                  <span className="shrink-0 text-xs text-zinc-400">
                    {new Date(s.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-zinc-500">
                  to {s.to} — {s.snippet.slice(0, 90)}
                  {s.snippet.length > 90 ? "…" : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {message && <p className="mt-3 text-sm text-teal-700">{message}</p>}

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={train}
          disabled={selected.length < 3 || busy}
          className="rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Training…" : `Train on ${selected.length} selected`}
        </button>
        {selected.length > 0 && selected.length < 3 && (
          <span className="text-xs text-zinc-400">pick at least 3</span>
        )}
      </div>
    </div>
  );
}
