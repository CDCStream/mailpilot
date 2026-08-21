import { and, eq, inArray } from "drizzle-orm";
import { db, emailAccounts, messages, retriageJobs, rules, users } from "@/lib/db";
import { CLASSIFIER_VERSION, type RetriageScope } from "@/lib/classifier-version";
import { getGmailClient } from "@/lib/gmail";
import { retriageStoredRow, type PipelineContext } from "@/lib/pipeline";
import {
  RETRIAGE_BATCH_SIZE,
  RETRIAGE_CONCURRENCY,
  nextRetriageSlice,
  parseRetriageChanged,
  retriageWorkList,
  snapshotRetriageTotal,
} from "@/lib/retriage-job";
import { listRetriageTargets } from "@/lib/retriage-query";
import { purgePoisonedSenderCache, relabelPoisonedLinkedInSecurity } from "@/lib/sender-cache";

export type RetriageBatchResult = {
  status: "running" | "done" | "cancelled" | "failed" | "idle";
  processed: number;
  total: number;
  changed: number;
};

async function loadContext(accountId: string): Promise<PipelineContext | null> {
  const account = await db.query.emailAccounts.findFirst({
    where: eq(emailAccounts.id, accountId),
  });
  if (!account || account.status !== "active") return null;

  const user = await db.query.users.findFirst({ where: eq(users.id, account.userId) });
  if (!user) return null;

  const userRules = await db.query.rules.findMany({
    where: eq(rules.userId, user.id),
  });

  return {
    gmail: getGmailClient(account.refreshTokenEnc),
    account: { id: account.id, email: account.email, labelMap: account.labelMap },
    user: {
      id: user.id,
      name: user.name,
      voiceProfile: user.voiceProfile,
      preferences: user.preferences,
    },
    rules: userRules
      .filter((r) => r.enabled)
      .map((r) => ({ parsed: r.parsed, description: r.parsed.description || r.instruction })),
  };
}

async function finishJob(
  jobId: string,
  userId: string,
  processed: number,
  total: number,
  changed: number,
): Promise<void> {
  await db
    .update(retriageJobs)
    .set({
      status: "done",
      processed,
      total,
      error: `changed:${changed}`,
      updatedAt: new Date(),
    })
    .where(eq(retriageJobs.id, jobId));
  await db
    .update(users)
    .set({ classifierVersion: CLASSIFIER_VERSION })
    .where(eq(users.id, userId));
}

/**
 * One durable batch: classify up to 25 stored rows, commit `processed`, return.
 * Safe to resume — the next call starts at the last committed offset.
 */
