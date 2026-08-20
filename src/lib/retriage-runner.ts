import { and, eq, inArray } from "drizzle-orm";
import { db, emailAccounts, retriageJobs, rules, users } from "@/lib/db";
import { CLASSIFIER_VERSION, type RetriageScope } from "@/lib/classifier-version";
import { getGmailClient } from "@/lib/gmail";
import { processInboxMessage, type PipelineContext } from "@/lib/pipeline";
import { listRetriageTargets } from "@/lib/retriage-query";
import { purgePoisonedSenderCache, relabelPoisonedLinkedInSecurity } from "@/lib/sender-cache";

const TRIAGE_CONCURRENCY = 8;

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

/**
 * Re-triage already-imported mail. Safe to resume: skips batches another
 * worker already claimed via processed count.
 */
export async function runRetriageJob(
  jobId: string,
  userId: string,
  targets?: { accountId: string; gmailId: string }[],
): Promise<{ processed: number; cancelled?: boolean }> {
  try {
    await purgePoisonedSenderCache();
    await relabelPoisonedLinkedInSecurity();
  } catch (err) {
    console.error("retriage cache purge failed", err);
  }

  const job = await db.query.retriageJobs.findFirst({
    where: and(eq(retriageJobs.id, jobId), eq(retriageJobs.userId, userId)),
  });
  if (!job || job.status === "cancelled" || job.status === "done") {
    return { processed: job?.processed ?? 0 };
  }

  const listed =
    targets && targets.length > 0
      ? targets
      : await listRetriageTargets(userId, job.scope as RetriageScope);

  await db
    .update(retriageJobs)
    .set({
      status: "running",
      total: listed.length,
      lastGmailMessageId: job.lastGmailMessageId ?? "__started__",
      updatedAt: new Date(),
    })
    .where(eq(retriageJobs.id, jobId));

  if (listed.length === 0) {
    await db
      .update(retriageJobs)
      .set({ status: "done", processed: 0, total: 0, updatedAt: new Date() })
      .where(eq(retriageJobs.id, jobId));
    return { processed: 0 };
  }

  const startAt = Math.min(job.processed, listed.length);
  for (let i = startAt; i < listed.length; i += TRIAGE_CONCURRENCY) {
    const latest = await db.query.retriageJobs.findFirst({
      where: eq(retriageJobs.id, jobId),
    });
    if (!latest || latest.status === "cancel_requested" || latest.status === "cancelled") {
      await db
        .update(retriageJobs)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(retriageJobs.id, jobId));
      return { processed: i, cancelled: true };
    }
    // Another worker already advanced past this batch.
    if (latest.processed > i) continue;

    const chunk = listed.slice(i, i + TRIAGE_CONCURRENCY);
    const byAccount = new Map<string, string[]>();
    for (const item of chunk) {
      const list = byAccount.get(item.accountId) ?? [];
      list.push(item.gmailId);
      byAccount.set(item.accountId, list);
    }
    for (const [accountId, gmailIds] of byAccount) {
      const ctx = await loadContext(accountId);
      if (!ctx) continue;
      await Promise.all(
        gmailIds.map((id) => processInboxMessage(ctx, id, { free: true, overwrite: true })),
      );
    }

    await db
      .update(retriageJobs)
      .set({
        processed: i + chunk.length,
        lastGmailMessageId: chunk.at(-1)?.gmailId ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(retriageJobs.id, jobId), inArray(retriageJobs.status, ["queued", "running"])),
      );
  }

  await db
    .update(retriageJobs)
    .set({
      status: "done",
      processed: listed.length,
      total: listed.length,
      updatedAt: new Date(),
    })
    .where(eq(retriageJobs.id, jobId));
  await db
    .update(users)
    .set({ classifierVersion: CLASSIFIER_VERSION })
    .where(eq(users.id, userId));

  return { processed: listed.length };
}
