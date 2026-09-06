"use client";

import { useState } from "react";
import { openPaddleCheckout } from "@/lib/paddle-client";
import { PLANS, type PlanId } from "@/lib/plans";

export function BillingButtons({
  hasSubscription,
  showPlanPicker,
}: {
  hasSubscription: boolean;
  showPlanPicker?: boolean;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(plan: PlanId) {
    setLoading(plan);
    setError(null);
    try {
      const message = await openPaddleCheckout({ plan });
      if (message) setError(message);
    } catch {
      setError("Something went wrong.");
    }
    setLoading(null);
  }

  async function openPortal() {
    setLoading("portal");
    setError(null);
    try {
      const res = await fetch("/api/paddle/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Something went wrong.");
    } catch {
      setError("Something went wrong.");
    }
    setLoading(null);
  }

  if (hasSubscription) {
    return (
      <div className="mt-6">
        <button
          onClick={openPortal}
          disabled={!!loading}
          className="rounded-full border border-zinc-300 px-6 py-2.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
        >
          {loading ? "Opening…" : "Manage subscription"}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  if (!showPlanPicker) {
    return (
      <div className="mt-6">
        <button
          onClick={() => subscribe("pilot")}
          disabled={!!loading}
          className="rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {loading ? "Opening checkout…" : "Subscribe to Pilot"}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <button
        onClick={() => subscribe("pilot")}
        disabled={!!loading}
        className="w-full rounded-full border border-zinc-300 px-6 py-2.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
      >
        {loading === "pilot"
          ? "Opening checkout…"
          : `Subscribe to Pilot — $${PLANS.pilot.priceMonthly}/mo + tax`}
      </button>
      <button
        onClick={() => subscribe("wingman")}
        disabled={!!loading}
        className="w-full rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {loading === "wingman"
          ? "Opening checkout…"
          : `Subscribe to Wingman — $${PLANS.wingman.priceMonthly}/mo + tax`}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
