import Link from "next/link";

export const metadata = { title: "Privacy Policy — MailPilot" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← MailPilot
      </Link>
      <h1 className="mt-6 text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: {new Date().toDateString()}</p>

      <div className="prose prose-zinc mt-8 space-y-6 text-sm leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">What MailPilot does</h2>
          <p>
            MailPilot connects to your Gmail account (with your explicit consent via Google
            OAuth) to categorize incoming email, create reply drafts, and send you a daily
            summary. MailPilot never sends email on your behalf.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Data we store</h2>
          <p>
            We store email <strong>metadata only</strong>: sender, subject, a short snippet,
            the assigned category, and a one-sentence AI summary. We do <strong>not</strong>{" "}
            store full email bodies. Your Google refresh token is encrypted at rest with
            AES-256-GCM.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">
            Limited Use disclosure (Google API Services)
          </h2>
          <p>
            MailPilot&apos;s use and transfer of information received from Google APIs
            adheres to the{" "}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="underline"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. Gmail data is used only to provide
            the features you see in the product. It is never used for advertising, never
            sold, and never used to train generalized AI or machine-learning models.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">AI processing</h2>
          <p>
            Email content is sent to our AI provider (OpenAI) transiently to classify
            messages and generate drafts, under a zero-retention API agreement. It is not
            used to train models.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Your controls</h2>
          <p>
            You can disconnect Gmail at any time from your Google Account&apos;s security
            settings or by deleting your MailPilot account, which permanently removes all
            stored data within 30 days. Contact us at support@mailpilot.app for data
            deletion requests.
          </p>
        </section>
      </div>
    </main>
  );
}
