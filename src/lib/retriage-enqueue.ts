import { and, eq, inArray, lt } from "drizzle-orm";
import { db, retriageJobs } from "@/lib/db";
import type { RetriageScope } from "@/lib/classifier-version";
import { failStaleRetriageJobs } from "@/lib/retriage-job";
import { countRetriageTargets } from "@/lib/retriage-query";

export type EnqueueResult =
  | { ok: true; jobId: string; total: number; alreadyActive?: boolean }
  | { ok: false; error: string };

/**
 * Insert the job row and return. No classify, no Gmail, no Inngest await —
 * callers return 200 and let /api/retriage/tick (or Inngest) process batches.
 */
export async function enqueueRetriageJob(userId: string, scope: RetriageScope): Promise<EnqueueResult> {
  await failStaleRetriageJobs();

  const staleZero = new Date(Date.now() - 15_000);
  await db
    .update(retriageJobs)
    .set({ status: "cancelled", error: "stale", updatedAt: new Date() })
    .where(
      and(
        eq(retriageJobs.userId, userId),
        inArray(retriageJobs.status, ["queued", "running", "cancel_requested"]),
        eq(retriageJobs.total, 0),
        eq(retriageJobs.processed, 0),
        lt(retriageJobs.createdAt, staleZero),
      ),
    );

  const active = await db.query.retriageJobs.findFirst({
    where: and(
      eq(retriageJobs.userId, userId),
      inArray(retriageJobs.status, ["queued", "running", "cancel_requested"]),
    ),
  });
  if (active) {
    return { ok: true, jobId: active.id, total: active.total, alreadyActive: true };
  }

  const total = await countRetriageTargets(userId, scope);
  const inserted = await db
    .insert(retriageJobs)
    .values({
      userId,
      scope,
      status: total === 0 ? "done" : "queued",
      total,
      processed: 0,
    })
    .returning({ id: retriageJobs.id });
  const job = inserted[0];
  if (!job) return { ok: false, error: "Re-triage failed to start — try again" };
  return { ok: true, jobId: job.id, total };
}

export async function requestRetriageCancel(userId: string): Promise<void> {
  await db
    .update(retriageJobs)
    .set({ status: "cancel_requested", updatedAt: new Date() })
    .where(
      and(
        eq(retriageJobs.userId, userId),
        inArray(retriageJobs.status, ["queued", "running"]),
      ),
    );
}
