import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "Compare — Inbox Wingman",
  description: "Inbox Wingman vs doing it manually, vs a full email client, vs autopilot senders.",
};

const ROWS: { label: string; wingman: string; manual: string; client: string }[] = [
  {
    label: "Works inside Gmail",
    wingman: "Yes",
    manual: "Yes",
    client: "No — new inbox",
  },
  {
    label: "AI triage labels",
    wingman: "Yes",
    manual: "You",
    client: "Varies",
  },
  {
    label: "Voice-matched drafts",
    wingman: "Yes",
    manual: "You",
    client: "Sometimes",
  },
  {
    label: "Sends without you",
    wingman: "Never",
    manual: "You",
    client: "Often optional",
  },
  {
    label: "Credit-based cost control",
    wingman: "Yes",
    manual: "n/a",
    client: "Rare",
  },
  {
    label: "Ask your inbox (AI chat)",
    wingman: "Yes",
    manual: "n/a",
    client: "Rare",
  },
  {
    label: "Learning curve",
    wingman: "Minutes",
    manual: "Years of pain",
    client: "Days–weeks",
  },
];

export default function ComparePage() {
  return (
    <MarketingShell wide>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Product</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Compare</h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-600">
        Wingman is a Gmail add-on, not another inbox. You stay where you already work.
      </p>

      <div className="mt-10 overflow-x-auto rounded-2xl border border-zinc-200">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Capability</th>
              <th className="px-4 py-3 font-medium text-teal-800">Inbox Wingman</th>
              <th className="px-4 py-3 font-medium">Manual Gmail</th>
              <th className="px-4 py-3 font-medium">Full AI client</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {ROWS.map((r) => (
              <tr key={r.label}>
                <td className="px-4 py-3 font-medium text-zinc-900">{r.label}</td>
                <td className="px-4 py-3 text-teal-800">{r.wingman}</td>
                <td className="px-4 py-3 text-zinc-600">{r.manual}</td>
                <td className="px-4 py-3 text-zinc-600">{r.client}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-8 text-sm text-zinc-600">
        Want the short version?{" "}
        <Link href="/login" className="font-medium text-zinc-900 underline">
          Connect Gmail
        </Link>{" "}
        and try the 7-day trial.
      </p>
    </MarketingShell>
  );
}
