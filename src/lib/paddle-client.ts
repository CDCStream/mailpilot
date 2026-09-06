"use client";

import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import type { PlanId } from "@/lib/plans";

let paddlePromise: Promise<Paddle | undefined> | null = null;

function isPaddleCustomerId(id: string | null | undefined): id is string {
  return !!id && id.startsWith("ctm_");
}

export async function bootPaddle(customerId?: string | null): Promise<Paddle | undefined> {
  const paddle = await getPaddleBrowser(customerId);
  if (paddle && isPaddleCustomerId(customerId)) {
    paddle.Update({ pwCustomer: { id: customerId } });
  }
  return paddle;
}

function getPaddleBrowser(customerId?: string | null): Promise<Paddle | undefined> {
  const token =
    process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
      ? process.env.NEXT_PUBLIC_PADDLE_LIVE_CLIENT_TOKEN ||
        process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
      : process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  if (!token) return Promise.resolve(undefined);
  if (!paddlePromise) {
    const sandbox = process.env.NEXT_PUBLIC_PADDLE_ENV === "sandbox";
    paddlePromise = initializePaddle({
      token,
      ...(sandbox ? { environment: "sandbox" as const } : {}),
      ...(isPaddleCustomerId(customerId) ? { pwCustomer: { id: customerId } } : {}),
      eventCallback: (event) => {
        if (event.name === "checkout.error") {
          console.error("[paddle] checkout.error", event);
        }
      },
    });
  }
  return paddlePromise;
}

export type PaddleCheckoutBody = { plan: PlanId } | { packId: string };

export async function openPaddleCheckout(body: PaddleCheckoutBody): Promise<string | null> {
  const res = await fetch("/api/paddle/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    error?: string;
    priceId?: string;
    customer?: { id: string };
    customData?: Record<string, string>;
    successUrl?: string;
  };
  if (!res.ok || !data.priceId) {
    return data.error ?? "Checkout failed";
  }

  const paddle = await bootPaddle(data.customer?.id);
  if (!paddle) return "Paddle checkout isn't configured.";

  const path = data.successUrl
    ? new URL(data.successUrl, window.location.origin).pathname +
      new URL(data.successUrl, window.location.origin).search
    : "/dashboard/billing";
  const successUrl = `${window.location.origin}${path}`;

  paddle.Checkout.open({
    items: [{ priceId: data.priceId, quantity: 1 }],
    ...(data.customer ? { customer: data.customer } : {}),
    customData: data.customData,
    settings: {
      variant: "one-page",
      allowLogout: false,
      successUrl,
    },
  });
  return null;
}
