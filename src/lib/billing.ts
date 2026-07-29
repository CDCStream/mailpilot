import Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, subscriptions } from "@/lib/db";
import type { PlanId } from "@/lib/plans";

let stripeSingleton: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder");
  }
  return stripeSingleton;
}

export function billingEnabled(): boolean {
  return process.env.BILLING_ENABLED !== "false";
}

export type BillingStatus = "active" | "trialing" | "past_due" | "canceled" | "none";

export async function getBillingStatus(userId: string): Promise<BillingStatus> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  return (sub?.status as BillingStatus) ?? "none";
}

export async function getUserPlan(userId: string): Promise<PlanId | null> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  if (!sub?.plan) return null;
  return sub.plan === "wingman" ? "wingman" : "pilot";
}

/** Whether background processing (sync, drafts, brief) should run for this user. */
export async function hasActiveAccess(userId: string): Promise<boolean> {
  if (!billingEnabled()) return true;
  const status = await getBillingStatus(userId);
  return status === "active" || status === "trialing";
}
