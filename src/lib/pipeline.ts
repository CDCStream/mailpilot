import { and, eq } from "drizzle-orm";
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
import { evaluateBotGate, isOwnAppSender } from "@/lib/bot-gate";
import { clampCategory, preClassify, resolveTriageCategory, senderDomain } from "@/lib/pre-classify";
import { cachedSenderCategory, forgetSenderCategory, rememberSenderCategory } from "@/lib/sender-cache";
import { isUncacheableDomain } from "@/lib/sender-cache-logic";
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
  /** Re-classify an already-stored message (history re-triage). */
  overwrite?: boolean;
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
  if (isOwnAppSender(meta.fromEmail)) {
    if (opts.overwrite) {
      const existing = await db.query.messages.findFirst({
        where: and(eq(messages.accountId, ctx.account.id), eq(messages.gmailMessageId, meta.id)),
      });
      if (existing) {
        await db
          .update(messages)
          .set({ category: "notification", summary: null })
          .where(eq(messages.id, existing.id));
        return { status: "processed", category: "notification", draftCreated: false };
      }
    }
    return { status: "skipped", reason: "own-domain" };
  }

  // "Respect my categories": if the user (or their own filters) already applied a
  // personal label to this message, we still import + classify it so it shows up
  // in the app, but we never touch its Gmail labels or archive it.
  const wingmanLabelIds = new Set(Object.values(ctx.account.labelMap ?? {}));
  const hasUserLabel =
    (prefs.respectUserLabels ?? true) &&
    meta.labelIds.some((id) => id.startsWith("Label_") && !wingmanLabelIds.has(id));

  let rowId: string;
  let existingCategory: Category | null = null;
  if (opts.overwrite) {
    const existing = await db.query.messages.findFirst({
      where: and(eq(messages.accountId, ctx.account.id), eq(messages.gmailMessageId, meta.id)),
    });
    if (!existing) return { status: "skipped", reason: "not in history" };
    rowId = existing.id;
    existingCategory = existing.category;
  } else {
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
    rowId = inserted[0].id;
  }

  // Triage is free (cost 0); fair-use ceiling is the only hard stop for AI classify.
  if (!opts.free) {
    if (!(await underTriageFairUse(ctx.user.id))) {
      return { status: "skipped", reason: "monthly triage fair-use limit reached" };
    }
    await consumeCredits(ctx.user.id, "triage"); // no-op at cost 0; keeps metering hook
  }

  const gate = evaluateBotGate({
    from: meta.from,
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
    headers: {
      listUnsubscribe: meta.listUnsubscribe,
      listId: meta.listId,
      autoSubmitted: meta.autoSubmitted,
      precedence: meta.precedence,
    },
  });
  if (gate.skipIngest) return { status: "skipped", reason: gate.reason };

  const pre = preClassify({
    from: meta.from,
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
    headers: {
      listUnsubscribe: meta.listUnsubscribe,
      listId: meta.listId,
      autoSubmitted: meta.autoSubmitted,
      precedence: meta.precedence,
    },
  });

  if (isUncacheableDomain(senderDomain(meta.fromEmail))) {
    await forgetSenderCategory(ctx.user.id, meta.fromEmail);
  }

  const cached = await cachedSenderCategory(ctx.user.id, meta.fromEmail);

  const devSignal = detectDevNotification({
    from: meta.from,
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
  });

  // Silent bots (Dependabot etc.): archive + label without spending an LLM call.
  let classification = {
    category: (pre.category ?? cached ?? devSignal?.category ?? "fyi") as Category,
    needs_reply: false,
    urgent: false,
    summary: (devSignal?.summaryHint ?? null) as string | null,
  };

  if (devSignal?.kind !== "silent_archive") {
    classification = await classifyEmail({
      from: meta.from,
      to: meta.to,
      subject: meta.subject,
      bodyExcerpt: meta.bodyExcerpt,
      summaryLanguage: prefs.summaryLanguage,
      messageId: meta.id,
    });
    if (devSignal?.category && !pre.skipLlmCategory && !cached) {
      classification.category = devSignal.category;
    }
    if (devSignal?.kind === "human_reply" && !pre.neverToRespond && classification.summary) {
      classification.needs_reply = true;
      classification.category = "to_respond";
    }
    if (devSignal?.kind === "action_no_draft" && !pre.neverToRespond && classification.summary) {
      classification.needs_reply = false;
      classification.category = "to_respond";
    }
    if (devSignal?.kind === "incident" || devSignal?.kind === "noreply_no_draft") {
      classification.needs_reply = false;
    }
  }

  classification.category = resolveTriageCategory({
    from: meta.from,
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
    pre,
    llmOrDefault: classification.category,
    cached,
  });
  classification.category = clampCategory({
    category: classification.category,
    summary: classification.summary,
    gate: pre,
  });
  classification.category = resolveTriageCategory({
    from: meta.from,
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
    pre,
    llmOrDefault: classification.category,
    cached: null,
  });
  if (pre.neverToRespond) classification.needs_reply = false;

  const outcome = applyRules(ctx.rules, {
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
    category: classification.category,
  });

  if (devSignal?.forceArchive) outcome.forceArchive = true;
  if (devSignal?.skipDraft) outcome.skipDraft = true;
  outcome.category = resolveTriageCategory({
    from: meta.from,
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
    pre,
    llmOrDefault: outcome.category,
    cached,
  });
  if (devSignal?.category && !pre.skipLlmCategory && !cached && !pre.neverToRespond) {
    outcome.category = devSignal.category;
  }
  outcome.category = clampCategory({
    category: outcome.category,
    summary: classification.summary,
    gate: pre,
  });
  outcome.category = resolveTriageCategory({
    from: meta.from,
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
    pre,
    llmOrDefault: outcome.category,
    cached: null,
  });

  // --- Apply Gmail label operations (skipped when respecting a user label) ---
  const labelMap = ctx.account.labelMap ?? {};
  const addLabelIds: string[] = [];
  const removeLabelIds: string[] = [];

  if (!hasUserLabel) {
    if (
      existingCategory &&
      existingCategory !== outcome.category &&
      labelMap[existingCategory]
    ) {
      removeLabelIds.push(labelMap[existingCategory]);
    }
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
  const draftReasons: string[] = [];
  if (outcome.category !== "to_respond") draftReasons.push(`category=${outcome.category}`);
  if (!classification.needs_reply) draftReasons.push("needs_reply=false");
  if (!classification.summary) draftReasons.push("summary=null");
  if (!prefs.draftsEnabled) draftReasons.push("drafts_disabled");
  if (blockedDraft) draftReasons.push("blocked_gate");
  if (draftStyle === "manual") draftReasons.push("style=manual");
  if (draftStyle === "important_only" && !classification.urgent) {
    draftReasons.push("important_only_not_urgent");
  }
  const wantsDraft = draftReasons.length === 0 && !opts.overwrite;
  console.info("draft-gate", {
    messageId: meta.id,
    from: meta.fromEmail,
    allowed: wantsDraft,
    reason: wantsDraft ? "eligible" : draftReasons.join(","),
  });

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
        summary: classification.summary ?? "",
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

  await rememberSenderCategory(ctx.user.id, meta.fromEmail, outcome.category);

  return { status: "processed", category: outcome.category, draftCreated: Boolean(draftId) };
}
