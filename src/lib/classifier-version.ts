/** Bump this whenever the classify prompt or pre-gate changes. */
export const CLASSIFIER_VERSION = "2026-08-21-r10";

export const RETRIAGE_SCOPES = ["7", "30", "90", "all"] as const;
export type RetriageScope = (typeof RETRIAGE_SCOPES)[number];

export function retriageSince(scope: RetriageScope, now = new Date()): Date | null {
  if (scope === "all") return null;
  const days = Number(scope);
  const safeDays = Number.isFinite(days) && days > 0 ? days : 7;
  return new Date(now.getTime() - safeDays * 24 * 60 * 60 * 1000);
}
