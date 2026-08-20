/** Bump this whenever the classify prompt or pre-gate changes. */
export const CLASSIFIER_VERSION = "2026-08-20-r3";

export const RETRIAGE_SCOPES = ["7", "30", "90", "all"] as const;
export type RetriageScope = (typeof RETRIAGE_SCOPES)[number];

export function retriageSince(scope: RetriageScope, now = new Date()): Date | null {
  if (scope === "all") return null;
  const days = Number(scope);
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}
