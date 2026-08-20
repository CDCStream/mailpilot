export const SUMMARY_UNAVAILABLE_LABEL = "Summary unavailable";

export function isSummaryUnavailable(summary: string | null | undefined): boolean {
  return summary == null || summary.trim() === "";
}
