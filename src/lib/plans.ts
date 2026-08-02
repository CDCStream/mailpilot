export type PlanId = "pilot" | "wingman";

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Early-bird price actually charged today. */
  priceMonthly: number;
  /** Full list price (100% margin) shown struck through. */
  listMonthly: number;
  /** Rounded % saved vs. the list price. */
  savePct: number;
  credits: number;
  maxAccounts: number;
  features: string[];
  popular?: boolean;
};

/**
 * Credit costs for AI actions.
 * Triage is free (cost baked into plan price); credits meter drafts / brief / ask.
 */
export const CREDIT_COSTS = {
  triage: 0,
  draft: 3,
  brief: 2,
  ask: 2,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

/**
 * Invisible monthly ceiling on AI-classified messages per user.
 * Not shown in marketing — stops shared-inbox abuse when triage is free.
 */
export const TRIAGE_FAIR_USE_MONTHLY = 3000;

/**
 * Trial abuse guard in credits. At 3 credits/draft this is ~25 drafts.
 * Do not surface a countdown in the UI (users hoard instead of trying).
 */
export const TRIAL_CREDITS = 75;

/** Approximate draft capacity from a credit allowance (for marketing copy). */
export function approxDraftsFromCredits(credits: number): number {
  return Math.floor(credits / CREDIT_COSTS.draft);
}

/**
 * Fully-loaded cost per credit (LLM + infra amortized).
 * Includes the free onboarding import — up to ~310 emails triaged + voice
 * profile training, never charged to the user's credits — for EVERY Gmail
 * account they connect (up to 5 on Pilot, 10 on Wingman), amortized over an
 * assumed customer lifetime — hence 0.024 instead of the raw 0.022.
 * List price = cost × 2.0 (maliyet + %100 kâr) — pricing'de üstü çizili gösterilir.
 * Early bird = cost × 1.48 (maliyet + %48 kâr) — ilk 100 müşteriye tahsil edilen fiyat.
 */
export const CREDIT_UNIT_COST_USD = 0.024;
export const PROFIT_MARGIN = 1.0;
export const SELL_MULTIPLIER = 1 + PROFIT_MARGIN; // 2.0 — list price
export const EARLY_BIRD_MARGIN = 0.48;
export const EARLY_BIRD_MULTIPLIER = 1 + EARLY_BIRD_MARGIN; // 1.48 — charged today
export const EARLY_BIRD_SEATS = 100;

/** Sell price in USD cents (whole dollars) from a credit amount. Defaults to the early-bird price. */
export function sellPriceCents(credits: number, multiplier = EARLY_BIRD_MULTIPLIER): number {
  return Math.max(100, Math.round(credits * CREDIT_UNIT_COST_USD * multiplier) * 100);
}

/** Whole-dollar monthly price for a credit allowance. Defaults to the early-bird price. */
export function monthlyPriceUsd(credits: number, multiplier = EARLY_BIRD_MULTIPLIER): number {
  return Math.max(1, Math.round(credits * CREDIT_UNIT_COST_USD * multiplier));
}

function buildPlan(
  partial: Omit<Plan, "priceMonthly" | "listMonthly" | "savePct" | "features"> & {
    featureExtras: string[];
  },
): Plan {
  const priceMonthly = monthlyPriceUsd(partial.credits);
  const listMonthly = monthlyPriceUsd(partial.credits, SELL_MULTIPLIER);
  const drafts = approxDraftsFromCredits(partial.credits);
  return {
    id: partial.id,
    name: partial.name,
    tagline: partial.tagline,
    credits: partial.credits,
    maxAccounts: partial.maxAccounts,
    popular: partial.popular,
    priceMonthly,
    listMonthly,
    savePct: Math.round((1 - priceMonthly / listMonthly) * 100),
    features: [
      `~${drafts.toLocaleString("en-US")} AI drafts / month`,
      "Unlimited triage & labels",
      ...partial.featureExtras,
    ],
  };
}

export const PLANS: Record<PlanId, Plan> = {
  pilot: buildPlan({
    id: "pilot",
    name: "Pilot",
    tagline: "For technical founders",
    credits: 400,
    maxAccounts: 5,
    popular: true,
    featureExtras: [
      "Dev notification triage (CI, Sentry, bots)",
      "Voice-matched reply drafts",
      "Daily brief with incidents & deadlines",
      "Plain-English rules",
      "Up to 5 Gmail accounts",
    ],
  }),
  wingman: buildPlan({
    id: "wingman",
    name: "Wingman",
    tagline: "For heavier inboxes",
    credits: 1200,
    maxAccounts: 10,
    featureExtras: [
      "Everything in Pilot",
      "Up to 10 Gmail accounts",
      "Priority processing",
      "Higher draft capacity",
    ],
  }),
};

export function planFromPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_ID_PILOT) return "pilot";
  if (priceId === process.env.STRIPE_PRICE_ID_WINGMAN) return "wingman";
  if (priceId === process.env.STRIPE_PRICE_ID) return "pilot";
  return null;
}

export function stripePriceIdForPlan(plan: PlanId): string | undefined {
  if (plan === "pilot") {
    return process.env.STRIPE_PRICE_ID_PILOT || process.env.STRIPE_PRICE_ID || undefined;
  }
  return process.env.STRIPE_PRICE_ID_WINGMAN || undefined;
}

export function isPlanId(value: unknown): value is PlanId {
  return value === "pilot" || value === "wingman";
}

export function maxAccountsFor(
  plan: PlanId | "trial" | "dev" | "none",
): number {
  if (plan === "wingman" || plan === "dev") return PLANS.wingman.maxAccounts;
  if (plan === "pilot" || plan === "trial") return PLANS.pilot.maxAccounts;
  return 1;
}

export type TopupPack = {
  id: string;
  credits: number;
  priceCents: number;
  listCents: number;
  bestValue?: boolean;
};

const TOPUP_CREDIT_TIERS = [100, 250, 500, 750, 1000, 1500, 2000, 3000] as const;

/** One-time packs — early-bird price charged, real list price (100% margin) struck through. */
export const TOPUP_PACKS: TopupPack[] = TOPUP_CREDIT_TIERS.map((credits) => ({
  id: String(credits),
  credits,
  priceCents: sellPriceCents(credits),
  listCents: sellPriceCents(credits, SELL_MULTIPLIER),
  bestValue: credits === 500,
}));

export function getTopupPack(id: string): TopupPack | undefined {
  return TOPUP_PACKS.find((p) => p.id === id);
}

export function formatCreditsShort(n: number): string {
  if (n >= 1000 && n % 1000 === 0) return `${n / 1000}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}
