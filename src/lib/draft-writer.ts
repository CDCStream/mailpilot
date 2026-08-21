import { and, desc, eq, gte, inArray, isNotNull, ne } from "drizzle-orm";
import { db, emailAccounts, messages, users, DEFAULT_PREFERENCES } from "@/lib/db";
import { generateReplyDraft } from "@/lib/ai";
import { detectDevNotification, shouldBlockDraft } from "@/lib/dev-notifications";
import { migratedDraftPreferences, resolveDraftStyle } from "@/lib/draft-style";
import {
  createReplyDraft,
  deleteDraft,
  getGmailClient,
  getMessageMeta,
  updateReplyDraft,
} from "@/lib/gmail";
import { draftedThreadIds, pickLatestPerThread } from "@/lib/thread-draft";
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

async function threadRows(accountId: string, threadId: string) {
  return db.query.messages.findMany({
    where: and(eq(messages.accountId, accountId), eq(messages.threadId, threadId)),
    orderBy: [desc(messages.receivedAt)],
  });
}

/** Keep one Gmail draft per thread; delete extras and point every row at the keeper. */
export async function reconcileThreadDrafts(userId: string): Promise<number> {
  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  let removed = 0;
  for (const account of accounts) {
    const drafted = await db.query.messages.findMany({
      where: and(eq(messages.accountId, account.id), isNotNull(messages.draftId)),
    });
    const byThread = new Map<string, typeof drafted>();
    for (const row of drafted) {
      const list = byThread.get(row.threadId) ?? [];
      list.push(row);
      byThread.set(row.threadId, list);
    }
    const gmail = getGmailClient(account.refreshTokenEnc);
    for (const [, rows] of byThread) {
      const uniqueIds = [...new Set(rows.map((r) => r.draftId).filter((id): id is string => Boolean(id)))];
      if (uniqueIds.length <= 1) continue;
      const keeper = pickLatestPerThread(rows)[0];
      const keepId = keeper?.draftId;
      if (!keepId) continue;
      for (const extra of uniqueIds) {
        if (extra === keepId) continue;
        try {
          await deleteDraft(gmail, extra);
          removed += 1;
        } catch (err) {
          console.error("dedupe draft delete failed", { extra, err });
        }
      }
      await db
        .update(messages)
        .set({ draftId: keepId })
        .where(and(eq(messages.accountId, account.id), eq(messages.threadId, keeper.threadId)));
    }
  }
  if (removed > 0) console.info("draft-dedupe", { userId, removed });
  return removed;
}

