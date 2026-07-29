import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = { title: "Terms of Service — Inbox Wingman" };

export default function TermsPage() {
  return (
    <MarketingShell>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Legal</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: {new Date().toDateString()}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">1. The service</h2>
          <p className="mt-2">
            Inbox Wingman is an AI email assistant that organizes your Gmail inbox, drafts
            replies, and sends daily summaries. Drafts are suggestions: you are always
            responsible for reviewing and sending email yourself.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">2. Subscriptions</h2>
          <p className="mt-2">
            Inbox Wingman is billed monthly (Pilot or Wingman) after a 7-day free trial, via our
            payment provider Paddle, which acts as merchant of record for your purchase. Plans include a monthly AI credit allowance; when credits run out, AI triage
            and drafts pause until the next period or an upgrade. You can cancel anytime from
            the billing portal; access continues until the end of the paid period.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">3. Acceptable use</h2>
          <p className="mt-2">
            You may not use Inbox Wingman for spam, unlawful activity, or on mailboxes you do
            not own or administer.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">4. Disclaimer</h2>
          <p className="mt-2">
            AI-generated categories, summaries, and drafts can contain mistakes. The service is
            provided &quot;as is&quot; without warranties; our liability is limited to the fees
            you paid in the last 3 months.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">5. Contact</h2>
          <p className="mt-2">
            Questions:{" "}
            <Link href="/contact" className="underline">
              Contact
            </Link>{" "}
            or support@inboxwingman.com
          </p>
        </section>
      </div>
    </MarketingShell>
  );
}
