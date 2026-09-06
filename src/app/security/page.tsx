import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { SecurityAttestations } from "@/components/security-attestations";

export const metadata: Metadata = {
  title: "Security — Inbox Wingman",
  description:
    "Google Verified and CASA Tier 2 AL1 (In Compliance). How Inbox Wingman protects Gmail: encryption, no AI training, no auto-send.",
};

export default function SecurityPage() {
  return (
    <MarketingShell wide>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Trust</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Security</h1>
      <p className="mt-3 max-w-2xl text-lg text-zinc-600">
        Email is personal. We built Wingman so only you — and the assistant working for you — can
        reach it, and so the blast radius stays small.
      </p>

      <Link
        href="/security/secrets"
        className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-teal-100 bg-teal-50/70 px-5 py-4 transition hover:border-teal-200 hover:bg-teal-50"
      >
        <span>
          <span className="block text-sm font-semibold text-zinc-900">
            Visit secrets management
          </span>
          <span className="mt-0.5 block text-sm text-zinc-600">
            View controls, encryption, rotation, and decrypt audit →
          </span>
        </span>
      </Link>

      <div className="mt-10">
        <SecurityAttestations />
      </div>

      <p className="mt-8 max-w-3xl text-sm leading-relaxed text-zinc-700">
        Our systems have been audited by a third-party security lab. Inbox Wingman is{" "}
        <strong className="font-semibold text-zinc-900">Google Verified</strong> and{" "}
        <strong className="font-semibold text-zinc-900">CASA Tier 2 AL1</strong> accredited (In
        Compliance, TAC Security / App Defense Alliance). We have never sold your data, and we
        never will.
      </p>

      <div className="mt-12 space-y-8 text-sm leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Our commitment to you</h2>
          <ul className="mt-3 space-y-2">
            <li>Your mail is never used to train general AI models — ours or anyone else&apos;s.</li>
            <li>Gmail tokens are encrypted at rest (AES-256-GCM). Access tokens are never stored.</li>
            <li>We keep metadata and short summaries — not full message bodies.</li>
            <li>Wingman writes drafts and labels. Nothing sends without you.</li>
            <li>Your data is yours: disconnect or delete anytime.</li>
          </ul>
        </section>
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
          <h2 className="text-lg font-semibold text-zinc-900">Encrypted tokens and secrets</h2>
          <p className="mt-2">
            Gmail refresh tokens are encrypted at rest with AES-256-GCM. API keys and other
            server secrets stay in Sensitive Vercel environment variables — never in the browser
            or in git. We store metadata (sender, subject, snippet, category, short summary) —
            not full message bodies. Access control, the secret inventory, and decrypt/encrypt
            monitoring are documented in{" "}
            <Link href="/security/secrets" className="underline">
              Secrets management
            </Link>
            .
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
          <Link href="/terms" className="underline">
            Terms
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
