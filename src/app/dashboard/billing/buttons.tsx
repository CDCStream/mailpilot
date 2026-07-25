"use client";

import { useState } from "react";

export function BillingButtons({ hasSubscription }: { hasSubscription: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(path: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Something went wrong.");
    } catch {
      setError("Something went wrong.");
    }
    setLoading(false);
  }

  return (
    <div className="mt-6">
      {hasSubscription ? (
        <button
          onClick={() => go("/api/stripe/portal")}
          disabled={loading}
          className="rounded-full border border-zinc-300 px-6 py-2.5 text-sm font-medium hover:bg-zinc-50 disabled:opacity-50"
        >
          {loading ? "Opening…" : "Manage subscription"}
        </button>
      ) : (
        <button
          onClick={() => go("/api/stripe/checkout")}
          disabled={loading}
          className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {loading ? "Redirecting…" : "Start 7-day free trial"}
        </button>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
