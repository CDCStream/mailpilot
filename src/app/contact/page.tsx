import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "Contact — Inbox Wingman",
  description: "Contact Inbox Wingman support and privacy requests.",
};

export default function ContactPage() {
  return (
    <MarketingShell>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Company</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Contact</h1>
      <p className="mt-3 text-zinc-600">We read everything. Serious questions get serious replies.</p>

      <div className="mt-10 space-y-6 text-sm text-zinc-700">
        <div className="rounded-2xl border border-zinc-200 p-6">
          <h2 className="font-semibold text-zinc-900">Support & product</h2>
          <p className="mt-2">
            Email{" "}
            <a href="mailto:support@inboxwingman.com" className="font-medium underline">
              support@inboxwingman.com
            </a>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 p-6">
          <h2 className="font-semibold text-zinc-900">Privacy & data requests</h2>
          <p className="mt-2">
            Use the{" "}
            <Link href="/data-request" className="font-medium underline">
              data request
            </Link>{" "}
            form instructions, or email the same address with subject &quot;Data request&quot;.
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 p-6">
          <h2 className="font-semibold text-zinc-900">Security reports</h2>
          <p className="mt-2">
            Responsible disclosure welcome at{" "}
            <a href="mailto:support@inboxwingman.com" className="font-medium underline">
              support@inboxwingman.com
            </a>{" "}
            with subject &quot;Security&quot;.
          </p>
        </div>
      </div>
    </MarketingShell>
  );
}
