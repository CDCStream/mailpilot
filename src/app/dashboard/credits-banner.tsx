import Link from "next/link";
import { hasActiveAccess } from "@/lib/billing";
import { getCreditBalance } from "@/lib/usage";

/**
 * Site-wide warning strip under the dashboard header:
 * red when AI is fully paused (no credits / inactive subscription),
 * amber when the monthly allowance is nearly gone.
 */
export async function CreditsBanner({ userId }: { userId: string }) {
  const [active, credits] = await Promise.all([
    hasActiveAccess(userId),
    getCreditBalance(userId),
  ]);

  const cta = (label: string) => (
    <Link
      href="/dashboard/billing"
      className="shrink-0 rounded-full bg-white px-4 py-1.5 text-xs font-semibold shadow-sm ring-1 ring-black/5 hover:bg-zinc-50"
    >
      {label}
    </Link>
  );

  if (!active) {
    return (
      <div className="flex items-center justify-between gap-4 bg-rose-600 px-6 py-2.5 text-sm font-medium text-white lg:px-10">
        <p>
          Your subscription is inactive — Wingman has paused triage, drafts and briefs until
          billing is sorted.
        </p>
        <span className="text-rose-600">{cta("Fix billing")}</span>
      </div>
    );
  }

  if (credits.remaining <= 0) {
    return (
      <div className="flex items-center justify-between gap-4 bg-rose-600 px-6 py-2.5 text-sm font-medium text-white lg:px-10">
        <p>
          You&apos;re out of AI credits — drafts, briefs and Ask AI pause until your monthly
          refresh. Triage keeps running.
        </p>
        <span className="text-rose-600">{cta("Add credits")}</span>
      </div>
    );
  }

  const lowThreshold = Math.max(20, Math.round(credits.planLimit * 0.1));
  if (credits.remaining <= lowThreshold) {
    return (
      <div className="flex items-center justify-between gap-4 bg-amber-100 px-6 py-2.5 text-sm font-medium text-amber-900 lg:px-10">
        <p>
          Only {credits.remaining.toLocaleString("en-US")} AI credits left this month — Wingman
          pauses when they run out.
        </p>
        <span className="text-amber-900">{cta("Top up")}</span>
      </div>
    );
  }

  return null;
}
