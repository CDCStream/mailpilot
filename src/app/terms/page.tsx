import Link from "next/link";

export const metadata = { title: "Terms of Service — MailPilot" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl flex-1 px-6 py-16">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-900">
        ← MailPilot
      </Link>
      <h1 className="mt-6 text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-sm text-zinc-500">Last updated: {new Date().toDateString()}</p>

      <div className="mt-8 space-y-6 text-sm leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">1. The service</h2>
          <p>
            MailPilot is an AI email assistant that organizes your Gmail inbox, drafts
            replies, and sends daily summaries. Drafts are suggestions: you are always
            responsible for reviewing and sending email yourself.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">2. Subscriptions</h2>
          <p>
            MailPilot Pro is billed monthly via Stripe after a 7-day free trial. You can
            cancel anytime from the billing portal; access continues until the end of the
            paid period.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">3. Acceptable use</h2>
          <p>
            You may not use MailPilot for spam, unlawful activity, or on mailboxes you do
            not own or administer.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">4. Disclaimer</h2>
          <p>
            AI-generated categories, summaries, and drafts can contain mistakes. The
            service is provided &quot;as is&quot; without warranties; our liability is
            limited to the fees you paid in the last 3 months.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">5. Contact</h2>
          <p>Questions: support@mailpilot.app</p>
        </section>
      </div>
    </main>
  );
}
