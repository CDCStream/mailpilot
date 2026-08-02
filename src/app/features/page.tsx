import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { CREDIT_COSTS, PLANS } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Features — Inbox Wingman",
  description: "Smart triage, voice drafts, daily brief, rules, multi-inbox, and credit-based AI for Gmail.",
};

const SECTIONS = [
  {
    id: "triage",
    title: "Smart triage",
    body: "Every incoming message is classified the moment it lands and labeled inside Gmail: To Respond, FYI, Newsletter, Marketing, Notification, Cold Email. Optional auto-archive for low-priority noise.",
  },
  {
    id: "drafts",
    title: "Voice-matched drafts",
    body: "Wingman learns your tone from sent mail and drops a ready-to-send reply into the thread. You review, edit, and send. It never sends for you.",
  },
  {
    id: "brief",
    title: "Daily brief",
    body: "One morning email: replies you owe, deadlines and action items extracted from your mail, key takeaways from your newsletters, and bills & deliveries — every item deep-linked to the thread in Gmail.",
  },
  {
    id: "chat",
    title: "Ask your inbox",
    body: "Chat with your whole inbox in plain language — \"what needs my reply?\", \"any invoices this week?\". Answers come from your triaged mail with conversation memory, never invented (uses AI credits).",
  },
  {
    id: "rules",
    title: "Rules & templates",
    body: "Write rules in plain English, or use one-click templates — archive newsletters, skip cold-email drafts, star a VIP domain. Applied on every triage.",
  },
  {
    id: "multi",
    title: "Multi-inbox Gmail",
    body: `Connect up to ${PLANS.pilot.maxAccounts} Gmail accounts on Pilot, or ${PLANS.wingman.maxAccounts} on Wingman. One Wingman for every inbox you actually live in.`,
  },
  {
    id: "credits",
    title: "Credit-based AI",
    body: `Triage is unlimited and free. A voice draft costs ${CREDIT_COSTS.draft}, a daily brief ${CREDIT_COSTS.brief}. See usage on your dashboard; top up when you need more.`,
  },
  {
    id: "privacy",
    title: "Private by design",
    body: "We store labels and metadata, not full email bodies. Tokens are encrypted at rest. Your mail is never used to train models. See Security and Privacy for details.",
  },
];

export default function FeaturesPage() {
  return (
    <MarketingShell wide>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Product</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Features</h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-600">
        Everything Wingman does inside Gmail — built for busy founders, operators, and execs.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <section
            key={s.id}
            id={s.id}
            className="scroll-mt-24 rounded-2xl border border-zinc-200 p-6"
          >
            <h2 className="text-lg font-semibold text-zinc-900">{s.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{s.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-12 text-center">
        <Link
          href="/login"
          className="inline-flex rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          Connect Gmail — free for 7 days
        </Link>
      </div>
    </MarketingShell>
  );
}
