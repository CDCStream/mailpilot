import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { billingEnabled, hasActiveAccess } from "@/lib/billing";
import {
  ensurePaddleCustomer,
  paddlePriceIdForPlan,
  paddlePriceIdForTopup,
} from "@/lib/paddle";
import { getTopupPack, isPlanId, type PlanId } from "@/lib/plans";

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let plan: PlanId = "pilot";
  let packId = "";
  try {
    const body = (await req.json()) as { plan?: string; packId?: string };
    if (isPlanId(body.plan)) plan = body.plan;
    packId = String(body.packId ?? "");
  } catch {
    // empty body → Pilot subscribe
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  try {
    const customerId = await ensurePaddleCustomer(userId);

    if (packId) {
      if (billingEnabled() && !(await hasActiveAccess(userId))) {
        return NextResponse.json(
          { error: "Start a Pilot or Wingman plan before buying top-up credits." },
          { status: 403 },
        );
      }
      const pack = getTopupPack(packId);
      if (!pack) return NextResponse.json({ error: "Unknown pack" }, { status: 400 });
      const priceId = paddlePriceIdForTopup(pack.id);
      if (!priceId) {
        return NextResponse.json({ error: "Top-up price is not configured." }, { status: 500 });
      }
      return NextResponse.json({
        priceId,
        customer: { id: customerId },
        customData: {
          userId,
          type: "credit_topup",
          packId: pack.id,
          credits: String(pack.credits),
        },
        successUrl: `${appUrl}/dashboard/billing?topup=success&credits=${pack.credits}`,
      });
    }

    const priceId = paddlePriceIdForPlan(plan);
    if (!priceId) {
      return NextResponse.json({ error: "Plan price is not configured." }, { status: 500 });
    }

    return NextResponse.json({
      priceId,
      customer: { id: customerId },
      customData: {
        userId,
        type: "plan",
        plan,
      },
      successUrl: `${appUrl}/dashboard/billing?status=success`,
    });
  } catch (error) {
    console.error("Paddle checkout:", error);
    return NextResponse.json({ error: "Checkout is unavailable." }, { status: 500 });
  }
}
