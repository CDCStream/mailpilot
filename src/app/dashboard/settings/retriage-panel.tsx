"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { cancelRetriage, startRetriage } from "../actions";
import { PendingButton } from "../pending-button";

type Job = {
  status: string;
  scope: string;
  processed: number;
  total: number;
} | null;

export function RetriagePanel({
  job,
  staleClassifier,
}: {
  job: Job;
  staleClassifier: boolean;
}) {
  const router = useRouter();
  const running =
    job && (job.status === "queued" || job.status === "running" || job.status === "cancel_requested");

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(t);
  }, [running, router]);

  const pct = job && job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : 0;

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
            <form action={cancelRetriage} className="mt-3">
              <PendingButton
                pendingText="Cancelling…"
                className="rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-medium hover:bg-zinc-50"
              >
                Cancel
              </PendingButton>
            </form>
          )}
        </div>
      ) : (
        <form action={startRetriage} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">Scope</span>
            <select
              name="scope"
              defaultValue="30"
              className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-600"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="all">All imported mail</option>
            </select>
          </label>
          <PendingButton
            pendingText="Starting…"
            className="rounded-full bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
          >
            Start re-triage
          </PendingButton>
          {job?.status === "done" && (
            <span className="text-xs text-zinc-500">Last run finished ({job.processed} messages).</span>
          )}
          {job?.status === "cancelled" && (
            <span className="text-xs text-zinc-500">Last run cancelled at {job.processed}.</span>
          )}
        </form>
      )}
    </section>
  );
}
