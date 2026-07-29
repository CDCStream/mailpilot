import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "Roadmap — Inbox Wingman",
  description: "What Inbox Wingman is shipping next.",
};

const ITEMS: { status: string; title: string; body: string; cls: string }[] = [
  {
    status: "Shipped",
    title: "Gmail triage, drafts, brief, rules, credits",
    body: "Push sync, voice drafts, AI inbox chat, multi-inbox, templates, top-ups.",
    cls: "bg-emerald-100 text-emerald-800",
  },
  {
    status: "Next",
    title: "Follow-up tracking",
    body: "Flag unanswered sent mail and draft a polite voice-matched nudge when it's time.",
    cls: "bg-teal-100 text-teal-800",
  },
  {
    status: "Later",
    title: "Team shared context",
    body: "Optional shared VIP lists and rules for small teams — still no autopilot send.",
    cls: "bg-zinc-100 text-zinc-600",
  },
  {
    status: "Not planned",
    title: "Autopilot send / Outlook MVP",
    body: "We stay Gmail-first and human-approved. Outlook may come after Gmail polish.",
    cls: "bg-zinc-100 text-zinc-500",
  },
];

export default function RoadmapPage() {
  return (
    <MarketingShell>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Company</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Roadmap</h1>
      <p className="mt-3 text-zinc-600">Transparent priorities. Dates move; principles don&apos;t.</p>
      <ul className="mt-10 space-y-4">
        {ITEMS.map((item) => (
          <li key={item.title} className="rounded-2xl border border-zinc-200 p-5">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${item.cls}`}>
              {item.status}
            </span>
            <h2 className="mt-3 font-semibold text-zinc-900">{item.title}</h2>
            <p className="mt-1 text-sm text-zinc-600">{item.body}</p>
          </li>
        ))}
      </ul>
    </MarketingShell>
  );
}
