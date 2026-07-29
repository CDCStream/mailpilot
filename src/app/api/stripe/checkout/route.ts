import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, subscriptions, users } from "@/lib/db";
import { getStripe } from "@/lib/billing";
import { isPlanId, PLANS, stripePriceIdForPlan, type PlanId } from "@/lib/plans";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let plan: PlanId = "pilot";
  try {
    const body = (await req.json()) as { plan?: string };
    if (isPlanId(body.plan)) plan = body.plan;
  } catch {
    // empty body → default Pilot
  }

  const planDef = PLANS[plan];
  const priceId = stripePriceIdForPlan(plan);

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const stripe = getStripe();

  let sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  let customerId = sub?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name ?? undefined,
      metadata: { userId },
    });
    customerId = customer.id;
    [sub] = await db
      .insert(subscriptions)
      .values({ userId, stripeCustomerId: customerId, status: "none", plan })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: { stripeCustomerId: customerId },
      })
      .returning();
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Prefer Dashboard Price IDs when set; otherwise charge the formula price from PLANS.
  const lineItems = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          quantity: 1,
          price_data: {
            currency: "usd" as const,
            unit_amount: planDef.priceMonthly * 100,
            recurring: { interval: "month" as const },
            product_data: {
              name: `Inbox Wingman ${planDef.name}`,
              description: `${planDef.credits.toLocaleString("en-US")} AI credits / month`,
            },
          },
        },
      ];

  const checkout = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: lineItems,
    subscription_data: {
      trial_period_days: 7,
      metadata: { userId, plan },
    },
    metadata: { userId, plan },
    allow_promotion_codes: true,
    success_url: `${appUrl}/dashboard/billing?status=success`,
    cancel_url: `${appUrl}/dashboard/billing?status=canceled`,
  });

  return NextResponse.json({ url: checkout.url });
}
