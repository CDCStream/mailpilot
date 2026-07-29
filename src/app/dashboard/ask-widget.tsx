"use client";

import { useState } from "react";

const SUGGESTIONS = [
  "What needs my reply today?",
  "Who am I still waiting on?",
  "Summarize this week's newsletters",
];

export function AskWidget() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Try again.");
      } else {
        setAnswer(data.answer || "No answer.");
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 p-5">
      <p className="text-sm font-medium text-zinc-900">Ask AI about your inbox</p>
      <p className="mt-0.5 text-xs text-zinc-500">
        Answers from your triaged mail — 2 credits per question.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={300}
          placeholder="e.g. What am I forgetting to answer?"
          className="min-w-0 flex-1 rounded-xl border border-zinc-300 px-3.5 py-2 text-sm outline-none focus:border-teal-600"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="shrink-0 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ask
        </button>
      </form>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            disabled={loading}
            onClick={() => {
              setQuestion(s);
              void ask(s);
            }}
            className="rounded-full border border-zinc-200 px-2.5 py-1 text-[11px] text-zinc-600 hover:border-zinc-400 disabled:opacity-40"
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
          <span className="iw-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-teal-500" />
          Reading your inbox data…
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {error}
        </p>
      )}
      {answer && (
        <div className="iw-fade-up mt-3 whitespace-pre-wrap rounded-xl border border-teal-100 bg-teal-50/40 px-3.5 py-3 text-xs leading-relaxed text-zinc-700">
          {answer}
        </div>
      )}
    </div>
  );
}
