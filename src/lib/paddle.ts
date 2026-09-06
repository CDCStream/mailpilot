import { Environment, LogLevel, Paddle, type PaddleOptions } from "@paddle/paddle-node-sdk";
import { eq } from "drizzle-orm";
import { db, subscriptions, users } from "@/lib/db";
import type { PlanId } from "@/lib/plans";
import { PADDLE_SANDBOX_PLAN_PRICES, PADDLE_SANDBOX_TOPUP_PRICES } from "@/lib/paddle-catalog";

export function paddleEnvironment(): Environment {
  return process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
    ? Environment.production
    : Environment.sandbox;
}

export function getPaddleInstance(): Paddle {
  const key = process.env.PADDLE_API_KEY;
  if (!key) throw new Error("PADDLE_API_KEY is not set");
  const options: PaddleOptions = {
    environment: paddleEnvironment(),
    logLevel: LogLevel.error,
  };
  return new Paddle(key, options);
}

export function paddlePriceIdForPlan(plan: PlanId): string | undefined {
  if (plan === "pilot") {
    return process.env.PADDLE_PRICE_ID_PILOT || PADDLE_SANDBOX_PLAN_PRICES.pilot;
  }
  return process.env.PADDLE_PRICE_ID_WINGMAN || PADDLE_SANDBOX_PLAN_PRICES.wingman;
}

export function paddlePriceIdForTopup(packId: string): string | undefined {
  const fromEnv = process.env[`PADDLE_PRICE_ID_TOPUP_${packId}`];
  return fromEnv || PADDLE_SANDBOX_TOPUP_PRICES[packId];
}

export function planFromPaddlePriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === paddlePriceIdForPlan("pilot")) return "pilot";
  if (priceId === paddlePriceIdForPlan("wingman")) return "wingman";
  return null;
}

export function isPaddleCustomerId(id: string | null | undefined): boolean {
  return !!id && id.startsWith("ctm_");
}

export function isPaddleSubscriptionId(id: string | null | undefined): boolean {
  return !!id && id.startsWith("sub_");
}

/** Create or reuse a Paddle customer. Stripe `cus_` leftovers are replaced with `ctm_`. */
export async function ensurePaddleCustomer(userId: string): Promise<string> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error("User not found");

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  if (sub && isPaddleCustomerId(sub.stripeCustomerId)) {
    return sub.stripeCustomerId;
  }

  const paddle = getPaddleInstance();
  let customerId: string | undefined;

  const existing = paddle.customers.list({ email: [user.email], perPage: 5 });
  for await (const customer of existing) {
    customerId = customer.id;
    break;
  }

  if (!customerId) {
    const created = await paddle.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      customData: { userId },
    });
    customerId = created.id;
  }

  await db
    .insert(subscriptions)
    .values({
      userId,
      stripeCustomerId: customerId,
      status: sub?.status ?? "none",
    })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: { stripeCustomerId: customerId, updatedAt: new Date() },
    });

  return customerId;
}
