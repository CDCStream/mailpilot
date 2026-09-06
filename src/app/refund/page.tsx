import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "Inbox Wingman Refunds — Cancellation and money-back policy",
  description:
    "How to cancel Inbox Wingman and when refunds apply. Billing is handled by Paddle. Trial does not require a card.",
  path: "/refund",
});

export default function RefundPage() {
  return (
    <MarketingShell>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Legal</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Refund & cancellation</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: {LEGAL_EFFECTIVE_DATE}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Cancel anytime</h2>
          <p className="mt-2">
            You can cancel Pilot or Wingman from{" "}
            <Link href="/dashboard/billing" className="underline">
              Billing
            </Link>{" "}
            → Manage subscription. Access continues until the end of the current paid period.
            The 14-day trial does not require a card and has nothing to refund.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Refunds</h2>
          <p className="mt-2">
            Payments are processed by Paddle, our merchant of record. If a charge was made in
            error, or you were billed after a cancellation that should have taken effect, email{" "}
            <a href="mailto:support@inboxwingman.com" className="underline">
              support@inboxwingman.com
            </a>{" "}
            with the receipt. We review refund requests in good faith, typically within 7 days.
            Unused monthly AI credits do not roll over and are not cashed out. Purchased top-up
            credits never expire and are not refunded once granted, except where required by law
            or when the charge itself was unauthorized.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Chargebacks</h2>
          <p className="mt-2">
            Please contact us first so we can fix the issue. Paddle may handle disputes as the
            merchant of record.
          </p>
        </section>
      </div>
    </MarketingShell>
  );
}
