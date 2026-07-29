"use client";

import { useEffect, useState } from "react";

/**
 * Animated 4-slide feature tour shown while account setup runs in the
 * background (labels, voice profile, initial triage take a minute or two).
 */
export function OnboardingTour({ onFinished }: { onFinished: () => void }) {
  const [slide, setSlide] = useState(0);

  const slides = [
    {
      title: "Your inbox gets organized",
      caption:
        "Every incoming email is labeled inside Gmail the moment it lands. Low-priority mail is archived if you asked for that.",
      demo: <OrganizeDemo />,
      cta: "Continue",
    },
    {
      title: "Your replies are pre-written",
      caption:
        "When an email needs a response, a draft in your voice appears right in the thread. You review and hit send — Wingman never sends for you.",
      demo: <DraftDemo />,
      cta: "Continue",
    },
    {
      title: "Your morning brief",
      caption:
        "One email a day: replies you owe, deadlines, newsletter takeaways, bills & deliveries — every line linked straight to Gmail.",
      demo: <BriefDemo />,
      cta: "Continue",
    },
    {
      title: "Ask your inbox anything",
      caption:
        "Chat with your whole inbox in plain language — counts, categories, what needs a reply. Answers come from your triaged mail, never invented.",
      demo: <ChatDemo />,
      cta: "Got it",
    },
  ];

  const current = slides[slide];
  const last = slide === slides.length - 1;

  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left shadow-sm">
      <div className="border-b border-zinc-100 bg-zinc-50/70 p-5">{current.demo}</div>
      <div className="p-6">
        <h2 className="text-lg font-semibold text-zinc-900">{current.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">{current.caption}</p>
        <div className="mt-5 flex items-center justify-between gap-4">
          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Slide ${i + 1}`}
                onClick={() => setSlide(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === slide ? "w-6 bg-zinc-900" : "w-1.5 bg-zinc-300 hover:bg-zinc-400"
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => (last ? onFinished() : setSlide(slide + 1))}
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            {current.cta}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Slide 1: labels popping onto inbox rows ---------- */

const ORGANIZE_ROWS = [
  { from: "Mike Parker", subject: "Quick feedback on the sales deck?", label: "To Respond", cls: "bg-rose-100 text-rose-700" },
  { from: "Amazon", subject: "Your parcel is due to be delivered", label: "Notification", cls: "bg-emerald-100 text-emerald-700" },
  { from: "Lucy Squires", subject: "Invitation: Weekly catchup @ Wed", label: "FYI", cls: "bg-sky-100 text-sky-700" },
  { from: "Morning Brew", subject: "☕ Start your engines", label: "Newsletter", cls: "bg-amber-100 text-amber-800", archived: true },
];

function OrganizeDemo() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    async function loop() {
      while (!cancelled) {
        setVisible(0);
        await wait(500);
        for (let i = 1; i <= ORGANIZE_ROWS.length; i++) {
          if (cancelled) return;
          setVisible(i);
          await wait(450);
        }
        await wait(2200);
      }
    }
    void loop();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white text-sm">
      {ORGANIZE_ROWS.map((row, i) => {
        const labeled = i < visible;
        return (
          <li key={row.from} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium text-zinc-900">{row.from}</span>
                {row.archived && labeled && (
                  <span className="iw-fade-up text-[11px] font-medium text-emerald-600">
                    Archived
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-zinc-500">{row.subject}</p>
            </div>
            {labeled ? (
              <span
                className={`iw-fade-up shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${row.cls}`}
              >
                {row.label}
              </span>
            ) : (
              <span className="h-4 w-14 shrink-0 rounded-full bg-zinc-100" />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- Slide 2: typewriter draft ---------- */

const DRAFT_TEXT =
  "Hi Mike — deck looks strong. Two tweaks: lead with the Q3 retention chart and cut slide 7. Happy to review again before Friday.";

function DraftDemo() {
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    async function loop() {
      while (!cancelled) {
        setTyped("");
        setDone(false);
        await wait(700);
        for (let i = 1; i <= DRAFT_TEXT.length; i++) {
          if (cancelled) return;
          setTyped(DRAFT_TEXT.slice(0, i));
          await wait(16 + (i % 9 === 0 ? 36 : 0));
        }
        setDone(true);
        await wait(2600);
      }
    }
    void loop();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-teal-700">
        Draft ready · sounds like you
      </p>
      <p className="min-h-[72px] text-[13px] leading-relaxed text-zinc-800">
        {typed}
        {!done && (
          <span className="iw-caret ml-0.5 inline-block h-3.5 w-[2px] translate-y-[2px] bg-zinc-800 align-middle" />
        )}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span
          className={`rounded-full px-4 py-1.5 text-xs font-semibold text-white transition ${
            done ? "bg-blue-600" : "bg-zinc-300"
          }`}
        >
          Send
        </span>
        <span className="text-[11px] text-zinc-400">← that part is always you</span>
      </div>
    </div>
  );
}

/* ---------- Slide 3: daily brief lines ---------- */

const BRIEF_LINES = [
  { icon: "✉️", text: "3 emails need a reply — drafts are waiting" },
  { icon: "⏰", text: "Invoice #4210 due Friday · reply to Sarah by EOD" },
  { icon: "📰", text: "Your 8 newsletters, boiled down to 4 takeaways" },
  { icon: "📦", text: "Amazon order arriving today" },
  { icon: "🔋", text: "412 AI credits left this month" },
];

function BriefDemo() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    async function loop() {
      while (!cancelled) {
        setVisible(0);
        await wait(500);
        for (let i = 1; i <= BRIEF_LINES.length; i++) {
          if (cancelled) return;
          setVisible(i);
          await wait(550);
        }
        await wait(2400);
      }
    }
    void loop();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-zinc-900">Your Wingman brief</p>
        <span className="text-[11px] text-zinc-400">Daily · 8:00</span>
      </div>
      <ul className="mt-3 min-h-[140px] space-y-2.5">
        {BRIEF_LINES.slice(0, visible).map((line) => (
          <li key={line.text} className="iw-fade-up flex items-start gap-2 text-[13px] text-zinc-700">
            <span aria-hidden>{line.icon}</span>
            {line.text}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Slide 4: ask your inbox (AI chat) ---------- */

const CHAT_QUESTION = "How many emails did acme.com send me in the last 5 days?";

const CHAT_LINES = [
  { kind: "intro" as const, text: "3 emails — 2 notifications, 1 needs your reply:" },
  { kind: "header" as const, text: "Notifications (2)" },
  { kind: "bullet" as const, sender: "Acme.com", text: "Sign-in to your account · today" },
  { kind: "bullet" as const, sender: "Acme.com", text: "Your company has been registered 🎉 · Jul 24" },
  { kind: "header" as const, text: "To Respond (1)" },
  { kind: "bullet" as const, sender: "Acme.com", text: "Signature pending — SS-4 form · Jul 25" },
];

function ChatDemo() {
  const [typed, setTyped] = useState("");
  const [stage, setStage] = useState<"typing" | "thinking" | "answer">("typing");
  const [lines, setLines] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    async function loop() {
      while (!cancelled) {
        setTyped("");
        setStage("typing");
        setLines(0);
        await wait(500);
        for (let i = 1; i <= CHAT_QUESTION.length; i++) {
          if (cancelled) return;
          setTyped(CHAT_QUESTION.slice(0, i));
          await wait(20);
        }
        await wait(300);
        if (cancelled) return;
        setStage("thinking");
        await wait(900);
        if (cancelled) return;
        setStage("answer");
        for (let i = 1; i <= CHAT_LINES.length; i++) {
          if (cancelled) return;
          setLines(i);
          await wait(420);
        }
        await wait(2800);
      }
    }
    void loop();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <div className="min-h-[170px] space-y-2.5">
        <div className="flex justify-end">
          <p className="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-900 px-3 py-2 text-xs text-white">
            {typed}
            {stage === "typing" && (
              <span className="iw-caret ml-0.5 inline-block h-3 w-[2px] translate-y-[2px] bg-white align-middle" />
            )}
          </p>
        </div>

        {stage === "thinking" && (
          <div className="flex justify-start">
            <p className="iw-fade-up flex items-center gap-2 rounded-2xl rounded-bl-md bg-zinc-100 px-3 py-2 text-xs text-zinc-400">
              <span className="iw-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-violet-500" />
              Checking your mail…
            </p>
          </div>
        )}

        {stage === "answer" && (
          <div className="flex justify-start">
            <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-zinc-100 px-3 py-2.5 text-xs text-zinc-700">
              {CHAT_LINES.slice(0, lines).map((line, i) => {
                if (line.kind === "intro") {
                  return (
                    <p key={i} className="iw-fade-up">
                      {line.text}
                    </p>
                  );
                }
                if (line.kind === "header") {
                  return (
                    <p key={i} className="iw-fade-up mt-1.5 font-semibold text-zinc-900">
                      {line.text}
                    </p>
                  );
                }
                return (
                  <p key={i} className="iw-fade-up mt-1 flex items-baseline gap-1.5">
                    <span className="h-1 w-1 shrink-0 translate-y-[-2px] rounded-full bg-zinc-400" />
                    <span>
                      <strong className="font-semibold text-zinc-900">{line.sender}</strong> —{" "}
                      {line.text}
                    </span>
                  </p>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
