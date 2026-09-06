import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, subscriptions } from "@/lib/db";
import { getPaddleInstance, isPaddleCustomerId, isPaddleSubscriptionId } from "@/lib/paddle";

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  if (!sub || !isPaddleCustomerId(sub.stripeCustomerId)) {
    return NextResponse.json({ error: "No Paddle customer" }, { status: 404 });
  }

  const subscriptionId = sub.stripeSubscriptionId;
  const subscriptionIds = isPaddleSubscriptionId(subscriptionId) && subscriptionId
    ? [subscriptionId]
    : [];

  const portal = await getPaddleInstance().customerPortalSessions.create(
    sub.stripeCustomerId,
    subscriptionIds,
  );

  return NextResponse.json({ url: portal.urls.general.overview });
}
