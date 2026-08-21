"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Job = {
  status: string;
  scope: string;
  processed: number;
  total: number;
  changed?: number | null;
  error?: string | null;
} | null;

function failedCopy(error: string | null | undefined): string {
  if (error === "stale-timeout") {
    return "Re-triage stopped — no progress for 2 minutes. Try again.";
  }
  if (error === "batch-error" || error === "tick-error") {
    return "Re-triage hit an error mid-run. Try again — it resumes from the last committed batch.";
  }
  return "Re-triage failed. Try again.";
}

export function RetriagePanel({
  job,
  staleClassifier,
}: {
  job: Job;
  staleClassifier: boolean;
}) {
  const router = useRouter();
  const [startError, setStartError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const emptyRange = Boolean(job && job.total === 0 && job.status !== "cancelled" && job.status !== "failed");
  const running = Boolean(
    job &&
      job.total > 0 &&
      (job.status === "queued" || job.status === "running" || job.status === "cancel_requested"),
  );
  const failed = job?.status === "failed";

  useEffect(() => {
    if (!running) return;
    let stopped = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight || stopped) return;
      inFlight = true;
      try {
        const res = await fetch("/api/retriage/tick", { method: "POST" });
        const data = (await res.json().catch(() => null)) as { status?: string } | null;
        if (data?.status === "done" || data?.status === "failed" || data?.status === "cancelled") {
          stopped = true;
        }
      } catch {
        // Cron / Inngest still drain the job if this poll misses.
      } finally {
        inFlight = false;
        if (!stopped) router.refresh();
      }
    };

    void tick();
    const t = setInterval(tick, 4000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [running, router]);

  const pct = job && job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 0;

  async function onStart(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStartError(null);
    setStarting(true);
    const scope = String(new FormData(event.currentTarget).get("scope") ?? "7");
    try {
      const res = await fetch("/api/retriage/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || data?.ok === false) {
        setStartError(data?.error ?? "Re-triage failed to start — try again");
      }
    } catch {
      setStartError("Re-triage failed to start — try again");
    } finally {
      setStarting(false);
      router.refresh();
    }
  }

  async function onCancel() {
    setCancelling(true);
    try {
      await fetch("/api/retriage/cancel", { method: "POST" });
    } finally {
      setCancelling(false);
      router.refresh();
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-zinc-200 p-6">
      <h2 className="font-semibold">Re-run triage on my history</h2>
      <p className="mt-1 text-xs text-zinc-500">
        Free. Re-classifies and re-summarizes mail already in Wingman — the only way stale
        &quot;To Respond&quot; rows get corrected. Safe to run twice.
      </p>
      {staleClassifier && !running && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Triage rules were updated. Re-run on your history so old labels match the new classifier.
        </p>
      )}
      {startError && (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {startError}
        </p>
      )}
      {failed && (
        <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {failedCopy(job?.error)}
          {job && job.total > 0 ? ` Last commit: ${job.processed} / ${job.total}.` : ""}
        </p>
      )}
      {emptyRange && job?.status === "done" && (
        <p className="mt-4 text-sm text-zinc-600">No messages in this range</p>
      )}
      {running && job ? (
        <div className="mt-4">
          <p className="text-sm text-zinc-700">
            {job.status === "cancel_requested"
              ? "Cancelling after this batch…"
              : `Re-triaging last ${job.scope === "all" ? "mail" : `${job.scope} days`} — ${job.processed} / ${job.total}`}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
            <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
          </div>
          {job.status !== "cancel_requested" && (
            <button
              type="button"
              onClick={() => void onCancel()}
              disabled={cancelling}
              className="mt-3 rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:opacity-70"
            >
              {cancelling ? "Cancelling…" : "Cancel"}
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={(e) => void onStart(e)} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Scope</span>
            <select
              name="scope"
              defaultValue="7"
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All imported mail</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={starting}
            className="inline-flex items-center justify-center rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-70"
          >
            {starting ? "Starting…" : "Start re-triage"}
          </button>
          {job?.status === "done" && job.total > 0 && (
            <span className="text-xs text-zinc-500">
              Re-triaged {job.processed} messages
              {job.changed != null ? ` · ${job.changed} changed` : ""}
            </span>
          )}
          {job?.status === "cancelled" && (
            <span className="text-xs text-zinc-500">Last run cancelled at {job.processed}.</span>
          )}
        </form>
      )}
    </section>
  );
}
