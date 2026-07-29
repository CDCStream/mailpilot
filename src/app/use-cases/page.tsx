import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "Use cases — Inbox Wingman",
  description: "How founders, operators, and execs use Inbox Wingman to stay on top of Gmail.",
};

const CASES = [
  {
    title: "Founders",
    body: "Investor threads, customer mail, and newsletters collide. Wingman labels what needs a reply, drafts in your voice, and keeps the noise out of your inbox.",
  },
  {
    title: "Operators & PMs",
    body: "Cross-functional threads pile up. Triage keeps To Respond separate from FYI and notifications; rules archive receipts and skip drafts for bots.",
  },
  {
    title: "Executives",
    body: "One morning brief instead of scrolling — replies you owe, deadlines, newsletter takeaways, and bills & deliveries, deep-linked to Gmail.",
  },
  {
    title: "Multi-inbox pros",
    body: "Work + side project + consulting Gmail. Connect several accounts under one Wingman plan and keep the same labels and draft style everywhere.",
  },
];

export default function UseCasesPage() {
  return (
    <MarketingShell wide>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Product</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Use cases</h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-600">
        Built for people who get 50+ emails a day and still need to sound human.
      </p>
      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {CASES.map((c) => (
          <div key={c.title} className="rounded-2xl border border-zinc-200 p-6">
            <h2 className="text-lg font-semibold">{c.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{c.body}</p>
          </div>
        ))}
      </div>
      <p className="mt-10 text-center text-sm text-zinc-500">
        See{" "}
        <Link href="/features" className="font-medium text-zinc-800 underline">
          all features
        </Link>{" "}
        or{" "}
        <Link href="/#pricing" className="font-medium text-zinc-800 underline">
          pricing
        </Link>
        .
      </p>
    </MarketingShell>
  );
}
