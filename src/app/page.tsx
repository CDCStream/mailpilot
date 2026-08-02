import Link from "next/link";
import { auth } from "@/auth";
import { BrandLogo } from "@/components/brand-logo";
import { CreditTopupScroller } from "@/components/credit-topup";
import { InboxDemo } from "@/components/inbox-demo";
import { SiteFooter } from "@/components/site-footer";
import { hasActiveAccess } from "@/lib/billing";
import { CREDIT_COSTS, PLANS, TRIAL_CREDITS } from "@/lib/plans";

const FAQ = [
  {
    q: "What's included in the free trial?",
    a: "7 days free — unlimited triage, drafts for every mail that needs one, daily brief, and plain-English rules. No credit card required.",
  },
  {
    q: "How do AI credits work?",
    a: `Triage is unlimited and free. Credits only meter the expensive stuff: a voice draft costs ${CREDIT_COSTS.draft}, a daily brief ${CREDIT_COSTS.brief}, Ask AI ${CREDIT_COSTS.ask}. Plans refresh monthly; optional top-ups never expire.`,
  },
  {
    q: "What happens when I run out of AI credits?",
    a: "Triage keeps running. Drafts, brief digests, and Ask AI pause until your next monthly refresh or you buy a top-up. Your Gmail stays untouched.",
  },
  {
    q: "Can I buy top-up credits without a plan?",
    a: "No. Top-ups require an active Pilot or Wingman subscription (including during trial). Start a plan first, then add packs anytime from Billing.",
  },
  {
    q: "How much do plans cost?",
    a: `Early-bird pricing for our first 100 customers: Pilot is $${PLANS.pilot.priceMonthly}/month (normally $${PLANS.pilot.listMonthly}) — about ${Math.floor(PLANS.pilot.credits / CREDIT_COSTS.draft)} AI drafts/month, unlimited triage, up to ${PLANS.pilot.maxAccounts} Gmail accounts. Wingman is $${PLANS.wingman.priceMonthly}/month for heavier inboxes. Your early-bird price stays locked in for as long as you keep your subscription.`,
  },
  {
    q: "Is my email safe?",
    a: "We never train on your mail, our AI provider doesn't train on it either, and Gmail tokens are encrypted at rest with AES-256-GCM. Wingman only creates drafts — nothing sends without your approval in Gmail. See our Privacy Policy for the full picture.",
  },
  {
    q: "Does Wingman send email for me?",
    a: "No. It labels mail and writes draft replies in your voice. You review and hit send yourself — always.",
  },
  {
    q: "Do I need a credit card to start?",
    a: "No. Start the 7-day trial with Google sign-in only — no card. Add payment later if you want to keep Wingman after the trial.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Manage or cancel from the Billing portal. Access continues until the end of the paid period; top-up wallet credits stay on your account.",
  },
  {
    q: "Can I connect more than one Gmail?",
    a: `Yes. Pilot supports up to ${PLANS.pilot.maxAccounts} Gmail accounts; Wingman up to ${PLANS.wingman.maxAccounts}. Add them from Settings → Connect Gmail.`,
  },
];

const FEATURES = [
  {
    title: "Noise first, drafts second",
    body: "CI alerts, Sentry, Dependabot, newsletters — labeled and sorted. Automated senders are recognized and skipped for drafts, so credits aren't spent on bots.",
  },
  {
    title: "Nothing moves without you",
    body: "\"Just label\" mode keeps every message in your inbox. Respect my categories means Wingman won't override filters or labels you already set.",
  },
  {
    title: "Drafts in your voice",
    body: "A transparent voice profile shows how Wingman thinks you write — then drafts only for real humans. You review and send. It never sends for you.",
  },
  {
    title: "Unused drafts clean themselves up",
    body: "Send-ready drafts you don't use are removed from Gmail after 14 days, so your Drafts folder stays yours — not a pile of AI leftovers.",
  },
  {
    title: "Daily brief",
    body: "One morning email: replies you owe, deadlines from your mail, newsletter takeaways, bills & deliveries — each linked straight to Gmail.",
  },
  {
    title: "Ask your inbox",
    body: "Chat with triaged mail — \"what do I owe replies to?\", \"any invoices this week?\" — answered from your inbox, never invented.",
  },
  {
    title: "Rules in plain English",
    body: "Skip drafts for a domain, archive newsletters, star a VIP — written as sentences, not filter syntax.",
  },
  {
    title: "Up to 5 Gmail accounts",
    body: "Personal + work + side project on Pilot. One Wingman for every inbox you actually live in.",
  },
  {
    title: "Pay for drafts, not triage",
    body: "Unlimited triage is included. Credits only meter voice drafts, briefs, and Ask AI. No card for the 7-day trial.",
  },
];

