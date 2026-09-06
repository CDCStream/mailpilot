import { MarketingShell } from "@/components/marketing-shell";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";
import { marketingMetadata } from "@/lib/seo";

export const metadata = marketingMetadata({
  title: "Inbox Wingman Data Request — Access, export, or delete your data",
  description:
    "Request access, export, or deletion of your Inbox Wingman account and Gmail-connected data. We respond to GDPR/CCPA requests.",
  path: "/data-request",
});

export default function DataRequestPage() {
  return (
    <MarketingShell>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Legal</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Data request</h1>
      <p className="mt-3 text-zinc-600">
        Access, correction, export, or deletion of personal data we store about you. Last
        updated: {LEGAL_EFFECTIVE_DATE}.
      </p>

      <div className="mt-10 space-y-6 text-sm leading-relaxed text-zinc-700">
        <section className="rounded-2xl border border-zinc-200 p-6">
          <h2 className="font-semibold text-zinc-900">How to request</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            <li>
              Email{" "}
              <a href="mailto:support@inboxwingman.com" className="underline">
                support@inboxwingman.com
              </a>{" "}
              from the address on your Wingman account.
            </li>
            <li>
              Subject line: <strong>Data request</strong>
            </li>
            <li>
              Say what you need: access / export / correction / deletion / disconnect Gmail.
            </li>
          </ol>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">What we can delete</h2>
          <p className="mt-2">
            Account profile, encrypted tokens, stored message metadata, rules, credit
            usage records, and billing customer linkage we control. Our payment provider (Paddle)
            retains payment records as required by law. Gmail itself stays in your Google account —
            disconnecting revokes our API access. You can also delete your account yourself from
            Settings, which removes all stored data immediately.
          </p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">Timing</h2>
          <p className="mt-2">
            Self-serve account deletion (Settings) takes effect immediately. For emailed
            requests we respond within 30 days, as required by GDPR.
          </p>
        </section>
      </div>
    </MarketingShell>
  );
}
