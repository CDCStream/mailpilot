"use client";

import { useMemo, useState } from "react";
import {
  CREDIT_COSTS,
  TOPUP_PACKS,
  formatCreditsShort,
  type TopupPack,
} from "@/lib/plans";

function money(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

type Props = {
  signedIn?: boolean;
  /** Active subscription (trialing/active) required to buy top-ups. */
  hasActivePlan?: boolean;
};

export function CreditTopupScroller({
  signedIn = false,
  hasActivePlan = false,
}: Props) {
  const bestIdx = Math.max(
    0,
    TOPUP_PACKS.findIndex((p) => p.bestValue),
  );
  const [index, setIndex] = useState(bestIdx);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pack: TopupPack = TOPUP_PACKS[index] ?? TOPUP_PACKS[0];
  const discount = Math.round((1 - pack.priceCents / pack.listCents) * 100);
  const rate = Math.max(1, Math.round(pack.credits / (pack.priceCents / 100)));

  const draftsApprox = useMemo(
    () => Math.floor(pack.credits / CREDIT_COSTS.draft),
    [pack.credits],
  );
  const triageApprox = useMemo(
    () => Math.floor(pack.credits / CREDIT_COSTS.triage),
    [pack.credits],
  );

  const canPurchase = signedIn && hasActivePlan;

  async function purchase() {
    if (!signedIn) {
      window.location.href = `/login?next=${encodeURIComponent("/dashboard/billing#topup")}`;
      return;
    }
    if (!hasActivePlan) {
      window.location.href = "/dashboard/billing";
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError(data.error ?? "Checkout failed");
    } catch {
      setError("Checkout failed");
    }
    setLoading(false);
  }

  const ctaLabel = !signedIn
    ? "Sign in to purchase"
    : !hasActivePlan
      ? "Start a plan first"
      : loading
        ? "Redirecting…"
        : "Purchase";

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white text-left shadow-sm">
      <div className="grid lg:grid-cols-[1.4fr_1fr]">
        <div className="border-b border-zinc-100 p-6 sm:p-8 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              {pack.credits.toLocaleString("en-US")} credits
            </h3>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600">
              $1 ≈ {rate} credits
            </span>
            {discount > 0 && (
              <span className="rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                −{discount}%
              </span>
            )}
          </div>

          <ul className="mt-5 space-y-2 text-sm text-zinc-600">
            <li className="flex gap-2">
              <span className="text-teal-600">✓</span>
              Never expire · used after your monthly plan allowance
            </li>
            <li className="flex gap-2">
              <span className="text-teal-600">✓</span>
              ~{triageApprox.toLocaleString("en-US")} triages or ~{draftsApprox.toLocaleString("en-US")} voice
              drafts
            </li>
            <li className="flex gap-2">
              <span className="text-teal-600">✓</span>
              Requires an active Pilot or Wingman plan
            </li>
          </ul>

          <div className="mt-8 flex justify-between gap-1 overflow-x-auto pb-1 text-[11px] font-medium sm:text-xs">
            {TOPUP_PACKS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`min-w-[2rem] shrink-0 transition-colors ${
                  i === index
                    ? "text-zinc-900"
                    : p.bestValue
                      ? "text-teal-700"
                      : "text-zinc-400 hover:text-zinc-600"
                }`}
              >
                {formatCreditsShort(p.credits)}
              </button>
            ))}
          </div>

          <div className="mt-3 px-1">
            <input
              type="range"
              min={0}
              max={TOPUP_PACKS.length - 1}
              step={1}
              value={index}
              onChange={(e) => setIndex(Number(e.target.value))}
              className="iw-topup-range"
              aria-label="Select credit pack"
            />
          </div>
        </div>

        <div className="flex flex-col justify-between bg-zinc-50/80 p-6 sm:p-8">
          <div>
            {pack.bestValue && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-600 px-2.5 py-1 text-xs font-bold text-white">
                Best value
              </span>
            )}
            <div className="mt-4 flex items-baseline gap-3">
              <span className="text-lg text-zinc-400 line-through">{money(pack.listCents)}</span>
              <span className="text-4xl font-bold tracking-tight text-zinc-900">
                {money(pack.priceCents)}
              </span>
            </div>
            <p className="mt-2 text-sm text-zinc-500">One-time purchase · USD</p>
          </div>

          <div className="mt-8">
            <button
              type="button"
              onClick={purchase}
              disabled={loading}
              className={`w-full rounded-full py-3.5 text-sm font-bold disabled:opacity-60 ${
                canPurchase
                  ? "bg-zinc-900 text-white hover:bg-zinc-800"
                  : "border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              {ctaLabel}
            </button>
            {!hasActivePlan && signedIn && (
              <p className="mt-3 text-xs text-zinc-500">
                Top-ups are only available once you have an active subscription.
              </p>
            )}
            {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
