import Link from "next/link";
import { auth } from "@/auth";

const FEATURES = [
  {
    title: "Smart triage",
    body: "Every incoming email is labeled inside Gmail — To Respond, FYI, Newsletter, Marketing, Notification, Cold Email — the moment it lands. Low-priority noise can be archived automatically.",
  },
  {
    title: "Drafts in your voice",
    body: "MailPilot learns your tone from your sent mail and drops a ready-to-send reply draft into the thread. You review, tweak, and hit send. It never sends for you.",
  },
  {
    title: "Daily brief",
    body: "One email every morning: what needs your response, who still hasn't replied to you, and what happened in the last 24 hours.",
  },
  {
    title: "Follow-up radar",
    body: "Sent something important and got silence? MailPilot tracks unanswered threads and nudges you when it's time to follow up.",
  },
  {
    title: "Rules in plain English",
    body: '"Archive receipts", "never draft replies to my accountant", "star anything from acme.com" — write the rule, MailPilot applies it.',
  },
  {
    title: "Private by design",
    body: "We store labels and metadata, not your email bodies. Tokens are encrypted at rest and your mail is never used to train AI models.",
  },
];

export default async function LandingPage() {
  const session = await auth();
  const cta = session?.user ? "/dashboard" : "/login";

  return (
    <main className="flex-1">
      {/* Nav */}
      <header className="border-b border-zinc-100">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">MailPilot</span>
          <nav className="flex items-center gap-6 text-sm">
            <a href="#features" className="text-zinc-600 hover:text-zinc-900">
              Features
            </a>
            <a href="#pricing" className="text-zinc-600 hover:text-zinc-900">
              Pricing
            </a>
            <Link
              href={cta}
              className="rounded-full bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-700"
            >
              {session?.user ? "Dashboard" : "Sign in"}
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-24 text-center">
        <p className="mb-4 text-sm font-medium uppercase tracking-widest text-indigo-600">
          AI email assistant for Gmail
        </p>
        <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
          Your inbox, organized.
          <br />
          Your replies, drafted.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-600">
          MailPilot works inside your Gmail. It labels what matters, drafts replies that
          sound like you, tracks who owes you an answer, and briefs you every morning.
          Nothing to install, nothing to learn.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href={cta}
            className="rounded-full bg-indigo-600 px-8 py-3 text-base font-semibold text-white shadow-lg shadow-indigo-600/20 hover:bg-indigo-500"
          >
            Connect Gmail — free for 7 days
          </Link>
          <a href="#features" className="text-sm font-medium text-zinc-600 hover:text-zinc-900">
            See how it works →
          </a>
        </div>
        <p className="mt-4 text-xs text-zinc-400">
          One-click setup · Never sends without you · Cancel anytime
        </p>
      </section>

      {/* Inbox mock */}
      <section className="mx-auto max-w-3xl px-6 pb-24">
        <div className="overflow-hidden rounded-2xl border border-zinc-200 shadow-xl">
          <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
            <span className="h-3 w-3 rounded-full bg-red-300" />
            <span className="h-3 w-3 rounded-full bg-yellow-300" />
            <span className="h-3 w-3 rounded-full bg-green-300" />
            <span className="ml-3">Inbox — Gmail</span>
          </div>
          <ul className="divide-y divide-zinc-100 text-sm">
            {[
              ["Sarah Chen", "Re: Q4 budget review", "To Respond", "bg-rose-100 text-rose-700", "Draft ready"],
              ["Stripe", "Your invoice for July", "Notification", "bg-sky-100 text-sky-700", ""],
              ["Product Weekly", "Issue #214: pricing pages", "Newsletter", "bg-amber-100 text-amber-700", "Archived"],
              ["John Martinez", "Contract feedback needed", "To Respond", "bg-rose-100 text-rose-700", "Draft ready"],
              ["GrowthTools", "Book a demo this week?", "Cold Email", "bg-zinc-100 text-zinc-500", "Archived"],
            ].map(([from, subject, label, cls, extra]) => (
              <li key={subject} className="flex items-center gap-4 px-5 py-3.5">
                <span className="w-32 shrink-0 truncate font-medium">{from}</span>
                <span className="flex-1 truncate text-zinc-600">{subject}</span>
                {extra && (
                  <span className="hidden text-xs font-medium text-emerald-600 sm:inline">
                    {extra}
                  </span>
                )}
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
                  {label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-zinc-100 bg-zinc-50 py-24">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Everything an inbox assistant should do
          </h2>
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="mx-auto max-w-md px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Simple pricing</h2>
          <div className="mt-10 rounded-3xl border border-zinc-200 p-8 shadow-sm">
            <p className="text-sm font-medium uppercase tracking-widest text-indigo-600">Pro</p>
            <p className="mt-4 text-5xl font-bold">
              $19<span className="text-lg font-normal text-zinc-500">/month</span>
            </p>
            <ul className="mt-6 space-y-2 text-sm text-zinc-600">
              <li>Unlimited smart triage</li>
              <li>Voice-matched reply drafts</li>
              <li>Daily brief &amp; follow-up radar</li>
              <li>Plain-English rules</li>
            </ul>
            <Link
              href={cta}
              className="mt-8 block rounded-full bg-zinc-900 px-6 py-3 font-semibold text-white hover:bg-zinc-700"
            >
              Start 7-day free trial
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-zinc-500 sm:flex-row">
          <span>© {new Date().getFullYear()} MailPilot</span>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-zinc-900">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-zinc-900">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