export default async function LandingPage() {
  const session = await auth();
  const cta = session?.user ? "/dashboard" : "/login";
  const hasPlan = session?.user?.id ? await hasActiveAccess(session.user.id) : false;

  return (
    <main className="flex-1">
      <header className="relative z-20 border-b border-zinc-100/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-3">
            <BrandLogo size={40} />
            <span className="text-xl font-semibold tracking-tight">Inbox Wingman</span>
          </span>
          <nav className="flex items-center gap-6 text-sm">
            <a href="#features" className="text-zinc-600 hover:text-zinc-900">
              Features
            </a>
            <a href="#pricing" className="text-zinc-600 hover:text-zinc-900">
              Pricing
            </a>
            <a href="#faq" className="hidden text-zinc-600 hover:text-zinc-900 sm:inline">
              FAQ
            </a>
            <Link
              href={cta}
              className="rounded-full bg-zinc-900 px-4 py-2 font-medium text-white hover:bg-zinc-800"
            >
              {session?.user ? "Dashboard" : "Sign in"}
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero — brand + one CTA + live product demo */}
      <section className="relative overflow-hidden pb-20 pt-14 sm:pt-20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(45,212,191,0.18), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 20%, rgba(99,102,241,0.12), transparent 50%), linear-gradient(180deg, #f4f7fb 0%, #ffffff 70%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-full opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(15,23,42,0.08) 1px, transparent 0)",
            backgroundSize: "22px 22px",
            maskImage: "linear-gradient(180deg, black, transparent 75%)",
          }}
        />

        <div className="mx-auto max-w-4xl px-6 text-center">
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-zinc-900 sm:text-5xl">
            Your Gmail, triaged and drafted by AI
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl font-semibold tracking-tight text-teal-800 sm:text-2xl">
            325 emails in two weeks. 8 actually needed you.
          </p>
          <p className="mx-auto mt-5 max-w-xl text-base text-zinc-600 sm:text-lg">
            Wingman sorts CI noise, newsletters, and bots — then drafts only the humans, in
            your voice. Vercel, GitHub, Sentry, Dependabot: recognized, skipped, no draft.
          </p>
          <p className="mt-4 text-sm font-medium text-zinc-700">
            Works inside Gmail · nothing to install · never sends without you
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
            <Link
              href={cta}
              className="inline-flex items-center gap-2.5 rounded-full bg-zinc-900 px-7 py-3 text-base font-semibold text-white hover:bg-zinc-800"
            >
              <GoogleG className="h-5 w-5" />
              Get started with Gmail
            </Link>
            <a
              href="#demo"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900"
            >
              See it on a real inbox →
            </a>
          </div>
          <p className="mt-5 text-sm font-semibold text-teal-800">
            7 days free · No credit card required
          </p>
        </div>

        {/* Above-the-fold product pixel — real inbox mix, not a marketing claim */}
        <div className="mx-auto mt-12 max-w-3xl px-6">
          <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white/90 shadow-[0_20px_50px_-24px_rgba(15,23,42,0.35)] ring-1 ring-zinc-900/5">
            <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
              <p className="text-sm font-semibold text-zinc-900">Triage mix · last 14 days</p>
              <p className="text-xs text-zinc-400">My inbox · 325 emails</p>
            </div>
            <div className="space-y-3.5 px-5 py-5">
              {(
                [
                  { label: "Notifications", n: 149, pct: 46, color: "bg-sky-500" },
                  { label: "Newsletters", n: 111, pct: 34, color: "bg-amber-500" },
                  { label: "To Respond", n: 8, pct: 2.5, color: "bg-rose-500" },
                  { label: "Everything else", n: 57, pct: 17.5, color: "bg-zinc-300" },
                ] as const
              ).map((row) => (
                <div key={row.label}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-medium text-zinc-700">{row.label}</span>
                    <span className="tabular-nums text-zinc-900">{row.n}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className={`h-full rounded-full ${row.color}`}
                      style={{ width: `${Math.max(row.pct, 3)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="border-t border-zinc-100 px-5 py-3 text-center text-xs text-zinc-500">
              8 needed a reply. The rest was noise Wingman labeled inside Gmail.
            </p>
          </div>
        </div>

        <div id="demo" className="mx-auto mt-14 max-w-4xl px-6">
          <InboxDemo />
        </div>
      </section>

      <section id="features" className="border-t border-zinc-100 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Built against the complaints others ignore
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-zinc-600">
            Auto-draft spam, moved mail, and a Drafts folder full of leftovers — the three
            things technical founders hate most about AI email tools.
          </p>
          <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <h3 className="font-semibold text-zinc-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-zinc-100 bg-zinc-50/80 py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Pay for drafts, not triage</h2>
          <p className="mx-auto mt-3 max-w-lg text-zinc-600">
            Unlimited triage is included. Credits only meter voice drafts ({CREDIT_COSTS.draft}),
            daily briefs ({CREDIT_COSTS.brief}), and Ask AI ({CREDIT_COSTS.ask}). 7-day trial — no
            card required.
          </p>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-800">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Early-bird pricing — locked in forever for our first 100 customers
          </p>
          <div className="mt-10 grid gap-6 text-left sm:grid-cols-2">
            {Object.values(PLANS).map((p) => (
              <div
                key={p.id}
                className={`relative rounded-3xl border bg-white p-8 shadow-sm ${
                  p.popular ? "border-teal-500 ring-1 ring-teal-500" : "border-zinc-200"
                }`}
              >
                {p.popular && (
                  <span className="absolute -top-3 right-6 rounded-full bg-teal-600 px-3 py-0.5 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}
                <p className="text-sm font-medium uppercase tracking-widest text-teal-700">
                  {p.name}
                </p>
                <p className="mt-1 text-sm text-zinc-500">{p.tagline}</p>
                <p className="mt-4 flex flex-wrap items-baseline gap-x-2.5">
                  <span className="text-2xl font-semibold text-zinc-400 line-through decoration-zinc-300">
                    ${p.listMonthly}
                  </span>
                  <span className="text-5xl font-bold">${p.priceMonthly}</span>
                  <span className="text-lg font-normal text-zinc-500">/month</span>
                </p>
                <p className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-block rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
                    {p.credits.toLocaleString("en-US")} credits / mo
                  </span>
                  <span className="inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    Save {p.savePct}% · Early bird
                  </span>
                </p>
                <ul className="mt-6 space-y-2 text-sm text-zinc-600">
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                <Link
                  href={session?.user ? "/dashboard/billing" : "/login"}
                  className={`mt-8 block rounded-full px-6 py-3 text-center font-semibold ${
                    p.popular
                      ? "bg-zinc-900 text-white hover:bg-zinc-800"
                      : "border border-zinc-300 text-zinc-900 hover:bg-zinc-50"
                  }`}
                >
                  Start 7-day free trial
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-16 text-left">
            <h3 className="text-center text-xl font-semibold tracking-tight text-zinc-900">
              Need more? Top up anytime
            </h3>
            <p className="mx-auto mt-2 max-w-lg text-center text-sm text-zinc-600">
              Scroll to pick a pack. Credits never expire and stack on top of your monthly plan.
            </p>
            <div className="mt-6">
              <CreditTopupScroller
                signedIn={Boolean(session?.user)}
                hasActivePlan={hasPlan}
              />
            </div>
          </div>
        </div>
      </section>

      <section id="faq" className="border-t border-zinc-100 bg-zinc-50/60 py-24">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">FAQ</h2>
          <p className="mx-auto mt-3 max-w-md text-center text-zinc-600">
            Credits, privacy, and how Wingman works inside Gmail.
          </p>
          <div className="mt-12 divide-y divide-zinc-200 border-y border-zinc-200">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold text-zinc-900 marker:content-none [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg font-normal text-zinc-400 transition group-open:bg-teal-100 group-open:text-teal-800"
                  >
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">×</span>
                  </span>
                </summary>
                <p className="mt-3 pr-10 text-sm leading-relaxed text-zinc-600">{item.a}</p>
              </details>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-zinc-500">
            More detail in our{" "}
            <Link href="/privacy" className="font-medium text-zinc-800 underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </section>

      {/* Closing CTA — last ask before the footer, heavy on trust signals */}
      <section className="border-t border-zinc-100 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <div
            className="relative overflow-hidden rounded-3xl border border-teal-100 px-6 py-16 text-center sm:px-16"
            style={{
              background:
                "radial-gradient(ellipse 70% 90% at 50% -20%, rgba(45,212,191,0.22), transparent 60%), linear-gradient(180deg, #f0fdfa 0%, #ffffff 90%)",
            }}
          >
            <h2 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              Ready to stop babysitting your inbox?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-600">
              Connect Gmail, and Wingman starts labeling, drafting, and briefing within minutes.
              You stay in control of every send.
            </p>
            <div className="mt-8 flex justify-center">
              <Link
                href={cta}
                className="inline-flex items-center gap-2.5 rounded-full bg-zinc-900 px-8 py-3.5 text-base font-semibold text-white hover:bg-zinc-800"
              >
                <GoogleG className="h-5 w-5" />
                Start your free week
              </Link>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              {TRIAL_CREDITS} AI credits included · cancel anytime
            </p>
            <ul className="mx-auto mt-8 flex max-w-2xl flex-wrap items-center justify-center gap-2 text-xs font-medium text-zinc-600">
              {[
                "GDPR-ready",
                "Google Limited Use compliant",
                "No AI training on your mail",
                "Email bodies never stored",
                "Delete your data anytime",
              ].map((t) => (
                <li
                  key={t}
                  className="rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5"
                >
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.77.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
