import { NextRequest } from "next/server";
import { getPaddleInstance } from "@/lib/paddle";
import { processPaddleEvent } from "@/lib/paddle-webhook";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("paddle-signature") ?? "";
  const rawBody = await request.text();
  const secret = process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET ?? "";

  if (!signature || !rawBody) {
    return Response.json({ error: "Missing signature or body" }, { status: 400 });
  }

  try {
    const paddle = getPaddleInstance();
    const eventData = await paddle.webhooks.unmarshal(rawBody, secret, signature);
    if (eventData) {
      await processPaddleEvent(eventData);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Paddle webhook:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
