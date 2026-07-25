import { eq, isNotNull } from "drizzle-orm";
import { inngest } from "./client";
import {
  db,
  emailAccounts,
  rules,
  users,
  DEFAULT_PREFERENCES,
} from "@/lib/db";
import {
  ensureLabels,
  getCurrentHistoryId,
  getGmailClient,
  listHistory,
  listRecentInboxIds,
  listRecentSentTexts,
  startWatch,
} from "@/lib/gmail";
import { buildVoiceProfile } from "@/lib/ai";
import { processInboxMessage, processSentMessage, type PipelineContext } from "@/lib/pipeline";
import { buildAndSendBrief } from "@/lib/brief";
import { hasActiveAccess } from "@/lib/billing";

const MAX_MESSAGES_PER_RUN = 20;

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
    const { accountId } = event.data as { accountId: string };

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
      const samples = await listRecentSentTexts(gmail, account.email, 60);
      const profile = await buildVoiceProfile(samples);
      await db.update(users).set({ voiceProfile: profile }).where(eq(users.id, account.userId));
    });

    const initialIds = await step.run("list-initial-inbox", async () => {
      const ctx = await loadContext(accountId);
      if (!ctx) return [] as string[];
      return listRecentInboxIds(ctx.gmail, 10);
    });

    for (const messageId of initialIds) {
      await step.run(`triage-${messageId}`, async () => {
        const ctx = await loadContext(accountId);
        if (!ctx) return;
        await processInboxMessage(ctx, messageId);
      });
    }

    await step.run("mark-onboarded", async () => {
      const account = await db.query.emailAccounts.findFirst({
        where: eq(emailAccounts.id, accountId),
      });
      if (!account) return;
      await db
        .update(users)
        .set({ onboardedAt: new Date() })
        .where(eq(users.id, account.userId));
    });

    return { labels: Object.keys(labelMap).length, triaged: initialIds.length };
  },
);

/**
 * Safety-net fan-out. Real-time sync is driven by Gmail Pub/Sub push
 * (/api/gmail/push); this low-frequency poll only reconciles missed pushes.
 */
export const scheduleSyncs = inngest.createFunction(
  { id: "schedule-syncs", retries: 0, triggers: { cron: "*/30 * * * *" } },
  async ({ step }) => {
    const accounts = await step.run("list-accounts", async () => {
      const rows = await db.query.emailAccounts.findMany({
        where: eq(emailAccounts.status, "active"),
      });
      const eligible: { accountId: string }[] = [];
      for (const account of rows) {
        if (!account.lastHistoryId) continue; // onboarding not finished
        if (await hasActiveAccess(account.userId)) eligible.push({ accountId: account.id });
      }
      return eligible;
    });

    if (accounts.length > 0) {
      await step.sendEvent(
        "fan-out",
        accounts.map((a) => ({ name: "app/account.sync", data: a })),
      );
    }
    return { queued: accounts.length };
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
          sentIds: result.addedSentIds.slice(0, MAX_MESSAGES_PER_RUN),
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

    for (const messageId of changes.sentIds) {
      await step.run(`sent-${messageId}`, async () => {
        const ctx = await loadContext(accountId);
        if (!ctx) return;
        const prefs = ctx.user.preferences ?? DEFAULT_PREFERENCES;
        await processSentMessage(ctx, messageId, prefs.followUpDays);
      });
    }

    await step.run("advance-cursor", async () => {
      await db
        .update(emailAccounts)
        .set({ lastHistoryId: changes.newHistoryId, lastSyncedAt: new Date() })
        .where(eq(emailAccounts.id, accountId));
    });

    return { processed: changes.inboxIds.length + changes.sentIds.length };
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

export const functions = [
  accountConnected,
  scheduleSyncs,
  syncAccount,
  renewWatches,
  dailyBrief,
];
