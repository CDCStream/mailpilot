"use client";

import { useEffect } from "react";
import { bootPaddle } from "@/lib/paddle-client";

/** Initializes Paddle.js with Retain `pwCustomer` for the signed-in Paddle customer. */
export function PaddleBoot({ customerId }: { customerId?: string | null }) {
  useEffect(() => {
    void bootPaddle(customerId);
  }, [customerId]);
  return null;
}
