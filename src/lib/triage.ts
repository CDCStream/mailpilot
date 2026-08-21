import type { Category } from "@/lib/db/schema";
import type { GateInput } from "@/lib/bot-gate";
import { parseEmailAddress } from "@/lib/gmail";
import {
  clampCategory,
  preClassify,
  resolveTriageCategory,
  type PreClassifyResult,
} from "@/lib/pre-classify";

/** Single gate used by ingest and re-triage. Do not fork this. */
export function applyTriageGate(input: GateInput): PreClassifyResult {
  try {
    return preClassify({
      from: input.from ?? "",
      fromEmail: input.fromEmail ?? "",
      subject: input.subject ?? "",
      bodyExcerpt: input.bodyExcerpt ?? "",
      headers: input.headers,
    });
  } catch (err) {
    console.error("applyTriageGate failed", err);
    return {
      skipIngest: false,
      neverToRespond: false,
      category: null,
      reason: "gate-error",
      skipLlmCategory: false,
    };
  }
}

export function isLegacyActionSummary(summary: string | null | undefined): boolean {
  return typeof summary === "string" && summary.startsWith("Action / signature needed:");
}

export function sanitizeSummary(summary: string | null | undefined): string | null {
  if (summary == null) return null;
  const trimmed = summary.trim();
  if (!trimmed || isLegacyActionSummary(trimmed)) return null;
  return trimmed;
}

/** Summarizer already decided nothing is needed — don't draft, don't keep in To Respond. */
export function isNoActionSummary(summary: string | null | undefined): boolean {
  if (!summary) return false;
  return /no action required|no action needed|no reply (needed|required|necessary)|acknowledgement\/thanks|acknowledgment\/thanks|reacted with .{1,24} (to the |on the )|thanks,? no (reply|action)/i.test(
    summary,
  );
}

export function gateInputFromStored(row: {
  fromAddress: string | null;
  subject: string | null;
  snippet: string | null;
  actions?: {
    hasListUnsubscribe?: boolean;
    isAutoSubmitted?: boolean;
    isBulkPrecedence?: boolean;
    hasListId?: boolean;
  } | null;
}): GateInput {
  const from = row.fromAddress ?? "";
  return {
    from,
    fromEmail: parseEmailAddress(from || ""),
    subject: row.subject ?? "",
    bodyExcerpt: row.snippet ?? "",
    headers: {
      hasListUnsubscribe: row.actions?.hasListUnsubscribe,
      isAutoSubmitted: row.actions?.isAutoSubmitted,
      isBulkPrecedence: row.actions?.isBulkPrecedence,
      hasListId: row.actions?.hasListId,
    },
  };
}

export function finalizeTriageCategory(opts: {
  from: string;
  fromEmail: string;
  subject: string;
  bodyExcerpt?: string;
  pre: PreClassifyResult;
  llmOrDefault: Category;
  cached: Category | null;
  summary: string | null;
}): Category {
  let category = resolveTriageCategory({
    from: opts.from,
    fromEmail: opts.fromEmail,
    subject: opts.subject,
    bodyExcerpt: opts.bodyExcerpt,
    pre: opts.pre,
    llmOrDefault: opts.llmOrDefault,
    cached: opts.cached,
  });
  category = clampCategory({
    category,
    summary: opts.summary,
    gate: opts.pre,
    from: opts.from,
    fromEmail: opts.fromEmail,
    subject: opts.subject,
    bodyExcerpt: opts.bodyExcerpt,
  });
  category = resolveTriageCategory({
    from: opts.from,
    fromEmail: opts.fromEmail,
    subject: opts.subject,
    bodyExcerpt: opts.bodyExcerpt,
    pre: opts.pre,
    llmOrDefault: category,
    cached: null,
  });
  if (category === "to_respond" && isNoActionSummary(opts.summary)) return "fyi";
  return category;
}
