import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, subscriptions, users } from "@/lib/db";
import { billingEnabled, getStripe, hasActiveAccess } from "@/lib/billing";
import { getTopupPack } from "@/lib/plans";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Top-ups require an active plan (trialing or paid).
  if (billingEnabled() && !(await hasActiveAccess(userId))) {
    return NextResponse.json(
      { error: "Start a Pilot or Wingman plan before buying top-up credits." },
      { status: 403 },
    );
  }

  let packId = "";
  try {
    const body = (await req.json()) as { packId?: string };
    packId = String(body.packId ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const pack = getTopupPack(packId);
  if (!pack) return NextResponse.json({ error: "Unknown pack" }, { status: 400 });

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const stripe = getStripe();
  const sub = await db.query.subscriptions.findFirst({
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
    await db
      .insert(subscriptions)
      .values({ userId, stripeCustomerId: customerId, status: "none" })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: { stripeCustomerId: customerId },
      });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const checkout = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pack.priceCents,
          product_data: {
            name: `${pack.credits.toLocaleString("en-US")} Inbox Wingman AI credits`,
            description: "One-time top-up · credits never expire",
          },
        },
      },
    ],
    metadata: {
      userId,
      type: "credit_topup",
      packId: pack.id,
      credits: String(pack.credits),
    },
    payment_intent_data: {
      metadata: {
        userId,
        type: "credit_topup",
        packId: pack.id,
        credits: String(pack.credits),
      },
    },
    success_url: `${appUrl}/dashboard/billing?topup=success&credits=${pack.credits}`,
    cancel_url: `${appUrl}/dashboard/billing?topup=canceled`,
  });

  return NextResponse.json({ url: checkout.url });
}
