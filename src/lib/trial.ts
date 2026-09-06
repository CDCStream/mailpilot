import { eq } from "drizzle-orm";
import { db, subscriptions } from "@/lib/db";
import { isPaddleCustomerId } from "@/lib/paddle";
import { TRIAL_DAYS } from "@/lib/plans";

export function trialCustomerPlaceholder(userId: string): string {
  return `trial:${userId}`;
}

export function isTrialExpired(periodEnd: Date | null | undefined): boolean {
  return !!periodEnd && periodEnd.getTime() <= Date.now();
}

function trialEndsAt(): Date {
  const ends = new Date();
  ends.setUTCDate(ends.getUTCDate() + TRIAL_DAYS);
  return ends;
}

/**
 * Starts a cardless trial once. Paid / already-trialing rows are left alone.
 * `stripe_customer_id` stays a placeholder until Paddle checkout writes `ctm_`.
 */
export async function ensureCardlessTrial(userId: string): Promise<void> {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });

  if (!sub) {
    await db.insert(subscriptions).values({
      userId,
      stripeCustomerId: trialCustomerPlaceholder(userId),
      status: "trialing",
      currentPeriodEnd: trialEndsAt(),
    });
    return;
  }

  if (
    sub.status === "active" ||
    sub.status === "past_due" ||
    sub.status === "trialing" ||
    sub.status === "canceled" ||
    sub.status === "paused" ||
    isPaddleCustomerId(sub.stripeCustomerId)
  ) {
    return;
  }

  await db
    .update(subscriptions)
    .set({
      status: "trialing",
      currentPeriodEnd: sub.currentPeriodEnd ?? trialEndsAt(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.userId, userId));
}
