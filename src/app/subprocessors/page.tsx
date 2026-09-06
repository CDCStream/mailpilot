import type { Metadata } from "next";
import { MarketingShell } from "@/components/marketing-shell";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Sub-processors — Inbox Wingman",
  description: "Third parties that process data for Inbox Wingman.",
};

const ROWS = [
  {
    name: "Google (Gmail / OAuth)",
    purpose: "Mailbox access you authorize; identity",
    region: "Per your Google account",
  },
  {
    name: "OpenAI",
    purpose:
      "Classification, drafts, summaries via API — not used to train models; default abuse logs up to 30 days",
    region: "USA / provider regions",
  },
  {
    name: "Supabase / Postgres host",
    purpose: "Application database",
    region: "As configured for the deployment",
  },
  {
    name: "Vercel",
    purpose: "Application hosting",
    region: "USA / provider regions",
  },
  {
    name: "Paddle",
    purpose: "Merchant of record — checkout, tax, invoices, subscriptions, credit top-ups",
    region: "UK / provider regions",
  },
  {
    name: "Resend",
    purpose: "Transactional email (daily brief, system mail)",
    region: "USA / provider regions",
  },
  {
    name: "Inngest",
    purpose: "Background job orchestration",
    region: "USA / provider regions",
  },
  {
    name: "Google Analytics / Google Ads",
    purpose:
      "Optional visit and conversion measurement (Consent Mode). No Gmail content or email addresses.",
    region: "USA / provider regions",
  },
];

export default function SubprocessorsPage() {
  return (
    <MarketingShell wide>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Legal</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Sub-processors</h1>
      <p className="mt-3 text-zinc-600">
        Third parties that may process personal data to run Inbox Wingman. We update this list when
        vendors change.
      </p>
      <div className="mt-10 overflow-x-auto rounded-2xl border border-zinc-200">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Vendor</th>
              <th className="px-4 py-3 font-medium">Purpose</th>
              <th className="px-4 py-3 font-medium">Region</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {ROWS.map((r) => (
              <tr key={r.name}>
                <td className="px-4 py-3 font-medium text-zinc-900">{r.name}</td>
                <td className="px-4 py-3 text-zinc-600">{r.purpose}</td>
                <td className="px-4 py-3 text-zinc-600">{r.region}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-sm text-zinc-500">Last updated: {LEGAL_EFFECTIVE_DATE}</p>
    </MarketingShell>
  );
}
