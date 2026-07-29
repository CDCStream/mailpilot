import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "Security — Inbox Wingman",
  description: "How Inbox Wingman protects Gmail data: encryption, no AI training on your mail, no auto-send.",
};

export default function SecurityPage() {
  return (
    <MarketingShell>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Resources</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Security</h1>
      <p className="mt-3 text-zinc-600">
        Is my email safe? Short answer: we design so the blast radius stays small.
      </p>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">We never train on your mail</h2>
          <p className="mt-2">
            Email content is not used to train generalized AI or marketing models. Processing is for
            the features you enable — triage, drafts, briefs — only.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Transient AI processing</h2>
          <p className="mt-2">
            Classification and drafting go through our AI provider (OpenAI) via its API. API data
            is not used to train their models; the provider may retain it briefly (up to 30 days)
            solely for abuse monitoring, then deletes it. We don&apos;t keep the AI&apos;s copy of
            your content at all.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Encrypted tokens</h2>
          <p className="mt-2">
            Gmail refresh tokens are encrypted at rest with AES-256-GCM. We store metadata (sender,
            subject, snippet, category, short summary) — not full message bodies.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Nothing sends without you</h2>
          <p className="mt-2">
            Wingman creates drafts and labels. There is no autopilot send. You approve every outbound
            message in Gmail.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Google Limited Use</h2>
          <p className="mt-2">
            Use of Gmail data adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="underline"
              rel="noreferrer"
              target="_blank"
            >
              Google API Services User Data Policy
            </a>
            , including Limited Use.
          </p>
        </section>
        <p>
          Full legal detail:{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          ,{" "}
          <Link href="/dpa" className="underline">
            DPA
          </Link>
          ,{" "}
          <Link href="/subprocessors" className="underline">
            Sub-processors
          </Link>
          .
        </p>
      </div>
    </MarketingShell>
  );
}
