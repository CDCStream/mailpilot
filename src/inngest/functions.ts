import { and, asc, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import { inngest } from "./client";
import {
  db,
  emailAccounts,
  messages,
  retriageJobs,
  rules,
  users,
  DEFAULT_PREFERENCES,
} from "@/lib/db";
import { CLASSIFIER_VERSION, type RetriageScope } from "@/lib/classifier-version";
import {
  deleteDraft,
  ensureLabels,
  getCurrentHistoryId,
  getGmailClient,
  getSentTextsByIds,
  listHistory,
  listInboxIdsByQuery,
  listRecentSentTexts,
  startWatch,
} from "@/lib/gmail";
import { buildVoiceProfile } from "@/lib/ai";
import { processInboxMessage, retriageStoredRow, type PipelineContext } from "@/lib/pipeline";
import { listRetriageTargets } from "@/lib/retriage-query";
import { purgePoisonedSenderCache, relabelPoisonedLinkedInSecurity } from "@/lib/sender-cache";
import { buildAndSendBrief } from "@/lib/brief";
import { hasActiveAccess } from "@/lib/billing";

const MAX_MESSAGES_PER_RUN = 20;

/** Fyxer-style cap: an import batch never triages more than this many emails. */
export const BACKFILL_MAX = 300;

/** Concurrent classify/summarize workers per backfill or re-triage batch. */
const TRIAGE_CONCURRENCY = 8;

/** How far back the automatic import after connecting goes. */
export const BACKFILL_DAYS = 5;

async function loadContext(accountId: string): Promise<PipelineContext | null> {
  const account = await db.query.emailAccounts.findFirst({
    where: eq(emailAccounts.id, accountId),
  });
  if (!account || account.status !== "active") return null;

  const user = await db.query.users.findFirst({ where: eq(users.id, account.userId) });
  if (!user) return null;

  const userRules = await db.query.rules.findMany({
    where: eq(rules.userId, user.id),
    orderBy: rules.createdAt,
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
 * Runs once after Google OAuth: creates the Gmail labels, learns the user's
 * voice from sent mail, triages the most recent inbox messages, and anchors
 * the history cursor for incremental sync.
 */
export const accountConnected = inngest.createFunction(
  { id: "account-connected", retries: 2, triggers: { event: "app/account.connected" } },
  async ({ event, step }) => {
    const { accountId, voiceSampleIds = [] } = event.data as {
      accountId: string;
      voiceSampleIds?: string[];
    };

    const labelMap = await step.run("ensure-labels", async () => {
      const account = await db.query.emailAccounts.findFirst({
        where: eq(emailAccounts.id, accountId),
      });
      if (!account) throw new Error("account not found");
      const gmail = getGmailClient(account.refreshTokenEnc);
      const map = await ensureLabels(gmail);
      const historyId = await getCurrentHistoryId(gmail);
      await db
        .update(emailAccounts)
        .set({ labelMap: map, lastHistoryId: historyId })
        .where(eq(emailAccounts.id, accountId));
      return map;
    });

    await step.run("start-watch", async () => {
      const topic = process.env.GMAIL_PUBSUB_TOPIC;
      if (!topic) return; // no Pub/Sub configured (local dev): polling fallback covers sync
      const account = await db.query.emailAccounts.findFirst({
        where: eq(emailAccounts.id, accountId),
      });
      if (!account) return;
      const gmail = getGmailClient(account.refreshTokenEnc);
      const expiration = await startWatch(gmail, topic);
      await db
        .update(emailAccounts)
        .set({ watchExpiration: expiration })
        .where(eq(emailAccounts.id, accountId));
    });

    await step.run("build-voice-profile", async () => {
      const account = await db.query.emailAccounts.findFirst({
        where: eq(emailAccounts.id, accountId),
      });
      if (!account) return;
      const gmail = getGmailClient(account.refreshTokenEnc);
      // Prefer the replies the user hand-picked during onboarding; fall back to recent sent mail.
      const picked =
        voiceSampleIds.length > 0
          ? await getSentTextsByIds(gmail, account.email, voiceSampleIds)
          : [];
      const samples =
        picked.length > 0 ? picked : await listRecentSentTexts(gmail, account.email, 60);
      const profile = await buildVoiceProfile(samples);
      await db.update(users).set({ voiceProfile: profile }).where(eq(users.id, account.userId));
    });

    const initialIds = await step.run("list-initial-inbox", async () => {
      const ctx = await loadContext(accountId);
      if (!ctx) return [] as string[];
      // Quick first bites for instant feedback — but only from the same 5-day
      // window the backfill covers, so a quiet inbox doesn't import old mail.
      const q = `after:${Math.floor((Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000) / 1000)}`;
      return listInboxIdsByQuery(ctx.gmail, q, 10);
    });

    for (const messageId of initialIds) {
      await step.run(`triage-${messageId}`, async () => {
        const ctx = await loadContext(accountId);
        if (!ctx) return;
        // Onboarding import is on the house — its cost is priced into the plans.
        await processInboxMessage(ctx, messageId, { free: true });
      });
    }

    await step.run("mark-onboarded", async () => {
      const account = await db.query.emailAccounts.findFirst({
        where: eq(emailAccounts.id, accountId),
      });
      if (!account) return;
      await db
        .update(users)
        .set({ onboardedAt: new Date(), classifierVersion: CLASSIFIER_VERSION })
        .where(eq(users.id, account.userId));
    });

    // Import the rest of the last few days in the background (Fyxer-style),
    // so the dashboard isn't blocked on it during onboarding. Flag it up front
    // so the dashboard banner shows before the backfill function picks it up.
    await step.run("mark-backfill-pending", async () => {
      await db
        .update(emailAccounts)
        .set({ backfillStartedAt: new Date() })
        .where(eq(emailAccounts.id, accountId));
    });
    await step.sendEvent("backfill-recent", {
      name: "app/account.backfill",
      data: {
        accountId,
        afterMs: Date.now() - BACKFILL_DAYS * 24 * 60 * 60 * 1000,
        beforeMs: Date.now() + 24 * 60 * 60 * 1000,
        free: true,
      },
    });

    return { labels: Object.keys(labelMap).length, triaged: initialIds.length };
  },
);

/**
 * Imports and triages a window of existing inbox mail (on connect: the last
 * 5 days; afterwards: older 5-day chunks the user requests from the Inbox
 * page). Capped at 300 emails per run, like Fyxer's initial import.
 */
export const backfillAccount = inngest.createFunction(
  {
    id: "backfill-account",
    retries: 1,
    concurrency: { key: "event.data.accountId", limit: 1 },
    triggers: { event: "app/account.backfill" },
  },
  async ({ event, step }) => {
    const { accountId, afterMs, beforeMs, free } = event.data as {
      accountId: string;
      afterMs: number;
      beforeMs: number;
      /** True for the automatic import right after connecting (no credits charged). */
      free?: boolean;
    };

    // Drives the "importing your mail" banner in the dashboard.
    await step.run("mark-backfill-running", async () => {
      await db
        .update(emailAccounts)
        .set({ backfillStartedAt: new Date() })
        .where(eq(emailAccounts.id, accountId));
    });

    const ids = await step.run("list-window", async () => {
      const ctx = await loadContext(accountId);
      if (!ctx) return [] as string[];
      const q = `after:${Math.floor(afterMs / 1000)} before:${Math.ceil(beforeMs / 1000)}`;
      return listInboxIdsByQuery(ctx.gmail, q, BACKFILL_MAX);
    });

    for (let i = 0; i < ids.length; i += TRIAGE_CONCURRENCY) {
      const chunk = ids.slice(i, i + TRIAGE_CONCURRENCY);
      await step.run(`triage-batch-${i}`, async () => {
        const ctx = await loadContext(accountId);
        if (!ctx) return;
        await Promise.all(
          chunk.map((messageId) => processInboxMessage(ctx, messageId, { free: free === true })),
        );
      });
    }

    await step.run("mark-backfill-done", async () => {
      await db
        .update(emailAccounts)
        .set({ backfillStartedAt: null })
        .where(eq(emailAccounts.id, accountId));
    });

    return { found: ids.length };
  },
);

/**
 * Safety-net fan-out. Real-time sync is driven by Gmail Pub/Sub push
 * (/api/gmail/push); this low-frequency poll only reconciles missed pushes.
 */
export const scheduleSyncs = inngest.createFunction(
  { id: "schedule-syncs", retries: 0, triggers: { cron: "*/30 * * * *" } },
  async ({ step }) => {
    const { eligible: accounts, stuck } = await step.run("list-accounts", async () => {
      const rows = await db.query.emailAccounts.findMany({
        where: eq(emailAccounts.status, "active"),
      });
      const eligible: { accountId: string }[] = [];
      const stuck: { accountId: string }[] = [];
      const staleBefore = Date.now() - 10 * 60 * 1000;
      for (const account of rows) {
        if (!(await hasActiveAccess(account.userId))) continue;
        if (!account.lastHistoryId) {
          // Setup never ran (e.g. the connected-event send failed) — retry it,
          // but leave freshly linked accounts alone while setup is in flight.
          if (account.createdAt.getTime() < staleBefore) stuck.push({ accountId: account.id });
          continue;
        }
        eligible.push({ accountId: account.id });
      }
      return { eligible, stuck };
    });

    if (accounts.length > 0) {
      await step.sendEvent(
        "fan-out",
        accounts.map((a) => ({ name: "app/account.sync", data: a })),
      );
    }
    if (stuck.length > 0) {
      await step.sendEvent(
        "retry-setup",
        stuck.map((a) => ({ name: "app/account.connected", data: a })),
      );
    }
    return { queued: accounts.length, setupRetried: stuck.length };
  },
);

/** Incremental Gmail sync + triage pipeline for a single account. */
export const syncAccount = inngest.createFunction(
  {
    id: "sync-account",
    retries: 1,
    concurrency: { key: "event.data.accountId", limit: 1 },
    // Pub/Sub sends a burst of notifications per mailbox change; collapse them.
    debounce: { key: "event.data.accountId", period: "15s", timeout: "2m" },
    triggers: { event: "app/account.sync" },
  },
  async ({ event, step }) => {
    const { accountId } = event.data as { accountId: string };

    const changes = await step.run("fetch-history", async () => {
      const account = await db.query.emailAccounts.findFirst({
        where: eq(emailAccounts.id, accountId),
      });
      if (!account?.lastHistoryId || account.status !== "active") return null;

      const gmail = getGmailClient(account.refreshTokenEnc);
      try {
        const result = await listHistory(gmail, account.lastHistoryId);
        if (result.historyExpired) {
          // Cursor too old: re-anchor to now; the missed window is skipped intentionally.
          const historyId = await getCurrentHistoryId(gmail);
          await db
            .update(emailAccounts)
            .set({ lastHistoryId: historyId, lastSyncedAt: new Date() })
            .where(eq(emailAccounts.id, accountId));
          return null;
        }
        return {
          inboxIds: result.addedInboxIds.slice(0, MAX_MESSAGES_PER_RUN),
          newHistoryId: result.newHistoryId,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        // invalid_grant => user revoked access; stop syncing until they reconnect.
        if (message.includes("invalid_grant")) {
          await db
            .update(emailAccounts)
            .set({ status: "error", lastError: "Gmail access revoked. Please reconnect." })
            .where(eq(emailAccounts.id, accountId));
          return null;
        }
        throw err;
      }
    });

    if (!changes) return { processed: 0 };

    for (const messageId of changes.inboxIds) {
      await step.run(`inbox-${messageId}`, async () => {
        const ctx = await loadContext(accountId);
        if (!ctx) return;
        await processInboxMessage(ctx, messageId);
      });
    }

    await step.run("advance-cursor", async () => {
      await db
        .update(emailAccounts)
        .set({ lastHistoryId: changes.newHistoryId, lastSyncedAt: new Date() })
        .where(eq(emailAccounts.id, accountId));
    });

    return { processed: changes.inboxIds.length };
  },
);

/**
 * Daily: renews Gmail push watches. Google expires a watch after ~7 days;
 * renewing every day keeps a comfortable safety margin.
 */
export const renewWatches = inngest.createFunction(
  { id: "renew-watches", retries: 1, triggers: { cron: "0 3 * * *" } },
  async ({ step }) => {
    const topic = process.env.GMAIL_PUBSUB_TOPIC;
    if (!topic) return { renewed: 0 };

    const accountIds = await step.run("list-accounts", async () => {
      const rows = await db.query.emailAccounts.findMany({
        where: eq(emailAccounts.status, "active"),
      });
      const eligible: string[] = [];
      for (const account of rows) {
        if (!account.lastHistoryId) continue;
        if (await hasActiveAccess(account.userId)) eligible.push(account.id);
      }
      return eligible;
    });

    let renewed = 0;
    for (const accountId of accountIds) {
      await step.run(`renew-${accountId}`, async () => {
        const account = await db.query.emailAccounts.findFirst({
          where: eq(emailAccounts.id, accountId),
        });
        if (!account) return;
        try {
          const gmail = getGmailClient(account.refreshTokenEnc);
          const expiration = await startWatch(gmail, topic);
          await db
            .update(emailAccounts)
            .set({ watchExpiration: expiration })
            .where(eq(emailAccounts.id, accountId));
          renewed += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (message.includes("invalid_grant")) {
            await db
              .update(emailAccounts)
              .set({ status: "error", lastError: "Gmail access revoked. Please reconnect." })
              .where(eq(emailAccounts.id, accountId));
            return;
          }
          throw err;
        }
      });
    }
    return { renewed };
  },
);

/** Hourly: sends the daily brief to users whose local send-hour just arrived. */
export const dailyBrief = inngest.createFunction(
  { id: "daily-brief", retries: 1, triggers: { cron: "0 * * * *" } },
  async ({ step }) => {
    const userIds = await step.run("select-users", async () => {
      const allUsers = await db.query.users.findMany({
        where: isNotNull(users.onboardedAt),
      });
      const now = new Date();
      const selected: string[] = [];
      for (const user of allUsers) {
        const prefs = user.preferences ?? DEFAULT_PREFERENCES;
        if (!prefs.briefEnabled) continue;
        if (!(await hasActiveAccess(user.id))) continue;
        let localHour: number;
        try {
          localHour = Number(
            new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              hour12: false,
              timeZone: prefs.timezone || "UTC",
            }).format(now),
          );
        } catch {
          localHour = now.getUTCHours();
        }
        if (localHour % 24 === prefs.briefHour % 24) selected.push(user.id);
      }
      return selected;
    });

    let sent = 0;
    for (const userId of userIds) {
      const ok = await step.run(`brief-${userId}`, () => buildAndSendBrief(userId));
      if (ok) sent += 1;
    }
    return { candidates: userIds.length, sent };
  },
);

/**
 * Daily: removes Wingman-created drafts the user never sent, once they're older
 * than the user's draftCleanupDays preference (0 disables the cleanup).
 */
export const cleanupStaleDrafts = inngest.createFunction(
  { id: "cleanup-stale-drafts", retries: 0, triggers: { cron: "30 4 * * *" } },
  async ({ step }) => {
    const targets = await step.run("select-accounts", async () => {
      const rows = await db.query.emailAccounts.findMany({
        where: eq(emailAccounts.status, "active"),
      });
      const daysByUser = new Map<string, number>();
      const eligible: { accountId: string; days: number }[] = [];
      for (const account of rows) {
        let days = daysByUser.get(account.userId);
        if (days === undefined) {
          const user = await db.query.users.findFirst({ where: eq(users.id, account.userId) });
          const prefs = user?.preferences ?? DEFAULT_PREFERENCES;
          days = prefs.draftCleanupDays ?? 14;
          if (days > 0 && !(await hasActiveAccess(account.userId))) days = 0;
          daysByUser.set(account.userId, days);
        }
        if (days > 0) eligible.push({ accountId: account.id, days });
      }
      return eligible;
    });

    let deleted = 0;
    for (const target of targets) {
      deleted += await step.run(`cleanup-${target.accountId}`, async () => {
        const account = await db.query.emailAccounts.findFirst({
          where: eq(emailAccounts.id, target.accountId),
        });
        if (!account || account.status !== "active") return 0;

        const cutoff = new Date(Date.now() - target.days * 24 * 60 * 60 * 1000);
        const stale = await db.query.messages.findMany({
          where: and(
            eq(messages.accountId, target.accountId),
            isNotNull(messages.draftId),
            lt(messages.receivedAt, cutoff),
          ),
          limit: 50,
        });
        if (stale.length === 0) return 0;

        const gmail = getGmailClient(account.refreshTokenEnc);
        let removed = 0;
        for (const row of stale) {
          if (await deleteDraft(gmail, row.draftId!)) removed += 1;
          // Clear draftId either way; a 404 means the draft was sent or discarded.
          await db.update(messages).set({ draftId: null }).where(eq(messages.id, row.id));
        }
        return removed;
      });
    }

    return { accounts: targets.length, deleted };
  },
);

/**
 * Weekly: quietly retrains each user's voice profile from their most recent
 * sent replies, so drafts keep up with how their writing evolves.
 */
export const weeklyVoiceRetrain = inngest.createFunction(
  { id: "weekly-voice-retrain", retries: 0, triggers: { cron: "30 5 * * 1" } },
  async ({ step }) => {
    const targets = await step.run("select-users", async () => {
      const allUsers = await db.query.users.findMany({
        where: isNotNull(users.onboardedAt),
      });
      const selected: string[] = [];
      for (const user of allUsers) {
        const prefs = user.preferences ?? DEFAULT_PREFERENCES;
        if (!(prefs.autoRetrainVoice ?? true)) continue;
        if (await hasActiveAccess(user.id)) selected.push(user.id);
      }
      return selected;
    });

    let retrained = 0;
    for (const userId of targets) {
      await step.run(`retrain-${userId}`, async () => {
        const account = await db.query.emailAccounts.findFirst({
          where: and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, "active")),
        });
        if (!account) return;
        try {
          const gmail = getGmailClient(account.refreshTokenEnc);
          const samples = await listRecentSentTexts(gmail, account.email, 40);
          if (samples.length === 0) return;
          const profile = await buildVoiceProfile(samples);
          await db.update(users).set({ voiceProfile: profile }).where(eq(users.id, userId));
          retrained += 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          if (!message.includes("invalid_grant")) throw err;
        }
      });
    }
    return { candidates: targets.length, retrained };
  },
);

/** Re-runs classification + summary on already-imported history. */
export const retriageHistory = inngest.createFunction(
  {
    id: "retriage-history",
    retries: 0,
    concurrency: { key: "event.data.userId", limit: 1 },
    triggers: { event: "app/user.retriage" },
  },
  async ({ event, step }) => {
    const { userId, jobId } = event.data as { userId: string; jobId: string };

    const listed = await step.run("list-messages", async () => {
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
        return [] as { accountId: string; gmailId: string }[];
      }

      const rows = await listRetriageTargets(userId, job.scope as RetriageScope);
      await db
        .update(retriageJobs)
        .set({
          status: rows.length === 0 ? "done" : "running",
          total: rows.length,
          processed: rows.length === 0 ? 0 : job.processed,
          lastGmailMessageId: "__started__",
          updatedAt: new Date(),
        })
        .where(eq(retriageJobs.id, jobId));
      return rows;
    });

    for (let i = 0; i < listed.length; i += TRIAGE_CONCURRENCY) {
      const chunk = listed.slice(i, i + TRIAGE_CONCURRENCY);
      const outcome = await step.run(`retriage-batch-${i}`, async () => {
        const job = await db.query.retriageJobs.findFirst({
          where: eq(retriageJobs.id, jobId),
        });
        if (!job || job.status === "cancel_requested" || job.status === "cancelled") {
          await db
            .update(retriageJobs)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(retriageJobs.id, jobId));
          return "cancel" as const;
        }
        if (job.processed > i) return "ok" as const;

        const byAccount = new Map<string, string[]>();
        for (const item of chunk) {
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
          await Promise.all(
            rows.map(async (r) => {
              try {
                await retriageStoredRow(ctx, r);
              } catch (err) {
                console.error("retriage row failed", { id: r.id, err });
              }
            }),
          );
        }

        await db
          .update(retriageJobs)
          .set({
            processed: i + chunk.length,
            lastGmailMessageId: chunk.at(-1)?.gmailId ?? null,
            updatedAt: new Date(),
          })
          .where(eq(retriageJobs.id, jobId));
        return "ok" as const;
      });
      if (outcome === "cancel") return { cancelled: true, processed: i };
    }

    await step.run("finish", async () => {
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
    });

    return { processed: listed.length };
  },
);

export const functions = [
  accountConnected,
  backfillAccount,
  scheduleSyncs,
  syncAccount,
  renewWatches,
  dailyBrief,
  cleanupStaleDrafts,
  weeklyVoiceRetrain,
  retriageHistory,
];
