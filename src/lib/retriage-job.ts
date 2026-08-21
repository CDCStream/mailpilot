import { and, eq, inArray, lt } from "drizzle-orm";
import { db, retriageJobs } from "@/lib/db";

/** One committed wave — large enough to move the counter, small enough for Vercel. */
export const RETRIAGE_BATCH_SIZE = 25;

/** Concurrent classify/summarize workers inside a batch (same as import). */
export const RETRIAGE_CONCURRENCY = 8;

/** A queued/running job with no commit for this long is dead, not slow. */
export const RETRIAGE_STALE_MS = 2 * 60 * 1000;

export function nextRetriageSlice<T>(listed: T[], processed: number, batchSize = RETRIAGE_BATCH_SIZE): T[] {
  const start = Math.max(0, Math.min(processed, listed.length));
  return listed.slice(start, start + batchSize);
}

/** Keep the enqueue-time denominator. New mail arriving mid-run must not move the bar. */
export function snapshotRetriageTotal(jobTotal: number, listedLength: number): number {
  return jobTotal > 0 ? jobTotal : listedLength;
}

export function retriageWorkList<T>(listed: T[], snapshotTotal: number): T[] {
  if (snapshotTotal <= 0) return [];
  return listed.slice(0, snapshotTotal);
}

export function isRetriageStale(updatedAt: Date, now = new Date(), staleMs = RETRIAGE_STALE_MS): boolean {
  return now.getTime() - updatedAt.getTime() >= staleMs;
}

export type RetriageErrorState = {
  changed: number;
  skip?: string[];
  stuck?: string;
  kind?: "stale-timeout" | "batch-error" | "zero-progress" | null;
};

export function parseRetriageChanged(error: string | null | undefined): number | null {
  const match = error?.match(/changed:(\d+)/);
  return match ? Number(match[1]) : null;
}

export function parseRetriageError(error: string | null | undefined): RetriageErrorState {
  const skip = error?.match(/skip:([^;]+)/)?.[1];
  return {
    changed: parseRetriageChanged(error) ?? 0,
    skip: skip ? skip.split(",").filter(Boolean) : [],
    stuck: error?.match(/stuck:([^;]+)/)?.[1],
    kind: error?.includes("stale-timeout")
      ? "stale-timeout"
      : error?.includes("zero-progress")
        ? "zero-progress"
        : error?.includes("batch-error")
          ? "batch-error"
          : null,
  };
}

export function formatRetriageError(state: RetriageErrorState): string {
  const parts: string[] = [];
  if (state.kind) parts.push(state.kind);
  parts.push(`changed:${state.changed}`);
  if (state.skip?.length) parts.push(`skip:${state.skip.join(",")}`);
  if (state.stuck) parts.push(`stuck:${state.stuck}`);
  return parts.join(";");
}

export function canResumeRetriage(job: {
  status: string;
  scope: string;
  processed: number;
} | null | undefined, scope: string): boolean {
  if (!job) return false;
  if (job.scope !== scope) return false;
  if (job.processed <= 0) return false;
  return job.status === "failed" || job.status === "cancelled";
}

/** Marks jobs that stopped committing so the UI can show Failed instead of 0 / N forever. */
export async function failStaleRetriageJobs(now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - RETRIAGE_STALE_MS);
  const stale = await db.query.retriageJobs.findMany({
    where: and(inArray(retriageJobs.status, ["queued", "running"]), lt(retriageJobs.updatedAt, cutoff)),
  });
  for (const job of stale) {
    const parsed = parseRetriageError(job.error);
    const stuck = job.lastGmailMessageId ?? parsed.stuck;
    console.error("retriage stale-timeout", {
      jobId: job.id,
      processed: job.processed,
      total: job.total,
      lastGmailMessageId: job.lastGmailMessageId,
      stuck,
    });
    await db
      .update(retriageJobs)
      .set({
        status: "failed",
        error: formatRetriageError({ ...parsed, kind: "stale-timeout", stuck }),
        updatedAt: now,
      })
      .where(eq(retriageJobs.id, job.id));
  }
}
