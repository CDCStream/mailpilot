import { and, eq, inArray } from "drizzle-orm";
import type { gmail_v1 } from "googleapis";
import {
  db,
  followups,
  messages,
  DEFAULT_PREFERENCES,
  type Category,
  type ParsedRule,
  type UserPreferences,
  type VoiceProfile,
} from "@/lib/db";
import {
  applyLabels,
  createReplyDraft,
  getMessageMeta,
  parseEmailAddress,
  LOW_PRIORITY_CATEGORIES,
} from "@/lib/gmail";
import { classifyEmail, generateReplyDraft } from "@/lib/ai";
import { applyRules } from "@/lib/rules-engine";
import { consumeBudget } from "@/lib/usage";

export type PipelineContext = {
  gmail: gmail_v1.Gmail;
  account: { id: string; email: string; labelMap: Record<string, string> | null };
  user: {
    id: string;
    name: string | null;
    voiceProfile: VoiceProfile | null;
    preferences: UserPreferences | null;
  };
  rules: { parsed: ParsedRule; description: string }[];
};

export type ProcessResult =
  | { status: "processed"; category: Category; draftCreated: boolean }
  | { status: "skipped"; reason: string };

/**
 * Full triage pipeline for one inbound message:
 * classify -> user rules -> Gmail labels/archive -> optional voice draft -> record.
 */
export async function processInboxMessage(
  ctx: PipelineContext,
  messageId: string,
): Promise<ProcessResult> {
  const prefs = ctx.user.preferences ?? DEFAULT_PREFERENCES;

  const meta = await getMessageMeta(ctx.gmail, messageId, ctx.account.email);
  if (!meta) return { status: "skipped", reason: "message gone" };
  if (meta.isFromMe) return { status: "skipped", reason: "own message" };

  // Dedupe: claim the message row first; bail if another run already handled it.
  const inserted = await db
    .insert(messages)
    .values({
      accountId: ctx.account.id,
      gmailMessageId: meta.id,
      threadId: meta.threadId,
      fromAddress: meta.from,
      subject: meta.subject,
      snippet: meta.snippet.slice(0, 200),
      receivedAt: meta.date,
    })
    .onConflictDoNothing()
    .returning({ id: messages.id });
  if (inserted.length === 0) return { status: "skipped", reason: "already processed" };
  const rowId = inserted[0].id;

  // An inbound external message closes any pending follow-up on this thread.
  await db
    .update(followups)
    .set({ status: "replied" })
    .where(
      and(
        eq(followups.accountId, ctx.account.id),
        eq(followups.threadId, meta.threadId),
        inArray(followups.status, ["waiting", "due"]),
      ),
    );

  if (!(await consumeBudget(ctx.user.id, "classifications"))) {
    return { status: "skipped", reason: "daily classification budget reached" };
  }

  const classification = await classifyEmail({
    from: meta.from,
    to: meta.to,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
  });

  const outcome = applyRules(ctx.rules, {
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
    category: classification.category,
  });

  // --- Apply Gmail label operations ---
  const labelMap = ctx.account.labelMap ?? {};
  const addLabelIds: string[] = [];
  const removeLabelIds: string[] = [];

  const categoryLabelId = labelMap[outcome.category];
  if (categoryLabelId) addLabelIds.push(categoryLabelId);
  if (outcome.star) addLabelIds.push("STARRED");

  const shouldArchive =
    !outcome.keepInInbox &&
    (outcome.forceArchive ||
      (prefs.archiveLowPriority && LOW_PRIORITY_CATEGORIES.includes(outcome.category)));
  if (shouldArchive) removeLabelIds.push("INBOX");

  if (addLabelIds.length || removeLabelIds.length) {
    await applyLabels(ctx.gmail, meta.id, addLabelIds, removeLabelIds);
  }

  // --- Voice draft for emails that need a reply ---
  let draftId: string | null = null;
  const wantsDraft =
    outcome.category === "to_respond" &&
    classification.needs_reply &&
    prefs.draftsEnabled &&
    !outcome.skipDraft;

  if (wantsDraft && (await consumeBudget(ctx.user.id, "drafts"))) {
    try {
      const body = await generateReplyDraft({
        userName: ctx.user.name ?? ctx.account.email,
        voiceProfile: ctx.user.voiceProfile,
        toneInstructions: prefs.toneInstructions,
        from: meta.from,
        subject: meta.subject,
        bodyExcerpt: meta.bodyExcerpt,
        summary: classification.summary,
      });
      if (body) {
        draftId = await createReplyDraft(ctx.gmail, {
          threadId: meta.threadId,
          to: meta.from,
          subject: meta.subject,
          body,
          inReplyTo: meta.messageIdHeader || undefined,
          references: meta.references || undefined,
        });
      }
    } catch (err) {
      console.error("draft generation failed", { messageId: meta.id, err });
    }
  }

  await db
    .update(messages)
    .set({
      category: outcome.category,
      summary: classification.summary,
      draftId,
      actions: {
        labeled: outcome.category,
        archived: shouldArchive,
        draftCreated: Boolean(draftId),
        ruleApplied: outcome.appliedRule,
      },
    })
    .where(eq(messages.id, rowId));

  return { status: "processed", category: outcome.category, draftCreated: Boolean(draftId) };
}

/** Records a follow-up expectation when the user sends an email to someone external. */
export async function processSentMessage(
  ctx: PipelineContext,
  messageId: string,
  followUpDays: number,
): Promise<void> {
  const meta = await getMessageMeta(ctx.gmail, messageId, ctx.account.email);
  if (!meta || !meta.isFromMe) return;

  const recipient = parseEmailAddress(meta.to);
  if (!recipient || recipient === ctx.account.email.toLowerCase()) return;

  const dueAt = new Date(meta.date.getTime() + followUpDays * 24 * 60 * 60 * 1000);

  await db
    .insert(followups)
    .values({
      accountId: ctx.account.id,
      threadId: meta.threadId,
      subject: meta.subject,
      toRecipients: meta.to,
      sentAt: meta.date,
      dueAt,
      status: "waiting",
    })
    .onConflictDoUpdate({
      target: [followups.accountId, followups.threadId],
      set: { sentAt: meta.date, dueAt, status: "waiting", subject: meta.subject },
    });
}
