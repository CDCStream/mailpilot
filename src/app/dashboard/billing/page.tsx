import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, subscriptions } from "@/lib/db";
import { billingEnabled } from "@/lib/billing";
import { CREDIT_COSTS, PLANS, TRIAL_CREDITS } from "@/lib/plans";
import { getCreditBalance } from "@/lib/usage";
import { BillingButtons } from "./buttons";
import { CreditTopupScroller } from "@/components/credit-topup";

const STATUS_COPY: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-emerald-100 text-emerald-700" },
  trialing: { label: "Free trial", cls: "bg-teal-100 text-teal-800" },
  past_due: { label: "Payment failed", cls: "bg-rose-100 text-rose-700" },
  canceled: { label: "Canceled", cls: "bg-zinc-100 text-zinc-600" },
  none: { label: "No subscription", cls: "bg-zinc-100 text-zinc-600" },
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const userId = session!.user.id;
  const sp = await searchParams;
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  const status = sub?.status ?? "none";
  const copy = STATUS_COPY[status] ?? STATUS_COPY.none;
  const hasSubscription = status === "active" || status === "trialing" || status === "past_due";
  const planId = sub?.plan === "wingman" ? "wingman" : sub?.plan === "pilot" ? "pilot" : null;
  const plan = planId ? PLANS[planId] : null;
  const credits = await getCreditBalance(userId);
  const planPct =
    credits.planLimit > 0
      ? Math.min(100, Math.round((credits.planUsed / credits.planLimit) * 100))
      : 0;

  const topupOk = sp.topup === "success";
  const topupCredits = typeof sp.credits === "string" ? sp.credits : null;

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <h1 className="text-2xl font-bold">Billing</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Monthly plans plus optional top-ups when you need more AI.
      </p>

      {topupOk && (
        <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Top-up checkout complete
          {topupCredits ? ` — ${Number(topupCredits).toLocaleString("en-US")} credits` : ""}. They appear
          in your wallet after payment is confirmed (usually a few seconds).
        </p>
      )}

      {!billingEnabled() && (
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Billing checks are disabled (BILLING_ENABLED=false). Credits use the Wingman
          allowance for local testing.
        </p>
      )}

      <div className="mt-8 grid items-start gap-8 xl:grid-cols-2">
      <div className="rounded-2xl border border-zinc-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold">
              {plan ? `${plan.name}` : credits.planName}
              {hasSubscription && plan ? (
                <span className="ml-2 text-sm font-normal text-zinc-500">
                  ${plan.priceMonthly}/month
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              {status === "trialing"
                ? `${TRIAL_CREDITS} credits during your 7-day trial`
                : plan
                  ? `${plan.credits.toLocaleString("en-US")} AI credits / month`
                  : "Pick a plan to unlock triage & drafts"}
            </p>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${copy.cls}`}>
            {copy.label}
          </span>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium text-zinc-700">Plan credits this month</span>
            <span className="text-zinc-500">
              {credits.planUsed.toLocaleString("en-US")} / {credits.planLimit.toLocaleString("en-US")} used
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className={`h-full rounded-full transition-all ${planPct >= 90 ? "bg-rose-500" : "bg-teal-600"}`}
              style={{ width: `${planPct}%` }}
            />
          </div>
          <p className="mt-3 text-sm text-zinc-600">
            Top-up wallet:{" "}
            <span className="font-semibold text-zinc-900">
              {credits.bonusCredits.toLocaleString("en-US")} credits
            </span>
            <span className="text-zinc-400">
              {" "}
              · {credits.remaining.toLocaleString("en-US")} total left
            </span>
          </p>
          <p className="mt-2 text-xs text-zinc-400">
            Triage = {CREDIT_COSTS.triage} · Draft = {CREDIT_COSTS.draft} · Brief ={" "}
            {CREDIT_COSTS.brief} credits
          </p>
        </div>

        {sub?.currentPeriodEnd && hasSubscription && (
          <p className="mt-4 text-sm text-zinc-500">
            Current period ends {sub.currentPeriodEnd.toDateString()}
          </p>
        )}

        <BillingButtons hasSubscription={hasSubscription} showPlanPicker={!hasSubscription} />
      </div>

      <section>
        <h2 className="text-lg font-semibold">Top up credits</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Scroll to pick a pack. Credits never expire and kick in after your monthly allowance.
        </p>
        <div id="topup" className="mt-5">
          <CreditTopupScroller signedIn hasActivePlan={hasSubscription} />
        </div>
      </section>
      </div>

      {!hasSubscription && (
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {Object.values(PLANS).map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border p-5 ${p.popular ? "border-teal-500 bg-teal-50/40" : "border-zinc-200"}`}
            >
              {p.popular && (
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-teal-700">
                  Most popular
                </p>
              )}
              <p className="font-semibold">{p.name}</p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-sm font-medium text-zinc-400 line-through">
                  ${p.listMonthly}
                </span>
                <span className="text-2xl font-bold">${p.priceMonthly}</span>
                <span className="text-sm font-normal text-zinc-500">/mo</span>
              </p>
              <p className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-block rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800">
                  {p.credits.toLocaleString("en-US")} credits / mo
                </span>
                <span className="inline-block rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                  Save {p.savePct}% · Early bird
                </span>
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-zinc-600">
                {p.features.map((f) => (
                  <li key={f}>· {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
