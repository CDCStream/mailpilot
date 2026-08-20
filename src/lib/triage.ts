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
  return preClassify(input);
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

export function gateInputFromStored(row: {
  fromAddress: string | null;
  subject: string | null;
  snippet: string | null;
}): GateInput {
  const from = row.fromAddress ?? "";
  return {
    from,
    fromEmail: parseEmailAddress(from),
    subject: row.subject ?? "",
    bodyExcerpt: row.snippet ?? "",
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
  });
  return resolveTriageCategory({
    from: opts.from,
    fromEmail: opts.fromEmail,
    subject: opts.subject,
    bodyExcerpt: opts.bodyExcerpt,
    pre: opts.pre,
    llmOrDefault: category,
    cached: null,
  });
}