export async function requestDraft(userId: string, messageId: string): Promise<DraftWriteResult> {
  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  const row = await db.query.messages.findFirst({
    where: and(eq(messages.id, messageId), inArray(messages.accountId, accounts.map((a) => a.id))),
  });
  if (!row) return { status: "error", reason: "not-found" };
  const siblings = await threadRows(row.accountId, row.threadId);
  const existing = siblings.find((s) => s.draftId)?.draftId;
  if (existing) return { status: "done", messageId, draftId: existing };
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

  const siblings = await threadRows(row.accountId, row.threadId);
  const latest = pickLatestPerThread(siblings)[0] ?? row;
  const existingDraftId = siblings.find((s) => s.draftId)?.draftId ?? null;

  const account = accounts.find((a) => a.id === row.accountId);
  if (!account || account.status !== "active") return { status: "skipped", messageId, reason: "no-account" };

  if (isNoActionSummary(latest.summary)) {
    await db
      .update(messages)
      .set({
        category: "fyi",
        actions: { ...(latest.actions ?? {}), draftRequested: false, draftSkipReason: "no-action-summary" },
      })
      .where(eq(messages.id, latest.id));
    console.info("draft-gate", { messageId: latest.id, allowed: false, reason: "no-action-summary" });
    return { status: "skipped", messageId: latest.id, reason: "no-action-summary" };
  }

  const gmail = getGmailClient(account.refreshTokenEnc);
  const meta = await getMessageMeta(gmail, latest.gmailMessageId, account.email);
  if (!meta) return { status: "skipped", messageId: latest.id, reason: "no-meta" };

  const signal = detectDevNotification({
    from: meta.from,
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
  });
  const prefs = user.preferences ?? DEFAULT_PREFERENCES;
  const style = resolveDraftStyle(prefs);
  const reasons: string[] = [];
  if (!latest.summary) reasons.push("summary=null");
  if (latest.category !== "to_respond") reasons.push(`category=${latest.category}`);
  if (signal?.skipDraft) reasons.push("dev-skip");
  if (
    shouldBlockDraft({
      fromEmail: meta.fromEmail,
      from: meta.from,
      category: latest.category,
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
        actions: { ...(latest.actions ?? {}), draftRequested: false, draftSkipReason: reasons.join(",") },
      })
      .where(eq(messages.id, latest.id));
    console.info("draft-gate", {
      messageId: latest.id,
      from: meta.fromEmail,
      allowed: false,
      reason: reasons.join(","),
    });
    return { status: "skipped", messageId: latest.id, reason: reasons.join(",") };
  }

  if (!existingDraftId && !(await consumeCredits(userId, "draft"))) {
    return { status: "skipped", messageId: latest.id, reason: "no-credits" };
  }

  const threadContext = siblings
    .slice()
    .reverse()
    .map((s) => `- ${s.subject ?? "(no subject)"}: ${s.summary ?? s.snippet ?? ""}`)
    .join("\n");

  const body = await generateReplyDraft({
    userName: user.name ?? account.email,
    voiceProfile: user.voiceProfile,
    toneInstructions: user.voiceProfile ? "" : prefs.toneInstructions,
    from: meta.from,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
    summary: latest.summary ?? "",
    threadContext,
  });
  if (!body) return { status: "skipped", messageId: latest.id, reason: "empty-draft" };

  const payload = {
    threadId: latest.threadId,
    to: meta.from,
    subject: meta.subject,
    body,
    inReplyTo: meta.messageIdHeader || undefined,
    references: meta.references || undefined,
  };

  let draftId = existingDraftId;
  if (existingDraftId) {
    draftId = (await updateReplyDraft(gmail, existingDraftId, payload)) ?? (await createReplyDraft(gmail, payload));
    if (draftId !== existingDraftId) {
      try {
        await deleteDraft(gmail, existingDraftId);
      } catch {
        /* replaced */
      }
    }
  } else {
    draftId = await createReplyDraft(gmail, payload);
  }

  await db
    .update(messages)
    .set({
      draftId,
      actions: { ...(latest.actions ?? {}), draftCreated: true, draftRequested: false, draftSkipReason: undefined },
    })
    .where(eq(messages.id, latest.id));
  await db
    .update(messages)
    .set({ draftId })
    .where(
      and(
        eq(messages.accountId, latest.accountId),
        eq(messages.threadId, latest.threadId),
        ne(messages.id, latest.id),
      ),
    );

  console.info("draft-gate", {
    messageId: latest.id,
    threadId: latest.threadId,
    from: meta.fromEmail,
    allowed: true,
    reason: existingDraftId ? "updated-thread-draft" : "eligible",
  });
  return { status: "done", messageId: latest.id, draftId };
}

export async function processNextDraft(userId: string): Promise<DraftWriteResult> {
  await persistDraftPolicy(userId);
  await reconcileThreadDrafts(userId);

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
      gte(messages.receivedAt, since),
    ),
    orderBy: [desc(messages.receivedAt)],
    limit: 80,
  });

  const draftedRows = await db.query.messages.findMany({
    where: and(inArray(messages.accountId, accountIds), isNotNull(messages.draftId)),
    columns: { threadId: true, draftId: true },
    limit: 200,
  });
  const alreadyDrafted = draftedThreadIds([...pending, ...draftedRows]);
  const eligible = pending.filter(
    (m) =>
      !m.draftId &&
      !alreadyDrafted.has(m.threadId) &&
      !isNoActionSummary(m.summary) &&
      m.actions?.draftSkipReason !== "no-action-summary",
  );
  const requested = eligible.find((m) => m.actions?.draftRequested);
  const latestOpen = pickLatestPerThread(eligible);
  const next = requested ?? latestOpen[0];
  const noAction = pending.find((m) => !m.draftId && isNoActionSummary(m.summary));

  if (!next && noAction) {
    return writeDraftForMessageId(userId, noAction.id, { manual: false });
  }
  if (!next) return { status: "idle" };
  return writeDraftForMessageId(userId, next.id, { manual: Boolean(next.actions?.draftRequested) });
}
