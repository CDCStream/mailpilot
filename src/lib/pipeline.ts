import { eq } from "drizzle-orm";
import type { gmail_v1 } from "googleapis";
import {
  db,
  messages,
  archiveSetFor,
  DEFAULT_PREFERENCES,
  type Category,
  type ParsedRule,
  type UserPreferences,
  type VoiceProfile,
} from "@/lib/db";
import { applyLabels, createReplyDraft, getMessageMeta } from "@/lib/gmail";
import { classifyEmail, generateReplyDraft } from "@/lib/ai";
import { detectDevNotification, shouldBlockDraft } from "@/lib/dev-notifications";
import { applyRules } from "@/lib/rules-engine";
import { consumeCredits, underTriageFairUse } from "@/lib/usage";

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

export type ProcessOptions = {
  /**
   * Skip credit consumption — used for the initial import after connecting an
   * account, whose cost is baked into plan pricing instead of the user's credits.
   */
  free?: boolean;
};

/**
 * Full triage pipeline for one inbound message:
 * classify -> user rules -> Gmail labels/archive -> optional voice draft -> record.
 */
export async function processInboxMessage(
  ctx: PipelineContext,
  messageId: string,
  opts: ProcessOptions = {},
): Promise<ProcessResult> {
  const prefs = ctx.user.preferences ?? DEFAULT_PREFERENCES;

  const meta = await getMessageMeta(ctx.gmail, messageId, ctx.account.email);
  if (!meta) return { status: "skipped", reason: "message gone" };
  if (meta.isFromMe) return { status: "skipped", reason: "own message" };

  // "Respect my categories": if the user (or their own filters) already applied a
  // personal label to this message, we still import + classify it so it shows up
  // in the app, but we never touch its Gmail labels or archive it.
  const wingmanLabelIds = new Set(Object.values(ctx.account.labelMap ?? {}));
  const hasUserLabel =
    (prefs.respectUserLabels ?? true) &&
    meta.labelIds.some((id) => id.startsWith("Label_") && !wingmanLabelIds.has(id));

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

  // Triage is free (cost 0); fair-use ceiling is the only hard stop for AI classify.
  if (!opts.free) {
    if (!(await underTriageFairUse(ctx.user.id))) {
      return { status: "skipped", reason: "monthly triage fair-use limit reached" };
    }
    await consumeCredits(ctx.user.id, "triage"); // no-op at cost 0; keeps metering hook
  }

  const devSignal = detectDevNotification({
    from: meta.from,
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
  });

  // Silent bots (Dependabot etc.): archive + label without spending an LLM call.
  let classification = {
    category: (devSignal?.category ?? "fyi") as Category,
    needs_reply: false,
    urgent: false,
    summary: devSignal?.summaryHint ?? meta.subject,
  };

  if (devSignal?.kind !== "silent_archive") {
    classification = await classifyEmail({
      from: meta.from,
      to: meta.to,
      subject: meta.subject,
      bodyExcerpt: meta.bodyExcerpt,
      summaryLanguage: prefs.summaryLanguage,
    });
    if (devSignal?.category) classification.category = devSignal.category;
    if (devSignal?.summaryHint) classification.summary = devSignal.summaryHint;
    if (devSignal?.kind === "human_reply") {
      classification.needs_reply = true;
      classification.category = "to_respond";
    }
    if (
      devSignal?.kind === "action_no_draft" ||
      devSignal?.kind === "deadline_no_draft"
    ) {
      classification.needs_reply = false; // action item, not a prose reply
      classification.category = "to_respond";
    }
    if (devSignal?.kind === "incident" || devSignal?.kind === "noreply_no_draft") {
      classification.needs_reply = false;
    }
  }

  const outcome = applyRules(ctx.rules, {
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
    category: classification.category,
  });

  if (devSignal?.forceArchive) outcome.forceArchive = true;
  if (devSignal?.skipDraft) outcome.skipDraft = true;
  if (devSignal?.category) outcome.category = devSignal.category;

  // --- Apply Gmail label operations (skipped when respecting a user label) ---
  const labelMap = ctx.account.labelMap ?? {};
  const addLabelIds: string[] = [];
  const removeLabelIds: string[] = [];

  if (!hasUserLabel) {
    const categoryLabelId = labelMap[outcome.category];
    if (categoryLabelId) addLabelIds.push(categoryLabelId);
    if (outcome.star) addLabelIds.push("STARRED");
  }

  const shouldArchive =
    !hasUserLabel &&
    !outcome.keepInInbox &&
    (outcome.forceArchive || archiveSetFor(prefs).includes(outcome.category));
  if (shouldArchive) removeLabelIds.push("INBOX");

  if (addLabelIds.length || removeLabelIds.length) {
    await applyLabels(ctx.gmail, meta.id, addLabelIds, removeLabelIds);
  }

  // --- Voice draft for emails that need a reply ---
  let draftId: string | null = null;
  const draftStyle = prefs.draftStyle ?? "everything";
  const blockedDraft =
    shouldBlockDraft({
      fromEmail: meta.fromEmail,
      from: meta.from,
      category: outcome.category,
      listUnsubscribe: meta.listUnsubscribe,
    }) ||
    Boolean(devSignal?.skipDraft) ||
    outcome.skipDraft;
  const wantsDraft =
    outcome.category === "to_respond" &&
    classification.needs_reply &&
    prefs.draftsEnabled &&
    !blockedDraft &&
    draftStyle !== "manual" &&
    (draftStyle === "everything" || classification.urgent);

  if (wantsDraft && (opts.free || (await consumeCredits(ctx.user.id, "draft")))) {
    try {
      const body = await generateReplyDraft({
        userName: ctx.user.name ?? ctx.account.email,
        voiceProfile: ctx.user.voiceProfile,
        // Voice profile wins over onboarding preset; only pass freeform extras when no profile.
        toneInstructions: ctx.user.voiceProfile ? "" : prefs.toneInstructions,
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
        ...(devSignal
          ? { devSignal: devSignal.kind, briefTag: devSignal.briefTag }
          : {}),
      },
    })
    .where(eq(messages.id, rowId));

  return { status: "processed", category: outcome.category, draftCreated: Boolean(draftId) };
}
