import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { eq } from "drizzle-orm";
import { db, creditTopups, subscriptions } from "@/lib/db";
import { getStripe } from "@/lib/billing";
import { planFromPriceId, type PlanId } from "@/lib/plans";
import { grantBonusCredits } from "@/lib/usage";

async function upsertFromSubscription(sub: Stripe.Subscription) {
  const userId = sub.metadata?.userId;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  const planFromMeta = sub.metadata?.plan;
  const plan: PlanId | null =
    planFromMeta === "wingman" || planFromMeta === "pilot"
      ? planFromMeta
      : planFromPriceId(priceId);

  const periodEnd =
    sub.items?.data?.[0]?.current_period_end ??
    (sub as unknown as { current_period_end?: number }).current_period_end;

  const values = {
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    status: sub.status,
    plan,
    priceId,
    currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    updatedAt: new Date(),
  };

  if (userId) {
    await db
      .insert(subscriptions)
      .values({ userId, ...values })
      .onConflictDoUpdate({ target: subscriptions.userId, set: values });
  } else {
    await db
      .update(subscriptions)
      .set(values)
      .where(eq(subscriptions.stripeCustomerId, customerId));
  }
}

async function handleTopupSession(session: Stripe.Checkout.Session) {
  if (session.metadata?.type !== "credit_topup") return;
  if (session.payment_status !== "paid") return;

  const userId = session.metadata.userId;
  const packId = session.metadata.packId ?? "unknown";
  const credits = Number(session.metadata.credits ?? 0);
  if (!userId || !Number.isFinite(credits) || credits <= 0) return;

  const inserted = await db
    .insert(creditTopups)
    .values({
      userId,
      stripeSessionId: session.id,
      packId,
      credits,
      amountCents: session.amount_total ?? 0,
    })
    .onConflictDoNothing()
    .returning({ id: creditTopups.id });

  if (inserted.length === 0) return; // already processed
  await grantBonusCredits(userId, credits);
}

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const body = await req.text();
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
      await upsertFromSubscription(event.data.object);
      break;
    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
      await db
        .update(subscriptions)
        .set({ status: "canceled", updatedAt: new Date() })
        .where(eq(subscriptions.stripeCustomerId, customerId));
      break;
    }
    case "checkout.session.completed":
      await handleTopupSession(event.data.object);
      break;
  }

  return NextResponse.json({ received: true });
}
