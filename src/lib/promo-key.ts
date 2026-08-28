/** Named API-key promos. First matching create grants once; later creates/updates do not. */
export const PROMO_API_KEYS: Record<string, number> = {
  fuatsezer_1000: 1000,
};

export function normalizePromoKeyName(name: string): string {
  return name.trim().toLowerCase();
}

export function promoCreditsForKeyName(name: string): number | null {
  const credits = PROMO_API_KEYS[normalizePromoKeyName(name)];
  return typeof credits === "number" && credits > 0 ? credits : null;
}

export function promoClaimId(userId: string, name: string): string {
  return `promo:${userId}:${normalizePromoKeyName(name)}`;
}
