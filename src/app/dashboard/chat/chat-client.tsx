"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Turn = { role: "user" | "assistant"; content: string };

/** Renders **bold** spans inside a line. */
function inline(text: string): ReactNode[] {
  return text
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) =>
      i % 2 === 1 ? (
        <strong key={i} className="font-semibold text-zinc-900">
          {part}
        </strong>
      ) : (
        part
      ),
    );
}

/**
 * Tiny markdown renderer for assistant answers: paragraphs, "- " bullets,
 * and lines that are entirely bold become section headers. No dependency.
 */
function AssistantAnswer({ content }: { content: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={blocks.length} className="mt-1.5 space-y-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
            <span>{inline(b)}</span>
          </li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  for (const raw of content.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flushBullets();
      continue;
    }
    const bullet = line.match(/^[-•*]\s+(.*)$/);
    if (bullet) {
      bullets.push(bullet[1]);
      continue;
    }
    flushBullets();
    const header = line.match(/^\*\*(.+?)\*\*:?$/);
    if (header) {
      blocks.push(
        <p key={blocks.length} className="mt-3 text-[13px] font-semibold text-zinc-900 first:mt-0">
          {header[1]}
        </p>,
      );
    } else {
      blocks.push(
        <p key={blocks.length} className="mt-2 first:mt-0">
          {inline(line.replace(/^#+\s*/, ""))}
        </p>,
      );
    }
  }
  flushBullets();
  return <>{blocks}</>;
}

const SUGGESTIONS = [
  "What needs my reply today?",
  "Who am I still waiting on?",
  "Summarize this week's newsletters",
  "Any bills or deliveries coming up?",
];

/** Free-form chat over the user's triaged inbox — each answer costs credits. */
export function InboxChat({
  threadId,
  initialTurns = [],
}: {
  threadId?: string;
  initialTurns?: Turn[];
}) {
  const router = useRouter();
  const [currentThreadId, setCurrentThreadId] = useState<string | undefined>(threadId);
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError(null);
    setInput("");
    setTurns((prev) => [...prev, { role: "user", content: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, threadId: currentThreadId ?? null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong — try again.");
      setTurns((prev) => [...prev, { role: "assistant", content: data.answer }]);
      if (data.threadId && !currentThreadId) {
        // First exchange created the thread: reflect it in the URL and refresh
        // the server-rendered history list, without remounting this component.
        setCurrentThreadId(data.threadId);
        window.history.replaceState(null, "", `/dashboard/chat?t=${data.threadId}`);
        router.refresh();
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — try again.");
      // Drop the unanswered question so a retry doesn't duplicate it in history.
      setTurns((prev) => prev.slice(0, -1));
      setInput(q);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {turns.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-600">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 10h8M8 14h5M21 12a9 9 0 1 0-3.5 7.1L21 20l-.9-3.4A8.96 8.96 0 0 0 21 12Z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="mt-4 text-sm font-medium text-zinc-900">Ask anything about your inbox</p>
            <p className="mt-1 max-w-sm text-xs text-zinc-500">
              Wingman answers from your triaged mail of the last 14 days — senders, subjects,
              summaries and drafts.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-zinc-200 px-3.5 py-1.5 text-xs text-zinc-600 hover:border-zinc-400"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="flex justify-end">
              <p className="max-w-xl rounded-2xl rounded-br-md bg-teal-600 px-4 py-2.5 text-sm text-white">
                {t.content}
              </p>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="max-w-2xl rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-3 text-sm text-zinc-800">
                <AssistantAnswer content={t.content} />
              </div>
            </div>
          ),
        )}

        {busy && (
          <div className="flex justify-start">
            <p className="rounded-2xl rounded-bl-md bg-zinc-100 px-4 py-2.5 text-sm text-zinc-400">
              Thinking…
            </p>
          </div>
        )}
        {error && <p className="text-center text-xs text-rose-600">{error}</p>}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="flex items-center gap-2 border-t border-zinc-100 px-4 py-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={300}
          placeholder="e.g. What am I forgetting to answer?"
          className="min-w-0 flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-sm outline-none focus:border-teal-600"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="rounded-full bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}
