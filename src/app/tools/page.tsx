import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { FREE_TOOLS } from "@/lib/free-tools";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Free Email Tools — Inbox Wingman",
  description:
    "Free, no-signup tools for everyday email work — built by the team behind Inbox Wingman. Everything runs in your browser.",
  alternates: { canonical: `${SITE_URL}/tools` },
  openGraph: {
    title: "Free Email Tools — Inbox Wingman",
    description: "Free, no-signup tools for everyday email work. Everything runs in your browser.",
    url: `${SITE_URL}/tools`,
    type: "website",
  },
};

export default function ToolsIndexPage() {
  return (
    <MarketingShell wide>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Resources</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Free email tools</h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-600">
        No signup, no data collection — every tool runs entirely in your browser.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {FREE_TOOLS.map((t) => (
          <Link
            key={t.slug}
            href={`/tools/${t.slug}`}
            className="group rounded-2xl border border-zinc-200 p-6 transition hover:border-zinc-300 hover:shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-teal-700">
              {t.category}
            </p>
            <h2 className="mt-2 text-lg font-semibold text-zinc-900 group-hover:underline">
              {t.name}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{t.description}</p>
          </Link>
        ))}
      </div>
    </MarketingShell>
  );
}