export async function processRetriageBatch(
  jobId: string,
  userId: string,
): Promise<RetriageBatchResult> {
  const job = await db.query.retriageJobs.findFirst({
    where: and(eq(retriageJobs.id, jobId), eq(retriageJobs.userId, userId)),
  });
  if (!job) return { status: "idle", processed: 0, total: 0, changed: 0 };
  if (job.status === "done" || job.status === "cancelled" || job.status === "failed") {
    return {
      status: job.status,
      processed: job.processed,
      total: job.total,
      changed: parseRetriageChanged(job.error) ?? 0,
    };
  }
  if (job.status === "cancel_requested") {
    await db
      .update(retriageJobs)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(eq(retriageJobs.id, jobId));
    return {
      status: "cancelled",
      processed: job.processed,
      total: job.total,
      changed: parseRetriageChanged(job.error) ?? 0,
    };
  }

  try {
    if (job.processed === 0) {
      try {
        await purgePoisonedSenderCache();
        await relabelPoisonedLinkedInSecurity();
      } catch (err) {
        console.error("retriage cache purge failed", err);
      }
    }

    const listed = await listRetriageTargets(userId, job.scope as RetriageScope);
    const total = snapshotRetriageTotal(job.total, listed.length);
    const work = retriageWorkList(listed, total);
    const startAt = Math.min(job.processed, work.length);
    let changed = parseRetriageChanged(job.error) ?? 0;

    if (work.length === 0 || startAt >= work.length) {
      await finishJob(jobId, userId, work.length, total, changed);
      return { status: "done", processed: work.length, total, changed };
    }

    await db
      .update(retriageJobs)
      .set({
        status: "running",
        lastGmailMessageId: job.lastGmailMessageId ?? "__started__",
        updatedAt: new Date(),
      })
      .where(and(eq(retriageJobs.id, jobId), inArray(retriageJobs.status, ["queued", "running"])));

    const chunk = nextRetriageSlice(work, startAt, RETRIAGE_BATCH_SIZE);
    for (let i = 0; i < chunk.length; i += RETRIAGE_CONCURRENCY) {
      const latest = await db.query.retriageJobs.findFirst({
        where: eq(retriageJobs.id, jobId),
      });
      if (!latest || latest.status === "cancel_requested" || latest.status === "cancelled") {
        await db
          .update(retriageJobs)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(retriageJobs.id, jobId));
        return {
          status: "cancelled",
          processed: startAt + i,
          total,
          changed,
        };
      }
      if (latest.processed > startAt + i) {
        return {
          status: latest.processed >= total ? "done" : "running",
          processed: latest.processed,
          total: latest.total,
          changed: parseRetriageChanged(latest.error) ?? changed,
        };
      }

      const wave = chunk.slice(i, i + RETRIAGE_CONCURRENCY);
      const byAccount = new Map<string, string[]>();
      for (const item of wave) {
        const list = byAccount.get(item.accountId) ?? [];
        list.push(item.gmailId);
        byAccount.set(item.accountId, list);
      }
      for (const [accountId, gmailIds] of byAccount) {
        const ctx = await loadContext(accountId);
        if (!ctx) continue;
        const rows = await db.query.messages.findMany({
          where: and(eq(messages.accountId, accountId), inArray(messages.gmailMessageId, gmailIds)),
        });
        const results = await Promise.all(
          rows.map(async (r) => {
            try {
              return await retriageStoredRow(ctx, r);
            } catch (err) {
              console.error("retriage row failed", { id: r.id, err });
              return { status: "skipped" as const, reason: "error" };
            }
          }),
        );
        for (const [idx, result] of results.entries()) {
          if (result.status === "processed" && result.category !== rows[idx]?.category) {
            changed += 1;
          }
        }
      }
    }

    const processed = startAt + chunk.length;
    const done = processed >= work.length;
    if (done) {
      await finishJob(jobId, userId, processed, total, changed);
      return { status: "done", processed, total, changed };
    }

    await db
      .update(retriageJobs)
      .set({
        status: "running",
        processed,
        lastGmailMessageId: chunk.at(-1)?.gmailId ?? null,
        error: `changed:${changed}`,
        updatedAt: new Date(),
      })
      .where(and(eq(retriageJobs.id, jobId), inArray(retriageJobs.status, ["queued", "running"])));

    return { status: "running", processed, total, changed };
  } catch (err) {
    console.error("retriage batch failed", err);
    await db
      .update(retriageJobs)
      .set({ status: "failed", error: "batch-error", updatedAt: new Date() })
      .where(and(eq(retriageJobs.id, jobId), inArray(retriageJobs.status, ["queued", "running"])));
    return {
      status: "failed",
      processed: job.processed,
      total: job.total,
      changed: parseRetriageChanged(job.error) ?? 0,
    };
  }
}

/** Drain a job to completion. Used only by local/scripts — never the Server Action. */
export async function runRetriageJob(
  jobId: string,
  userId: string,
): Promise<{ processed: number; cancelled?: boolean; changed?: number }> {
  for (;;) {
    const result = await processRetriageBatch(jobId, userId);
    if (result.status === "cancelled") {
      return { processed: result.processed, cancelled: true, changed: result.changed };
    }
    if (result.status !== "running") {
      return { processed: result.processed, changed: result.changed };
    }
  }
}
