"use client";

import { useState } from "react";
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

  async function go(path: string, body?: { plan: PlanId }) {
    setLoading(body?.plan ?? "portal");
    setError(null);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json();
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
          onClick={() => go("/api/stripe/portal")}
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
          onClick={() => go("/api/stripe/checkout", { plan: "pilot" })}
          disabled={!!loading}
          className="rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {loading ? "Redirecting…" : "Start 7-day free trial"}
        </button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-3">
      <button
        onClick={() => go("/api/stripe/checkout", { plan: "pilot" })}
        disabled={!!loading}
        className="w-full rounded-full border border-zinc-300 px-6 py-2.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
      >
        {loading === "pilot" ? "Redirecting…" : `Start Pilot trial — $${PLANS.pilot.priceMonthly}/mo`}
      </button>
      <button
        onClick={() => go("/api/stripe/checkout", { plan: "wingman" })}
        disabled={!!loading}
        className="w-full rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
      >
        {loading === "wingman" ? "Redirecting…" : `Start Wingman trial — $${PLANS.wingman.priceMonthly}/mo`}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
