import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "Data Processing Agreement — Inbox Wingman",
  description: "DPA overview for Inbox Wingman customers.",
};

export default function DpaPage() {
  return (
    <MarketingShell>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Legal</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Data Processing Agreement</h1>
      <p className="mt-2 text-sm text-zinc-500">Summary · Last updated: {new Date().toDateString()}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-700">
        <p>
          When you use Inbox Wingman, we act as a processor of Gmail-related personal data on your
          behalf for the purpose of providing the service (triage, drafts, briefs, account
          administration).
        </p>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Scope</h2>
          <p className="mt-2">
            Categories include account identifiers, encrypted OAuth tokens, email metadata (sender,
            subject, snippet), AI-generated labels/summaries, and usage/billing records. We do not
            store full email bodies.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Instructions</h2>
          <p className="mt-2">
            We process data only to deliver the product features you enable, to secure the service,
            and to meet legal obligations. We do not sell personal data or use Gmail content for
            advertising.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Sub-processors</h2>
          <p className="mt-2">
            Current list:{" "}
            <Link href="/subprocessors" className="underline">
              Sub-processors
            </Link>
            .
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Security & deletion</h2>
          <p className="mt-2">
            Measures include encrypted tokens, access controls, and immediate deletion of stored
            data when you delete your account (unless law requires retention of billing records). Details in our{" "}
            <Link href="/security" className="underline">
              Security
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="underline">
              Privacy
            </Link>{" "}
            pages.
          </p>
        </section>
        <p>
          For a signed DPA for procurement, email{" "}
          <a href="mailto:support@inboxwingman.com" className="underline">
            support@inboxwingman.com
          </a>
          .
        </p>
      </div>
    </MarketingShell>
  );
}
