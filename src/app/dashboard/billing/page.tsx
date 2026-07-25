import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, subscriptions } from "@/lib/db";
import { billingEnabled } from "@/lib/billing";
import { BillingButtons } from "./buttons";

const STATUS_COPY: Record<string, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-emerald-100 text-emerald-700" },
  trialing: { label: "Free trial", cls: "bg-indigo-100 text-indigo-700" },
  past_due: { label: "Payment failed", cls: "bg-rose-100 text-rose-700" },
  canceled: { label: "Canceled", cls: "bg-zinc-100 text-zinc-600" },
  none: { label: "No subscription", cls: "bg-zinc-100 text-zinc-600" },
};

export default async function BillingPage() {
  const session = await auth();
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, session!.user.id),
  });
  const status = sub?.status ?? "none";
  const copy = STATUS_COPY[status] ?? STATUS_COPY.none;
  const hasSubscription = status === "active" || status === "trialing" || status === "past_due";

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold">Billing</h1>

      {!billingEnabled() && (
        <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Billing checks are disabled in this environment (BILLING_ENABLED=false). All
          features are unlocked.
        </p>
      )}

      <div className="mt-8 rounded-2xl border border-zinc-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold">MailPilot Pro</p>
            <p className="mt-1 text-sm text-zinc-500">$19/month · 7-day free trial</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${copy.cls}`}>
            {copy.label}
          </span>
        </div>
        {sub?.currentPeriodEnd && hasSubscription && (
          <p className="mt-4 text-sm text-zinc-500">
            Current period ends {sub.currentPeriodEnd.toDateString()}
          </p>
        )}
        <BillingButtons hasSubscription={hasSubscription} />
      </div>
    </div>
  );
}
