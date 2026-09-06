import { NextRequest } from "next/server";
import { getPaddleInstance } from "@/lib/paddle";
import { ipInCidrList, paddleWebhookCidrs, requestClientIp } from "@/lib/paddle-ips";
import { processPaddleEvent } from "@/lib/paddle-webhook";

function webhookSecret(): string {
  if (process.env.NEXT_PUBLIC_PADDLE_ENV === "production") {
    return (
      process.env.PADDLE_LIVE_NOTIFICATION_WEBHOOK_SECRET ||
      process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET ||
      ""
    );
  }
  return process.env.PADDLE_NOTIFICATION_WEBHOOK_SECRET ?? "";
}

export async function POST(request: NextRequest) {
  const signature = request.headers.get("paddle-signature") ?? "";
  const rawBody = await request.text();
  const secret = webhookSecret();

  if (!signature || !rawBody) {
    return Response.json({ error: "Missing signature or body" }, { status: 400 });
  }

  try {
    const paddle = getPaddleInstance();
    const eventData = await paddle.webhooks.unmarshal(rawBody, secret, signature);
    const cidrs = await paddleWebhookCidrs();
    const ip = requestClientIp(request);
    if (cidrs.length > 0 && ip && !ipInCidrList(ip, cidrs)) {
      console.warn("Paddle webhook IP not on allowlist; accepted after signature check", {
        ip,
      });
    }
    if (eventData) {
      await processPaddleEvent(eventData);
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("Paddle webhook:", error);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
