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
import { headerFlagsFromMeta, isLinkedInSender, isOwnAppSender } from "@/lib/bot-gate";
import { senderDomain } from "@/lib/pre-classify";
import { cachedSenderCategory, forgetSenderCategory, rememberSenderCategory } from "@/lib/sender-cache";
import { isUncacheableDomain } from "@/lib/sender-cache-logic";
import {
  applyTriageGate,
  finalizeTriageCategory,
  gateInputFromStored,
  isNoActionSummary,
  sanitizeSummary,
} from "@/lib/triage";
import { applyRules } from "@/lib/rules-engine";
import { resolveDraftStyle } from "@/lib/draft-style";
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
  if (!meta) {
    if (opts.overwrite) {
      const existing = await db.query.messages.findFirst({
        where: and(eq(messages.accountId, ctx.account.id), eq(messages.gmailMessageId, messageId)),
      });
      if (existing) return retriageStoredRow(ctx, existing);
    }
    return { status: "skipped", reason: "message gone" };
  }
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

  const pre = applyTriageGate({
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
  if (pre.skipIngest) {
    if (opts.overwrite) {
      await db
        .update(messages)
        .set({ category: "notification", summary: null })
        .where(eq(messages.id, rowId));
      return { status: "processed", category: "notification", draftCreated: false };
    }
    return { status: "skipped", reason: pre.reason };
  }

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

  classification.summary = sanitizeSummary(classification.summary);
  classification.category = finalizeTriageCategory({
    from: meta.from,
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
    pre,
    llmOrDefault: classification.category,
    cached,
    summary: classification.summary,
  });
  if (pre.neverToRespond) classification.needs_reply = false;
  else if (
    classification.category === "to_respond" &&
    classification.summary &&
    devSignal?.kind !== "action_no_draft" &&
    !devSignal?.skipDraft
  ) {
    classification.needs_reply = true;
  }

  const outcome = applyRules(ctx.rules, {
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
    category: classification.category,
  });

  if (devSignal?.forceArchive) outcome.forceArchive = true;
  if (devSignal?.skipDraft) outcome.skipDraft = true;
  if (devSignal?.category && !pre.skipLlmCategory && !cached && !pre.neverToRespond) {
    outcome.category = devSignal.category;
  }
  outcome.category = finalizeTriageCategory({
    from: meta.from,
    fromEmail: meta.fromEmail,
    subject: meta.subject,
    bodyExcerpt: meta.bodyExcerpt,
    pre,
    llmOrDefault: outcome.category,
    cached,
    summary: classification.summary,
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
  const draftStyle = resolveDraftStyle(prefs);
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
  if (isNoActionSummary(classification.summary)) draftReasons.push("no-action-summary");
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

  if (isLinkedInSender(meta.fromEmail, meta.from) && outcome.category === "security") {
    outcome.category = "notification";
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
        draftSkipReason: wantsDraft ? undefined : draftReasons.join(",") || undefined,
        ruleApplied: outcome.appliedRule,
        ...headerFlagsFromMeta({
          listUnsubscribe: meta.listUnsubscribe,
          listId: meta.listId,
          autoSubmitted: meta.autoSubmitted,
          precedence: meta.precedence,
        }),
        ...(devSignal
          ? { devSignal: devSignal.kind, briefTag: devSignal.briefTag }
          : {}),
      },
    })
    .where(eq(messages.id, rowId));

  await rememberSenderCategory(ctx.user.id, meta.fromEmail, outcome.category);

  return { status: "processed", category: outcome.category, draftCreated: Boolean(draftId) };
}

type StoredMessage = {
  id: string;
  gmailMessageId: string;
  threadId?: string;
  fromAddress: string | null;
  subject: string | null;
  snippet: string | null;
  category: Category | null;
  summary: string | null;
  draftId?: string | null;
  receivedAt?: Date | null;
  createdAt?: Date;
  actions?: {
    hasListUnsubscribe?: boolean;
    isAutoSubmitted?: boolean;
    isBulkPrecedence?: boolean;
    hasListId?: boolean;
    draftCreated?: boolean;
  } | null;
};

/**
 * Re-triage a row already in the database. Uses stored From/subject/snippet so
 * the bot gate still runs when Gmail is unreachable, and always re-summarizes.
 */
export async function retriageStoredRow(
  ctx: PipelineContext,
  row: StoredMessage,
): Promise<ProcessResult> {
  const prefs = ctx.user.preferences ?? DEFAULT_PREFERENCES;
  const stored = gateInputFromStored(row);
  const meta = await getMessageMeta(ctx.gmail, row.gmailMessageId, ctx.account.email);
  const from = meta?.from ?? stored.from;
  const fromEmail = meta?.fromEmail ?? stored.fromEmail;
  const subject = meta?.subject ?? stored.subject ?? "";
  const bodyExcerpt = meta?.bodyExcerpt || stored.bodyExcerpt || "";

  const storedFlags = stored.headers ?? {};
  const liveFlags = headerFlagsFromMeta({
    listUnsubscribe: meta?.listUnsubscribe,
    listId: meta?.listId,
    autoSubmitted: meta?.autoSubmitted,
    precedence: meta?.precedence,
  });
  const pre = applyTriageGate({
    from,
    fromEmail,
    subject,
    bodyExcerpt,
    headers: {
      ...storedFlags,
      ...liveFlags,
      listUnsubscribe: meta?.listUnsubscribe,
      listId: meta?.listId,
      autoSubmitted: meta?.autoSubmitted,
      precedence: meta?.precedence,
    },
  });

  if (pre.skipIngest || isOwnAppSender(fromEmail)) {
    await db
      .update(messages)
      .set({ category: "notification", summary: null })
      .where(eq(messages.id, row.id));
    return { status: "processed", category: "notification", draftCreated: false };
  }

  if (isUncacheableDomain(senderDomain(fromEmail))) {
    await forgetSenderCategory(ctx.user.id, fromEmail);
  }
  const cached = await cachedSenderCategory(ctx.user.id, fromEmail);

  const classification = await classifyEmail({
    from,
    to: meta?.to ?? "",
    subject,
    bodyExcerpt,
    summaryLanguage: prefs.summaryLanguage,
    messageId: row.gmailMessageId,
  });
  classification.summary = sanitizeSummary(classification.summary);
  classification.category = finalizeTriageCategory({
    from,
    fromEmail,
    subject,
    bodyExcerpt,
    pre,
    llmOrDefault: classification.category,
    cached,
    summary: classification.summary,
  });
  if (pre.neverToRespond) classification.needs_reply = false;
  else if (classification.category === "to_respond" && classification.summary) {
    classification.needs_reply = true;
  }

  const outcome = applyRules(ctx.rules, {
    fromEmail,
    subject,
    bodyExcerpt,
    category: classification.category,
  });
  outcome.category = finalizeTriageCategory({
    from,
    fromEmail,
    subject,
    bodyExcerpt,
    pre,
    llmOrDefault: outcome.category,
    cached,
    summary: classification.summary,
  });
  if (isLinkedInSender(fromEmail, from) && outcome.category === "security") {
    outcome.category = "notification";
  }

  if (meta) {
    const labelMap = ctx.account.labelMap ?? {};
    const addLabelIds: string[] = [];
    const removeLabelIds: string[] = [];
    if (row.category && row.category !== outcome.category && labelMap[row.category]) {
      removeLabelIds.push(labelMap[row.category]);
    }
    if (labelMap[outcome.category]) addLabelIds.push(labelMap[outcome.category]);
    if (addLabelIds.length || removeLabelIds.length) {
      try {
        await applyLabels(ctx.gmail, meta.id, addLabelIds, removeLabelIds);
      } catch (err) {
        console.error("retriage label update failed", { messageId: meta.id, err });
      }
    }
  }

  let draftId = row.draftId ?? null;
  const arrived = row.receivedAt ?? row.createdAt ?? null;
  const recentEnough =
    arrived != null && Date.now() - arrived.getTime() <= 7 * 24 * 60 * 60 * 1000;
  const draftStyle = resolveDraftStyle(prefs);
  const blockedDraft = shouldBlockDraft({
    fromEmail,
    from,
    category: outcome.category,
    listUnsubscribe: meta?.listUnsubscribe,
  });
  const canBackfillDraft =
    !draftId &&
    recentEnough &&
    outcome.category === "to_respond" &&
    Boolean(classification.summary) &&
    !isNoActionSummary(classification.summary) &&
    classification.needs_reply &&
    prefs.draftsEnabled !== false &&
    draftStyle !== "manual" &&
    !(draftStyle === "important_only" && !classification.urgent) &&
    !blockedDraft &&
    !outcome.skipDraft;
  if (canBackfillDraft && meta) {
    try {
      if (await consumeCredits(ctx.user.id, "draft")) {
        const body = await generateReplyDraft({
          userName: ctx.user.name ?? ctx.account.email,
          voiceProfile: ctx.user.voiceProfile,
          toneInstructions: ctx.user.voiceProfile ? "" : prefs.toneInstructions,
          from,
          subject,
          bodyExcerpt,
          summary: classification.summary ?? "",
        });
        if (body) {
          draftId = await createReplyDraft(ctx.gmail, {
            threadId: meta.threadId,
            to: from,
            subject,
            body,
            inReplyTo: meta.messageIdHeader || undefined,
            references: meta.references || undefined,
          });
        }
      }
    } catch (err) {
      console.error("retriage draft failed", { id: row.id, err });
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
        archived: false,
        draftCreated: Boolean(draftId),
        retriaged: true,
        hasListUnsubscribe: row.actions?.hasListUnsubscribe ?? liveFlags.hasListUnsubscribe,
        isAutoSubmitted: row.actions?.isAutoSubmitted ?? liveFlags.isAutoSubmitted,
        isBulkPrecedence: row.actions?.isBulkPrecedence ?? liveFlags.isBulkPrecedence,
        hasListId: row.actions?.hasListId ?? liveFlags.hasListId,
      },
    })
    .where(eq(messages.id, row.id));

  await rememberSenderCategory(ctx.user.id, fromEmail, outcome.category);
  return { status: "processed", category: outcome.category, draftCreated: Boolean(draftId) };
}
