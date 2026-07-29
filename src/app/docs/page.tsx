import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { CREDIT_COSTS, TRIAL_CREDITS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Documentation — Inbox Wingman",
  description: "How Inbox Wingman connects to Gmail, spends credits, and stays private.",
};

export default function DocsPage() {
  return (
    <MarketingShell>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Resources</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Documentation</h1>
      <p className="mt-3 text-zinc-600">A short guide to getting value in the first hour.</p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">1. Connect Gmail</h2>
          <p className="mt-2">
            Sign in with Google and grant <code className="rounded bg-zinc-100 px-1">gmail.modify</code>{" "}
            so Wingman can apply labels and create drafts. Add a test user in Google Cloud while the
            app is in testing mode.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">2. Onboarding</h2>
          <p className="mt-2">
            We create <code className="rounded bg-zinc-100 px-1">Wingman/*</code> labels, learn your
            voice from recent sent mail, and triage a sample of your inbox.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">3. Credits</h2>
          <p className="mt-2">
            Trial includes {TRIAL_CREDITS} credits. Costs: triage {CREDIT_COSTS.triage} · draft{" "}
            {CREDIT_COSTS.draft} · brief {CREDIT_COSTS.brief}. Top-ups need an active plan and never
            expire. Track usage on the dashboard.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">4. Rules</h2>
          <p className="mt-2">
            Open Rules → add plain English or a template (archive newsletters, VIP domain, etc.).
            Rules run on every new message after classification.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">5. Extra Gmail accounts</h2>
          <p className="mt-2">
            Settings → Connect Gmail. Limits depend on your plan. Each account gets its own labels
            and sync.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">More</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <Link href="/security" className="underline">
                Security
              </Link>
            </li>
            <li>
              <Link href="/#faq" className="underline">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/contact" className="underline">
                Contact
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </MarketingShell>
  );
}
