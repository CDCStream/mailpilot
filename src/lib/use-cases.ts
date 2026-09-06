import type { FaqItem } from "@/lib/seo";

export type UseCaseHubCard = {
  title: string;
  body: string;
  href?: string;
};

export type UseCase = {
  slug: string;
  name: string;
  nameH1: string;
  tagline: string;
  description: string;
  updated: string;
  intro: string;
  pains: { title: string; body: string }[];
  scenes: { title: string; body: string }[];
  notThis: string[];
  faq: FaqItem[];
  cta: { headline: string; body: string; href: string; label: string };
};

export const USE_CASES: UseCase[] = [
  {
    slug: "freelance-developers",
    name: "Freelance developers",
    nameH1: "Gmail AI for freelance developers",
    tagline:
      "Client threads first, CI noise quiet, drafts in your voice. Inbox Wingman stays inside Gmail and never sends without you.",
    description:
      "AI email assistant for freelance developers who live in Gmail. Client threads first, CI noise quiet, drafts in your voice. Never sends without you.",
    updated: "2026-09-06",
    intro:
      "If you invoice from Gmail, keep a client shared inbox, and still get Dependabot at 11pm, you do not need another mail client. You need triage that knows a human from a bot, a draft that sounds like you, and a brief that catches the date buried in a Stripe receipt.",
    pains: [
      {
        title: "Clients sit under CI noise",
        body: "Vercel, GitHub, no-reply, and vendor mail land in the same stream as the person paying you. The thread that needs a reply is rarely the one at the top.",
      },
      {
        title: "Dates hide in mail you would skip",
        body: "Failed invoices, reserved-instance expiry, a renewal you meant to handle Friday — they look like notifications until they are late.",
      },
      {
        title: "You still have to sound like you",
        body: "A generic AI reply is worse than silence with a repeat client. The draft has to match the voice they already know.",
      },
    ],
    scenes: [
      {
        title: "Bots quiet. Clients first.",
        body: "Wingman labels incoming mail inside Gmail — To Respond, FYI, Newsletter, Notification, Cold Email, Money, Security. Dependabot and no-reply skip a draft. A client asking for a call gets one in your voice.",
      },
      {
        title: "Deadlines in the morning brief",
        body: "One email: replies you owe, dates pulled from threads, bills and deliveries. Each item deep-links to Gmail so you open the thread, not a new inbox.",
      },
      {
        title: "Studio, personal, shared client inbox",
        body: "Connect more than one Gmail under the same plan. Labels and draft style stay consistent whether the mail landed on your studio address or the inbox the client also sees.",
      },
      {
        title: "Ask the inbox you already have",
        body: "\"Which clients am I waiting on?\" \"Any failed invoices this week?\" Answers come from triaged mail with conversation memory — not invented, and not a second search box in a new client.",
      },
    ],
    notThis: [
      "It does not send mail for you. You review the draft in Gmail and hit send.",
      "It is not Outlook, Yahoo, or a new inbox. Gmail only.",
      "It does not train on your mail. Tokens sit encrypted at rest; we keep labels and short summaries, not full bodies.",
      "It is not a bulk unsubscriber or a filter tutorial. Google already owns those jobs.",
    ],
    faq: [
      {
        q: "Is Inbox Wingman an AI email assistant for freelance developers?",
        a: "Yes. It is built for people who run client work from Gmail — solo developers and small studios — not executive assistants or enterprise rollouts.",
      },
      {
        q: "Will it email my clients without me?",
        a: "No. Wingman applies labels and writes drafts. Nothing sends until you send it in Gmail.",
      },
      {
        q: "I have a studio inbox and a personal Gmail. Does that work?",
        a: "Yes. Pilot covers more than one Gmail; Wingman covers more. Each account gets its own labels and sync.",
      },
      {
        q: "How is this different from Fyxer or a full AI inbox?",
        a: "Wingman stays inside Gmail and never sends without you. Fyxer also covers Outlook, meetings, and calendar. Full AI clients ask you to leave Gmail. See the Fyxer alternative page if you are comparing on purpose.",
      },
    ],
    cta: {
      headline: "Stay in Gmail. Never send without you.",
      body: "Connect Gmail and try Inbox Wingman for 14 days — no card. Triage, drafts in your voice, one morning brief.",
      href: "/login",
      label: "Start free trial",
    },
  },
];

export const USE_CASE_HUB: UseCaseHubCard[] = [
  {
    title: "Freelance developers",
    body: "Client threads first, CI and vendor noise quiet, drafts that sound like you. The dedicated page.",
    href: "/use-cases/freelance-developers",
  },
  {
    title: "Small studios",
    body: "Shared client inboxes plus the founder Gmail. Same labels and draft style on every account you actually live in.",
  },
  {
    title: "Operators who still ship",
    body: "Cross-functional threads pile up. Triage keeps To Respond off FYI and notifications; rules skip drafts for bots.",
  },
  {
    title: "Multi-inbox freelancers",
    body: "Work + side project + the inbox a client also reads. One Wingman plan, the same voice everywhere.",
  },
];

export function getUseCase(slug: string): UseCase | null {
  return USE_CASES.find((c) => c.slug === slug) ?? null;
}
