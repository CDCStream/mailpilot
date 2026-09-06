"use client";

import { initializePaddle, type Paddle } from "@paddle/paddle-js";
import type { PlanId } from "@/lib/plans";

let paddlePromise: Promise<Paddle | undefined> | null = null;

function getPaddleBrowser(): Promise<Paddle | undefined> {
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
  if (!token) return Promise.resolve(undefined);
  if (!paddlePromise) {
    paddlePromise = initializePaddle({
      token,
      environment: (process.env.NEXT_PUBLIC_PADDLE_ENV ?? "sandbox") as
        | "sandbox"
        | "production",
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

  const paddle = await getPaddleBrowser();
  if (!paddle) return "Paddle checkout isn't configured.";

  paddle.Checkout.open({
    items: [{ priceId: data.priceId, quantity: 1 }],
    ...(data.customer ? { customer: data.customer } : {}),
    customData: data.customData,
    settings: {
      variant: "one-page",
      allowLogout: false,
      successUrl: data.successUrl,
    },
  });
  return null;
}
