import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";
import { LEGAL_EFFECTIVE_DATE, PADDLE_PRIVACY } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy — Inbox Wingman" };

export default function PrivacyPage() {
  return (
    <MarketingShell>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Legal</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: {LEGAL_EFFECTIVE_DATE}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">What Inbox Wingman does</h2>
          <p className="mt-2">
            Inbox Wingman connects to your Gmail account (with your explicit consent via Google
            OAuth) to categorize incoming email, create reply drafts, and send you a daily
            summary. Inbox Wingman never sends email on your behalf.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Google user data we access</h2>
          <p className="mt-2">
            With your consent, we access: your Google account email address and basic profile
            (name, avatar) to create your account; and your Gmail messages via the Gmail API —
            we read message headers and content to categorize mail and generate summaries and
            reply drafts, apply/remove labels and archive messages according to your
            preferences, and create reply drafts in your Drafts folder. Message content is
            processed transiently and is not stored on our servers (see below).
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Data we store</h2>
          <p className="mt-2">
            We store email <strong>metadata only</strong>: sender, subject, a short snippet, the
            assigned category, and a one-sentence AI summary. We do <strong>not</strong> store
            full email bodies. Your Google refresh token is encrypted at rest with AES-256-GCM.
            Server API keys and other platform secrets are stored only as Sensitive Vercel
            environment variables (not in this database). See{" "}
            <Link href="/security/secrets" className="underline">
              Secrets management
            </Link>{" "}
            for access control, cryptography, and monitoring. We also store first-party
            product events (page path, action name, and coarse location from the hosting
            CDN) so we can operate the product. Those events are not sold, not used for
            advertising, and identified rows are deleted with your account.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">
            Limited Use disclosure (Google API Services)
          </h2>
          <p className="mt-2">
            Inbox Wingman&apos;s use and transfer of information received from Google APIs
            adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="underline"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. Gmail data is used only to provide the
            features you see in the product. It is never used for advertising, never sold,
            never sent to Google Analytics or Google Ads, and never used to train generalized
            AI or machine-learning models.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">AI processing</h2>
          <p className="mt-2">
            Email content is sent to our AI provider (OpenAI) over their API to classify
            messages and generate drafts. Per OpenAI&apos;s API data controls, API customer
            content is not used to train their models. By default OpenAI may keep abuse-monitoring
            logs (which can include prompts and responses) for up to 30 days, then delete them,
            unless law requires longer retention. We do not store OpenAI&apos;s copy of your
            content.
          </p>
          <p className="mt-2">
            If you opt in to voice matching, we derive a short writing-style profile from
            emails you select or recently sent. This profile personalizes drafts{" "}
            <strong>for your account only</strong> — it is never used to train, develop, or
            improve any generalized AI/ML model, and it is deleted with your account.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Payments</h2>
          <p className="mt-2">
            Inbox Wingman uses Paddle.com Market Ltd as merchant of record. Paddle takes your
            payment, issues the receipt, and handles VAT/sales tax. Card and tax identity data
            go to Paddle, not to us. We only store your plan, subscription status, Paddle
            customer/subscription ids, and credit balance. Paddle processes that payment data
            under{" "}
            <a href={PADDLE_PRIVACY} className="underline">
              Paddle&apos;s privacy policy
            </a>
            .
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Your controls</h2>
          <p className="mt-2">
            You can disconnect Gmail at any time from your Google Account&apos;s security
            settings, or delete your Inbox Wingman account from Settings — deletion immediately
            and permanently removes your profile, encrypted tokens, message metadata, rules,
            first-party events, and usage records. For access, export, or correction requests see{" "}
            <Link href="/data-request" className="underline">
              Data request
            </Link>{" "}
            or email support@inboxwingman.com.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">GDPR: legal bases</h2>
          <p className="mt-2">
            For users in the EU/EEA and UK, we process personal data on these bases:{" "}
            <strong>performance of a contract</strong> (providing triage, drafts, and briefs you
            signed up for), <strong>consent</strong> (Gmail access via Google OAuth, and optional
            Google Analytics / Ads cookies, which you can withdraw at any time), and{" "}
            <strong>legitimate interests</strong> (securing the service, preventing abuse, and
            first-party product analytics).
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">GDPR: your rights</h2>
          <p className="mt-2">
            You have the right to access, correct, export (data portability), delete, and
            restrict or object to the processing of your personal data. Deletion and Gmail
            disconnection are self-serve (Settings); for anything else use{" "}
            <Link href="/data-request" className="underline">
              Data request
            </Link>
            . We respond within 30 days. You may also lodge a complaint with your local
            supervisory authority.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">International transfers</h2>
          <p className="mt-2">
            Our infrastructure and sub-processors may process data in the United States and
            other countries. Where GDPR applies, transfers rely on appropriate safeguards such
            as Standard Contractual Clauses or the EU–US Data Privacy Framework, as offered by
            each provider.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Retention</h2>
          <p className="mt-2">
            Message metadata and account data are kept while your account is active and deleted
            when you delete your account. Billing records are retained by our payment provider
            as required by law. We use a login session cookie and a first-party visitor
            cookie to stitch page views before you sign in. Ahrefs Web Analytics loads on
            all pages and is cookie-free. If you accept analytics cookies, we also load
            Google Analytics 4 and (when configured) Google Ads tags via Consent Mode, to
            measure visits and conversions. Those tags receive page path and conversion
            events only — never Gmail content, never your email address. You can reject
            them; the product still works.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Sub-processors</h2>
          <p className="mt-2">
            See our{" "}
            <Link href="/subprocessors" className="underline">
              Sub-processors
            </Link>{" "}
            list and{" "}
            <Link href="/dpa" className="underline">
              DPA
            </Link>{" "}
            overview.
          </p>
        </section>
      </div>
    </MarketingShell>
  );
}
