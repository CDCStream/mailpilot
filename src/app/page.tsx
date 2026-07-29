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
    a: `7 days with ${TRIAL_CREDITS} AI credits — smart triage, voice-matched drafts, daily brief, and plain-English rules. Cancel anytime before it converts.`,
  },
  {
    q: "How do AI credits work?",
    a: `Triage costs ${CREDIT_COSTS.triage} credit, a voice draft ${CREDIT_COSTS.draft}, and a daily brief ${CREDIT_COSTS.brief}. Your plan refreshes credits each month; optional top-ups never expire and spend after your plan allowance.`,
  },
  {
    q: "What happens when I run out of AI credits?",
    a: "AI triage, drafts, and brief summaries pause until your next monthly refresh or you buy a top-up. Your Gmail stays untouched — we just stop spending until you have credits again.",
  },
  {
    q: "Can I buy top-up credits without a plan?",
    a: "No. Top-ups require an active Pilot or Wingman subscription (including during trial). Start a plan first, then add packs anytime from Billing.",
  },
  {
    q: "How much do plans cost?",
    a: `Early-bird pricing for our first 100 customers: Pilot is $${PLANS.pilot.priceMonthly}/month (normally $${PLANS.pilot.listMonthly}) with ${PLANS.pilot.credits.toLocaleString("en-US")} credits and up to ${PLANS.pilot.maxAccounts} Gmail accounts. Wingman is $${PLANS.wingman.priceMonthly}/month (normally $${PLANS.wingman.listMonthly}) with ${PLANS.wingman.credits.toLocaleString("en-US")} credits and up to ${PLANS.wingman.maxAccounts} accounts. Your early-bird price stays locked in for as long as you keep your subscription.`,
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
    a: "Yes — the 7-day trial is card-backed via our payment provider so we can convert smoothly if you keep the product. Cancel in Billing before the trial ends and you won't be charged.",
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
    title: "Smart triage",
    body: "Every incoming email is labeled inside Gmail — To Respond, FYI, Newsletter, Marketing, Notification, Cold Email — the moment it lands.",
  },
  {
    title: "Drafts in your voice",
    body: "Learns your tone from sent mail and drops a ready-to-send reply into the thread. You review, tweak, and hit send. It never sends for you.",
  },
  {
    title: "Ask your inbox",
    body: "Chat with your whole inbox — \"what do I owe replies to?\", \"any invoices this week?\" — answered from your triaged mail, never invented.",
  },
  {
    title: "Daily brief",
    body: "One morning email: replies you owe, deadlines pulled from your mail, key takeaways from your newsletters, and bills & deliveries — every item linked straight to Gmail.",
  },
  {
    title: "Rules & templates",
    body: "Write rules in plain English, or one-click templates: archive newsletters, skip cold-email drafts, star a VIP domain.",
  },
  {
    title: "Multi-inbox Gmail",
    body: "Connect up to 5 Gmail accounts on Pilot, or 10 on Wingman. One Wingman for every inbox you actually live in.",
  },
  {
    title: "Credit-based AI",
    body: "Triage, drafts, and briefs spend credits you can see. No surprise infinite bill — upgrade or top up when you need more.",
  },
  {
    title: "Credit top-ups",
    body: "Need a burst for a busy week? Buy a pack anytime (with an active plan). Top-up credits never expire.",
  },
  {
    title: "Private by design",
    body: "We store labels and metadata, not your email bodies. Tokens are encrypted at rest and your mail is never used to train AI models.",
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
          <div className="mb-6 flex items-center justify-center gap-2.5">
            <BrandLogo size={48} />
            <span className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Inbox Wingman
            </span>
          </div>
          <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-zinc-900 sm:text-5xl">
            Too many emails?
            <br />
            <span className="text-teal-700">
              Let Wingman sort them, draft your replies, and brief you every morning.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-zinc-600 sm:text-lg">
            For busy Gmail users — founders, operators, execs — who get 50+ emails a day.
            Replies sound like you, and everything happens inside Gmail. Nothing to install.
          </p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1 text-xs font-medium text-zinc-600 shadow-sm backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
            Built for people who live in Gmail
          </p>
          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
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
              Watch it draft →
            </a>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Free for 7 days · Gmail only · Never sends without you
          </p>
        </div>

        <div id="demo" className="mx-auto mt-14 max-w-4xl px-6">
          <InboxDemo />
        </div>
      </section>

      <section id="features" className="border-t border-zinc-100 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            What Wingman does while you work
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-zinc-600">
            Triage, drafts, briefs, rules, and credits — built for busy Gmail users.
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
          <h2 className="text-3xl font-bold tracking-tight">Credit-based pricing</h2>
          <p className="mx-auto mt-3 max-w-lg text-zinc-600">
            Pay for AI you actually use. Triage costs {CREDIT_COSTS.triage} credit, a voice draft{" "}
            {CREDIT_COSTS.draft}, a daily brief {CREDIT_COSTS.brief}. Trial includes{" "}
            {TRIAL_CREDITS} credits.
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
