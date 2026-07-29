import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "About — Inbox Wingman",
  description: "Why we built Inbox Wingman for busy Gmail users.",
};

export default function AboutPage() {
  return (
    <MarketingShell>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Company</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">About</h1>
      <div className="mt-8 space-y-5 text-sm leading-relaxed text-zinc-700">
        <p>
          Inbox Wingman is an AI email assistant that lives inside Gmail. We started it because busy
          founders and operators don&apos;t need another inbox — they need triage, drafts that sound
          like them, and a morning brief without the babysitting.
        </p>
        <p>
          Our product principles are simple: never send without you, meter AI so costs stay
          predictable, and stay honest about privacy. No autopilot spam, no training on your mail.
        </p>
        <p>
          We&apos;re early — shipping fast with Gmail-only focus. If that matches how you work,{" "}
          <Link href="/login" className="font-medium underline">
            connect Gmail
          </Link>{" "}
          or{" "}
          <Link href="/contact" className="font-medium underline">
            say hello
          </Link>
          .
        </p>
      </div>
    </MarketingShell>
  );
}
