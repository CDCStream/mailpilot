import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { db, retriageJobs } from "@/lib/db";
import type { RetriageScope } from "@/lib/classifier-version";
import { canResumeRetriage, failStaleRetriageJobs } from "@/lib/retriage-job";
import { countRetriageTargets } from "@/lib/retriage-query";

export type EnqueueResult =
  | { ok: true; jobId: string; total: number; alreadyActive?: boolean; resumed?: boolean; processed?: number }
  | { ok: false; error: string };

export type EnqueueOptions = {
  /** Continue a failed/cancelled job for this scope from last_commit. */
  resume?: boolean;
  /** Ignore a resumable job and start a new one at 0. */
  startOver?: boolean;
};

/**
 * Insert the job row and return. No classify, no Gmail, no Inngest await —
 * callers return 200 and let /api/retriage/tick (or Inngest) process batches.
 */
export async function enqueueRetriageJob(
  userId: string,
  scope: RetriageScope,
  opts: EnqueueOptions = {},
): Promise<EnqueueResult> {
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
    return { ok: true, jobId: active.id, total: active.total, alreadyActive: true, processed: active.processed };
  }

  const latest = await db.query.retriageJobs.findFirst({
    where: and(eq(retriageJobs.userId, userId), eq(retriageJobs.scope, scope)),
    orderBy: [desc(retriageJobs.createdAt)],
  });
  const resume = !opts.startOver && canResumeRetriage(latest, scope);
  if (resume && latest) {
    await db
      .update(retriageJobs)
      .set({ status: "queued", updatedAt: new Date() })
      .where(eq(retriageJobs.id, latest.id));
    return {
      ok: true,
      jobId: latest.id,
      total: latest.total,
      resumed: true,
      processed: latest.processed,
    };
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
  return { ok: true, jobId: job.id, total, processed: 0 };
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
