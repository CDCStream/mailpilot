/** Promotional countdowns that must never appear as obligation deadlines. */
const PROMO_DEADLINE_RE =
  /webinar|workshop|survey|sale ends|free access|bogo|ticket code|register or attend|flash sale|limited[- ]time|coupon|kupon|on sale|lowest prices/i;

/**
 * A date is a deadline only when the user faces a consequence:
 * money moves, access is lost, a service degrades, or a person is waiting.
 */
export function isPromotionalDeadline(line: string): boolean {
  return PROMO_DEADLINE_RE.test(line);
}

export function filterObligationDeadlines(lines: string[]): string[] {
  return lines.filter((line) => !isPromotionalDeadline(line));
}
