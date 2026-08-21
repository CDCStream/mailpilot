import { and, inArray, lt } from "drizzle-orm";
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

export function isRetriageStale(updatedAt: Date, now = new Date(), staleMs = RETRIAGE_STALE_MS): boolean {
  return now.getTime() - updatedAt.getTime() >= staleMs;
}

export function parseRetriageChanged(error: string | null | undefined): number | null {
  const match = error?.match(/^changed:(\d+)/);
  return match ? Number(match[1]) : null;
}

/** Marks jobs that stopped committing so the UI can show Failed instead of 0 / N forever. */
export async function failStaleRetriageJobs(now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - RETRIAGE_STALE_MS);
  await db
    .update(retriageJobs)
    .set({ status: "failed", error: "stale-timeout", updatedAt: now })
    .where(
      and(
        inArray(retriageJobs.status, ["queued", "running"]),
        lt(retriageJobs.updatedAt, cutoff),
      ),
    );
}
