import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { db, creditUsage, emailAccounts, messages, subscriptions, users } from "@/lib/db";
import { billingEnabled } from "@/lib/billing";
import {
  CREDIT_COSTS,
  PLANS,
  TRIAGE_FAIR_USE_MONTHLY,
  TRIAL_CREDITS,
  type CreditAction,
  type PlanId,
} from "@/lib/plans";

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM UTC
}

export type CreditBalance = {
  period: string;
  /** Credits spent from this month's plan allowance */
  planUsed: number;
  planLimit: number;
  planRemaining: number;
  /** Purchased top-up wallet (never expires) */
  bonusCredits: number;
  remaining: number;
  plan: PlanId | "trial" | "early_access" | "none";
  planName: string;
};

export async function resolveCreditLimit(userId: string): Promise<{
  limit: number;
  plan: CreditBalance["plan"];
  planName: string;
}> {
  if (!billingEnabled()) {
    // Never surface env/internal names ("BILLING_ENABLED") to the UI.
    return {
      limit: PLANS.wingman.credits,
      plan: "early_access",
      planName: "Early access",
    };
  }

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  const status = sub?.status ?? "none";

  if (status === "trialing") {
    return { limit: TRIAL_CREDITS, plan: "trial", planName: "Free trial" };
  }

  if (status === "active" || status === "past_due") {
    const planId = (sub?.plan === "wingman" ? "wingman" : "pilot") as PlanId;
    const plan = PLANS[planId];
    return { limit: plan.credits, plan: planId, planName: plan.name };
  }

  return { limit: 20, plan: "none", planName: "No plan" };
}

/**
 * Invisible monthly cap on AI-classified messages. Triage costs 0 credits,
 * so this is the only abuse brake for free classification.
 */
export async function underTriageFairUse(userId: string): Promise<boolean> {
  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
    columns: { id: true },
  });
  if (accounts.length === 0) return true;
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [row] = await db
    .select({ n: count() })
    .from(messages)
    .where(
      and(
        inArray(
          messages.accountId,
          accounts.map((a) => a.id),
        ),
        gte(messages.createdAt, monthStart),
      ),
    );
  return (row?.n ?? 0) < TRIAGE_FAIR_USE_MONTHLY;
}

/**
 * Spend credits: plan allowance first, then top-up wallet.
 * Returns false when neither pool can cover the cost.
 * Cost-0 actions (triage) always succeed without touching balances.
 */
export async function consumeCredits(
  userId: string,
  action: CreditAction,
): Promise<boolean> {
  const cost = CREDIT_COSTS[action];
  if (cost <= 0) return true;

  const { limit: planLimit } = await resolveCreditLimit(userId);
  const period = currentPeriod();

  await db
    .insert(creditUsage)
    .values({ userId, period, creditsUsed: 0 })
    .onConflictDoNothing();

  const usage = await db.query.creditUsage.findFirst({
    where: and(eq(creditUsage.userId, userId), eq(creditUsage.period, period)),
  });
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!usage || !user) return false;

  const planUsed = usage.creditsUsed;
  const planLeft = Math.max(0, planLimit - planUsed);
  const wallet = user.bonusCredits;

  if (planLeft + wallet < cost) return false;

  const fromPlan = Math.min(planLeft, cost);
  const fromWallet = cost - fromPlan;

  if (fromPlan > 0) {
    await db
      .update(creditUsage)
      .set({ creditsUsed: sql`${creditUsage.creditsUsed} + ${fromPlan}` })
      .where(and(eq(creditUsage.userId, userId), eq(creditUsage.period, period)));
  }

  if (fromWallet > 0) {
    const updated = await db
      .update(users)
      .set({ bonusCredits: sql`${users.bonusCredits} - ${fromWallet}` })
      .where(and(eq(users.id, userId), sql`${users.bonusCredits} >= ${fromWallet}`))
      .returning({ bonusCredits: users.bonusCredits });
    if (updated.length === 0) return false;
  }

  return true;
}

export async function getCreditBalance(userId: string): Promise<CreditBalance> {
  const period = currentPeriod();
  const { limit: planLimit, plan, planName } = await resolveCreditLimit(userId);
  const [usage, user] = await Promise.all([
    db.query.creditUsage.findFirst({
      where: and(eq(creditUsage.userId, userId), eq(creditUsage.period, period)),
    }),
    db.query.users.findFirst({ where: eq(users.id, userId) }),
  ]);
  const planUsed = usage?.creditsUsed ?? 0;
  const bonusCredits = user?.bonusCredits ?? 0;
  const planRemaining = Math.max(0, planLimit - planUsed);
  return {
    period,
    planUsed,
    planLimit,
    planRemaining,
    bonusCredits,
    remaining: planRemaining + bonusCredits,
    plan,
    planName,
  };
}

/** Grant purchased top-up credits (idempotent callers should dedupe via Stripe event id). */
export async function grantBonusCredits(userId: string, amount: number): Promise<void> {
  if (amount <= 0) return;
  await db
    .update(users)
    .set({ bonusCredits: sql`${users.bonusCredits} + ${amount}` })
    .where(eq(users.id, userId));
}

/** @deprecated Use getCreditBalance */
export async function getUsage(userId: string) {
  const bal = await getCreditBalance(userId);
  return {
    classifications: bal.planUsed,
    drafts: 0,
    maxClassifications: bal.planLimit + bal.bonusCredits,
    maxDrafts: bal.planLimit + bal.bonusCredits,
    credits: bal,
  };
}

/** @deprecated Use consumeCredits */
export async function consumeBudget(
  userId: string,
  kind: "classifications" | "drafts",
): Promise<boolean> {
  return consumeCredits(userId, kind === "drafts" ? "draft" : "triage");
}
