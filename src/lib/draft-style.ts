import type { DraftStyle, UserPreferences } from "@/lib/db/schema";

export type ResolvedDraftStyle = "always" | "important_only" | "manual";

/**
 * Product default is always: every To Respond gets a draft. `important_only`
 * only applies after the user explicitly re-selects it (draftPolicyV2).
 */
export function resolveDraftStyle(prefs: UserPreferences | null | undefined): ResolvedDraftStyle {
  const raw = prefs?.draftStyle;
  if (raw === "manual" || prefs?.draftsEnabled === false) return "manual";
  if (raw === "important_only" && prefs?.draftPolicyV2) return "important_only";
  return "always";
}

export function parseDraftStyle(raw: string): DraftStyle {
  if (raw === "important_only" || raw === "manual" || raw === "always") return raw;
  if (raw === "everything") return "always";
  return "always";
}

/** One-shot: junk-filter rationale for important_only is obsolete; flip to always unless manual. */
export function migratedDraftPreferences(prefs: UserPreferences): UserPreferences {
  if (prefs.draftPolicyV2) {
    const style = prefs.draftStyle === "everything" ? "always" : (prefs.draftStyle ?? "always");
    return style === prefs.draftStyle ? prefs : { ...prefs, draftStyle: style };
  }
  return {
    ...prefs,
    draftStyle: prefs.draftStyle === "manual" ? "manual" : "always",
    draftsEnabled: prefs.draftStyle !== "manual",
    draftPolicyV2: true,
  };
}
