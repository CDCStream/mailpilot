"use client";

import { useState } from "react";

/**
 * Free subject line tester. Runs fully client-side: nothing typed here is
 * sent anywhere or stored. Display limits are approximations — actual
 * truncation depends on device width and font settings.
 */

const DESKTOP_LIMIT = 65; // Gmail desktop list view shows ~60–70 chars
const MOBILE_LIMIT = 38; // Gmail/Apple Mail phone apps show ~30–40 chars

const FILLER_OPENERS = [
  "quick question",
  "following up",
  "checking in",
  "just wanted to",
  "touching base",
  "re: re:",
];

type Check = { ok: boolean; label: string };

function truncate(text: string, limit: number): { shown: string; cut: boolean } {
  if (text.length <= limit) return { shown: text, cut: false };
  return { shown: text.slice(0, limit - 1).trimEnd() + "\u2026", cut: true };
}

function runChecks(subject: string): Check[] {
  const trimmed = subject.trim();
  const lower = trimmed.toLowerCase();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const capsWords = words.filter((w) => w.length >= 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
  const emojiCount = [...trimmed].filter((ch) => /\p{Extended_Pictographic}/u.test(ch)).length;

  return [
    {
      ok: trimmed.length > 0 && trimmed.length <= 60,
      label:
        trimmed.length === 0
          ? "Not empty"
          : trimmed.length <= 60
            ? `Length OK (${trimmed.length} chars, under 60)`
            : `Long (${trimmed.length} chars — aim for under 60)`,
    },
    {
      ok: trimmed.length > 0 && trimmed.length <= MOBILE_LIMIT,
      label:
        trimmed.length <= MOBILE_LIMIT
          ? "Fits typical mobile view without truncation"
          : `Will likely truncate on mobile (first ~${MOBILE_LIMIT} chars visible)`,
    },
    {
      ok: capsWords.length === 0,
      label:
        capsWords.length === 0
          ? "No all-caps words"
          : `All-caps words look spammy: ${capsWords.slice(0, 3).join(", ")}`,
    },
    {
      ok: !/[!?]{2,}/.test(trimmed),
      label: /[!?]{2,}/.test(trimmed)
        ? "Stacked punctuation (!!, ??) pattern-matches to spam"
        : "No stacked punctuation",
    },
    {
      ok: emojiCount <= 1,
      label:
        emojiCount <= 1
          ? "Emoji use OK (0–1)"
          : `${emojiCount} emojis — more than one usually hurts credibility`,
    },
    {
      ok: !FILLER_OPENERS.some((f) => lower.startsWith(f)),
      label: FILLER_OPENERS.some((f) => lower.startsWith(f))
        ? "Filler opener wastes the visible characters — front-load the point"
        : "No filler opener",
    },
  ];
}

export function SubjectLineChecker() {
  const [subject, setSubject] = useState("");
  const trimmed = subject.trim();
  const checks = trimmed ? runChecks(subject) : [];
  const desktop = truncate(trimmed, DESKTOP_LIMIT);
  const mobile = truncate(trimmed, MOBILE_LIMIT);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <label htmlFor="subject-input" className="text-sm font-medium text-zinc-900">
        Your subject line
      </label>
      <input
        id="subject-input"
        type="text"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Invoice #218 — payment due Friday"
        className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:border-teal-600 focus:outline-none"
        maxLength={300}
        autoComplete="off"
      />
      <p className="mt-2 text-xs text-zinc-500">
        {trimmed.length} characters · runs in your browser, nothing is sent or stored
      </p>

      {trimmed && (
        <>
          <div className="mt-6 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Inbox preview (approximate)
            </p>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-[11px] text-zinc-400">Desktop · ~{DESKTOP_LIMIT} chars visible</p>
              <p className="mt-1 truncate text-sm">
                <span className="font-semibold text-zinc-900">Your Name</span>{" "}
                <span className={desktop.cut ? "text-amber-700" : "text-zinc-700"}>
                  {desktop.shown}
                </span>
              </p>
            </div>
            <div className="max-w-sm rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3">
              <p className="text-[11px] text-zinc-400">Mobile · ~{MOBILE_LIMIT} chars visible</p>
              <p className="mt-1 truncate text-sm">
                <span className="font-semibold text-zinc-900">Your Name</span>{" "}
                <span className={mobile.cut ? "text-amber-700" : "text-zinc-700"}>
                  {mobile.shown}
                </span>
              </p>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Checks</p>
            <ul className="mt-3 space-y-2">
              {checks.map((c) => (
                <li key={c.label} className="flex items-start gap-2 text-sm">
                  <span
                    aria-hidden
                    className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                      c.ok ? "bg-teal-600" : "bg-amber-500"
                    }`}
                  >
                    {c.ok ? "\u2713" : "!"}
                  </span>
                  <span className={c.ok ? "text-zinc-600" : "text-zinc-900"}>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
