import { and, desc, eq, gte, inArray, isNotNull, isNull } from "drizzle-orm";
import { db, emailAccounts, messages, users, DEFAULT_PREFERENCES } from "@/lib/db";
import { generateReplyDraft } from "@/lib/ai";
import { detectDevNotification, shouldBlockDraft } from "@/lib/dev-notifications";
import { migratedDraftPreferences, resolveDraftStyle } from "@/lib/draft-style";
import { createReplyDraft, getGmailClient, getMessageMeta } from "@/lib/gmail";
import { isNoActionSummary } from "@/lib/triage";
import { consumeCredits } from "@/lib/usage";

export type DraftWriteResult = {
  status: "done" | "skipped" | "idle" | "error";
  messageId?: string;
  draftId?: string | null;
  reason?: string;
};

export async function persistDraftPolicy(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return null;
  const current = user.preferences ?? DEFAULT_PREFERENCES;
  const next = migratedDraftPreferences(current);
  if (next !== current && JSON.stringify(next) !== JSON.stringify(current)) {
    await db.update(users).set({ preferences: next }).where(eq(users.id, userId));
  }
  return { ...user, preferences: next };
}

export async function requestDraft(userId: string, messageId: string): Promise<DraftWriteResult> {
  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  const row = await db.query.messages.findFirst({
    where: and(eq(messages.id, messageId), inArray(messages.accountId, accounts.map((a) => a.id))),
  });
  if (!row) return { status: "error", reason: "not-found" };
  if (row.draftId) return { status: "done", messageId, draftId: row.draftId };
  await db
    .update(messages)
    .set({ actions: { ...(row.actions ?? {}), draftRequested: true } })
    .where(eq(messages.id, row.id));
  return { status: "done", messageId };
}

export async function writeDraftForMessageId(
  userId: string,
  messageId: string,
  opts: { manual?: boolean } = {},
): Promise<DraftWriteResult> {
  const user = await persistDraftPolicy(userId);
  if (!user) return { status: "error", reason: "no-user" };

  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  const row = await db.query.messages.findFirst({
    where: and(eq(messages.id, messageId), inArray(messages.accountId, accounts.map((a) => a.id))),
  });
  if (!row) return { status: "error", reason: "not-found" };
  if (row.draftId) return { status: "done", messageId, draftId: row.draftId };

  const account = accounts.find((a) => a.id === row.accountId);
  if (!account || account.status !== "active") return { status: "skipped", messageId, reason: "no-account" };

  if (isNoActionSummary(row.summary)) {
    await db
      .update(messages)
      .set({
        category: "fyi",
        actions: { ...(row.actions ?? {}), draftRequested: false, draftSkipReason: "no-action-summary" },
      })
      .where(eq(messages.id, row.id));
    console.info("draft-gate", { messageId: row.id, allowed: false, reason: "no-action-summary" });
    return { status: "skipped", messageId, reason: "no-action-summary" };
  }

  const gmail = getGmailClient(account.refreshTokenEnc);
  const meta = await getMessageMeta(gmail, row.gmailMessageId, account.email);
  if (!meta) return { status: "skipped", messageId, reason: "no-meta" };

  const signal = detectDevNotification({
    from: meta.from,
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
  });
  const prefs = user.preferences ?? DEFAULT_PREFERENCES;
  const style = resolveDraftStyle(prefs);
  const reasons: string[] = [];
  if (!row.summary) reasons.push("summary=null");
  if (row.category !== "to_respond") reasons.push(`category=${row.category}`);
  if (signal?.skipDraft) reasons.push("dev-skip");
  if (
    shouldBlockDraft({
      fromEmail: meta.fromEmail,
      from: meta.from,
      category: row.category,
      listUnsubscribe: meta.listUnsubscribe,
    })
  ) {
    reasons.push("blocked_gate");
  }
  if (!opts.manual && style === "manual") reasons.push("style=manual");
  if (!opts.manual && style === "important_only") reasons.push("important_only");

  if (reasons.length > 0) {
    await db
      .update(messages)
      .set({
        actions: { ...(row.actions ?? {}), draftRequested: false, draftSkipReason: reasons.join(",") },
      })
      .where(eq(messages.id, row.id));
    console.info("draft-gate", { messageId: row.id, from: meta.fromEmail, allowed: false, reason: reasons.join(",") });
    return { status: "skipped", messageId, reason: reasons.join(",") };
  }

  if (!(await consumeCredits(userId, "draft"))) {
    return { status: "skipped", messageId, reason: "no-credits" };
  }

  const body = await generateReplyDraft({
    userName: user.name ?? account.email,
    voiceProfile: user.voiceProfile,
    toneInstructions: user.voiceProfile ? "" : prefs.toneInstructions,
    from: meta.from,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
    summary: row.summary ?? "",
  });
  if (!body) return { status: "skipped", messageId, reason: "empty-draft" };

  const draftId = await createReplyDraft(gmail, {
    threadId: row.threadId,
    to: meta.from,
    subject: meta.subject,
    body,
    inReplyTo: meta.messageIdHeader || undefined,
    references: meta.references || undefined,
  });

  await db
    .update(messages)
    .set({
      draftId,
      actions: { ...(row.actions ?? {}), draftCreated: true, draftRequested: false, draftSkipReason: undefined },
    })
    .where(eq(messages.id, row.id));
  console.info("draft-gate", { messageId: row.id, from: meta.fromEmail, allowed: true, reason: "eligible" });
  return { status: "done", messageId, draftId };
}

export async function processNextDraft(userId: string): Promise<DraftWriteResult> {
  await persistDraftPolicy(userId);
  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return { status: "idle" };

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const pending = await db.query.messages.findMany({
    where: and(
      inArray(messages.accountId, accountIds),
      eq(messages.category, "to_respond"),
      isNotNull(messages.summary),
      isNull(messages.draftId),
      gte(messages.receivedAt, since),
    ),
    orderBy: [desc(messages.receivedAt)],
    limit: 40,
  });

  const requested = pending.find((m) => m.actions?.draftRequested);
  const next =
    requested ??
    pending.find((m) => !isNoActionSummary(m.summary) && m.actions?.draftSkipReason !== "no-action-summary");
  const noAction = pending.find((m) => isNoActionSummary(m.summary));

  if (!next && noAction) {
    return writeDraftForMessageId(userId, noAction.id, { manual: false });
  }
  if (!next) return { status: "idle" };
  return writeDraftForMessageId(userId, next.id, { manual: Boolean(next.actions?.draftRequested) });
}
