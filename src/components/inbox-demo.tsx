"use client";

import Image from "next/image";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

type Row = {
  from: string;
  subject: string;
  label: string;
  labelClass: string;
  avatar: string;
  /** Secondary cue: no draft / draft ready / deadline */
  note?: string;
  noteClass?: string;
  status?: string;
  expand?: boolean;
};

const ROWS: Row[] = [
  {
    from: "Vercel",
    subject: "Failed production deployment",
    label: "Notification",
    labelClass: "bg-sky-100 text-sky-700",
    avatar: "/avatars/product.png",
    note: "no draft",
    noteClass: "text-zinc-400",
  },
  {
    from: "Stripe",
    subject: "Invoice #4021 failed — retry by Aug 10",
    label: "Money",
    labelClass: "bg-emerald-100 text-emerald-800",
    avatar: "/avatars/legal.png",
    note: "⏰ deadline",
    noteClass: "text-amber-700",
  },
  {
    from: "Yaren",
    subject: "117 MB build file — how should I send?",
    label: "To Respond",
    labelClass: "bg-rose-100 text-rose-700",
    avatar: "/avatars/sarah.png",
    note: "✓ draft ready",
    noteClass: "text-emerald-600",
    expand: true,
  },
  {
    from: "Dependabot",
    subject: "Bump next 14.2 → 15.0",
    label: "Notification",
    labelClass: "bg-sky-100 text-sky-700",
    avatar: "/avatars/john.png",
    status: "Archived",
    note: "no draft",
    noteClass: "text-zinc-400",
  },
  {
    from: "Acme Corp",
    subject: "Scope change for phase 2",
    label: "To Respond",
    labelClass: "bg-rose-100 text-rose-700",
    avatar: "/avatars/legal.png",
    note: "✓ draft ready",
    noteClass: "text-emerald-600",
  },
  {
    from: "AWS",
    subject: "Reserved instance expires Aug 14",
    label: "FYI",
    labelClass: "bg-indigo-100 text-indigo-700",
    avatar: "/avatars/product.png",
    note: "⏰ deadline",
    noteClass: "text-amber-700",
  },
];

const DRAFT =
  "OneDrive or a signed download link works — email will bounce at that size. Drop it in the shared folder and ping me when it's up; I'll pull it this afternoon.";

const PAST_REPLIES = [
  { subject: "Re: phase 1 handoff", sent: "Mar 12", picked: true },
  { subject: "Fwd: out-of-office reply", sent: "Mar 11", picked: false },
  { subject: "Re: invoice #3890", sent: "Mar 10", picked: true },
  { subject: "Re: scope change question", sent: "Mar 6", picked: true },
];

const BRIEF_LINES = [
  { icon: "✉️", text: "2 client emails need a reply — drafts waiting" },
  { icon: "⏰", text: "Stripe invoice #4021 — retry by Aug 10" },
  { icon: "⏰", text: "Cancel captapi auto-renew by Aug 10" },
  { icon: "⏰", text: "Inngest lab due Aug 12" },
];

const CHAT_QUESTION = "Which clients am I still waiting on?";

type ChatLine =
  | { kind: "intro"; text: string }
  | { kind: "header"; text: string }
  | { kind: "bullet"; sender: string; text: string };

const CHAT_ANSWER: ChatLine[] = [
  { kind: "intro", text: "2 threads waiting on a client reply:" },
  { kind: "header", text: "Waiting on them" },
  { kind: "bullet", sender: "Acme Corp", text: "Scope change for phase 2 · 4 days ago" },
  { kind: "bullet", sender: "Northline", text: "Proposal sent · 11 days ago" },
  { kind: "header", text: "Money" },
  { kind: "bullet", sender: "Stripe", text: "Invoice #4021 failed — retry by Aug 10" },
];

type Phase =
  | "labels"
  | "learning"
  | "absorb"
  | "thinking"
  | "drafting"
  | "typing"
  | "done"
  | "brief"
  | "chat"
  | "chatThinking"
  | "chatAnswer"
  | "pause";

export function InboxDemo() {
  const [visibleLabels, setVisibleLabels] = useState(0);
  const [phase, setPhase] = useState<Phase>("labels");
  const [typed, setTyped] = useState("");
  const [revealed, setRevealed] = useState(0); // past replies shown so far
  const [marked, setMarked] = useState(0); // past replies decided (picked/skipped) so far
  const [dots, setDots] = useState(1); // "Learning..." thought-bubble dots
  const [briefLines, setBriefLines] = useState(0);
  const [chatTyped, setChatTyped] = useState("");
  const [chatLines, setChatLines] = useState(0);
  const repliesRef = useRef<HTMLUListElement>(null);
  const robotRef = useRef<HTMLSpanElement>(null);

  // Aim each picked reply at the robot icon so the flight lands exactly on it.
  useLayoutEffect(() => {
    if (phase !== "absorb") return;
    const robot = robotRef.current;
    const list = repliesRef.current;
    if (!robot || !list) return;
    const target = robot.getBoundingClientRect();
    for (const el of list.querySelectorAll<HTMLElement>("[data-picked='true']")) {
      const from = el.getBoundingClientRect();
      el.style.setProperty(
        "--fly-x",
        `${target.left + target.width / 2 - (from.left + from.width / 2)}px`,
      );
      el.style.setProperty(
        "--fly-y",
        `${target.top + target.height / 2 - (from.top + from.height / 2)}px`,
      );
    }
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

    async function loop() {
      while (!cancelled) {
        setVisibleLabels(0);
        setPhase("labels");
        setTyped("");
        setRevealed(0);
        setMarked(0);
        setDots(1);
        setBriefLines(0);
        setChatTyped("");
        setChatLines(0);
        await wait(400);

        for (let i = 1; i <= ROWS.length; i++) {
          if (cancelled) return;
          setVisibleLabels(i);
          await wait(380);
        }

        // --- Pick training samples from the user's past replies ---
        await wait(500);
        if (cancelled) return;
        setPhase("learning");
        await wait(600);
        for (let i = 1; i <= PAST_REPLIES.length; i++) {
          if (cancelled) return;
          setRevealed(i);
          await wait(320);
        }
        await wait(400);
        for (let i = 1; i <= PAST_REPLIES.length; i++) {
          if (cancelled) return;
          setMarked(i);
          await wait(480);
        }
        await wait(500);

        // --- Selected replies fly into the robot ---
        if (cancelled) return;
        setPhase("absorb");
        await wait(1200);

        // --- Robot thinks: "Learning..." with breathing dots ---
        if (cancelled) return;
        setPhase("thinking");
        const dotSteps = [1, 2, 3, 2, 1, 2, 3, 3];
        for (const d of dotSteps) {
          if (cancelled) return;
          setDots(d);
          await wait(380);
        }

        // --- Draft in the user's voice ---
        if (cancelled) return;
        setPhase("drafting");
        await wait(1100);
        if (cancelled) return;

        setPhase("typing");
        for (let i = 1; i <= DRAFT.length; i++) {
          if (cancelled) return;
          setTyped(DRAFT.slice(0, i));
          await wait(18 + (i % 7 === 0 ? 40 : 0));
        }

        setPhase("done");
        await wait(2200);
        if (cancelled) return;

        // --- The morning brief lands ---
        setPhase("brief");
        await wait(500);
        for (let i = 1; i <= BRIEF_LINES.length; i++) {
          if (cancelled) return;
          setBriefLines(i);
          await wait(500);
        }
        await wait(2600);
        if (cancelled) return;

        // --- Ask your inbox: question types, AI answers grouped by category ---
        setPhase("chat");
        await wait(450);
        for (let i = 1; i <= CHAT_QUESTION.length; i++) {
          if (cancelled) return;
          setChatTyped(CHAT_QUESTION.slice(0, i));
          await wait(22);
        }
        await wait(350);
        if (cancelled) return;
        setPhase("chatThinking");
        await wait(1000);
        if (cancelled) return;
        setPhase("chatAnswer");
        for (let i = 1; i <= CHAT_ANSWER.length; i++) {
          if (cancelled) return;
          setChatLines(i);
          await wait(420);
        }
        await wait(3000);
        if (cancelled) return;
        setPhase("pause");
        await wait(600);
      }
    }

    void loop();
    return () => {
      cancelled = true;
    };
  }, []);

  const showDraft = phase === "drafting" || phase === "typing" || phase === "done";
  const showLearning = phase === "learning" || phase === "absorb" || phase === "thinking";
  const showChat = phase === "chat" || phase === "chatThinking" || phase === "chatAnswer";

  const pill = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-sm transition-colors duration-300 sm:text-sm ${
      active
        ? "border-teal-300 bg-teal-50 text-teal-800"
        : "border-zinc-200/80 bg-white text-zinc-700"
    }`;

  return (
    <div className="relative mx-auto w-full max-w-3xl pt-10 sm:pt-12">
      {/* Callouts sit above the window — no overlap with inbox rows */}
      <div className="mb-4 flex flex-wrap items-center justify-center gap-2 sm:absolute sm:inset-x-0 sm:top-0 sm:mb-0 sm:justify-between sm:px-2">
        <span className={pill(phase === "labels")}>
          <span className="h-2 w-2 rounded-sm bg-teal-500" />
          Instant categorization
        </span>
        <span className={pill(showLearning || showDraft)}>
          <span className="h-2 w-2 rounded-sm bg-rose-400" />
          Drafts in your voice
        </span>
        <span className={pill(phase === "brief")}>
          <span className="h-2 w-2 rounded-sm bg-amber-400" />
          Morning brief
        </span>
        <span className={pill(showChat)}>
          <span className="h-2 w-2 rounded-sm bg-violet-400" />
          Ask your inbox
        </span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_30px_80px_-24px_rgba(15,23,42,0.35)]">
        <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50/90 px-4 py-3 text-sm text-zinc-500">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 font-medium text-zinc-700">Inbox</span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500">
            <GmailMark className="h-3.5 w-3.5" />
            Gmail
          </span>
        </div>

        <ul className="divide-y divide-zinc-100 text-sm">
          {ROWS.map((row, i) => {
            const labeled = i < visibleLabels;
            const isActive = row.expand && showDraft;
            return (
              <li key={row.subject} className={isActive ? "bg-zinc-50/70" : undefined}>
                <div className="flex items-center gap-3 px-4 py-3 sm:px-5 sm:py-3.5">
                  <Image
                    src={row.avatar}
                    alt=""
                    width={36}
                    height={36}
                    className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-zinc-200/80"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <span className="truncate font-medium text-zinc-900">{row.from}</span>
                      {row.status && labeled && (
                        <span className="text-xs font-medium text-zinc-400 iw-fade-up">
                          {row.status}
                        </span>
                      )}
                      {row.note && labeled && (
                        <span
                          className={`text-xs font-medium iw-fade-up ${row.noteClass ?? "text-zinc-500"}`}
                        >
                          {row.note}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-zinc-600">{row.subject}</p>
                  </div>
                  {labeled ? (
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium iw-fade-up ${row.labelClass}`}
                    >
                      {row.label}
                    </span>
                  ) : (
                    <span className="h-5 w-16 shrink-0 rounded-full bg-zinc-100" />
                  )}
                </div>

                {isActive && (
                  <div className="border-t border-zinc-100 px-4 pb-4 pt-1 sm:px-5 iw-fade-up">
                    <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3">
                      {/* The robot wrote this — make it unmistakable */}
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-lg ring-1 ring-teal-200"
                      >
                        🤖
                      </span>
                      <div className="min-w-0 flex-1">
                        {phase === "drafting" && (
                          <p className="flex items-center gap-2 pt-1 text-sm font-medium text-zinc-700">
                            <span className="iw-pulse-dot inline-block h-2 w-2 rounded-full bg-teal-500" />
                            AI drafting…
                          </p>
                        )}
                        {(phase === "typing" || phase === "done") && (
                          <>
                            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-teal-700">
                              Draft ready · sounds like you
                            </p>
                            <p className="text-[15px] leading-relaxed text-zinc-800">
                              {typed}
                              {phase === "typing" && (
                                <span className="iw-caret ml-0.5 inline-block h-4 w-[2px] translate-y-[2px] bg-zinc-800 align-middle" />
                              )}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* AI learning the user's voice: pick past replies → they fly into the robot → it thinks */}
        {showLearning && (
          <div className="border-t border-zinc-100 px-4 py-4 sm:px-5 iw-fade-up">
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                Your past replies · picking the best examples
              </p>
              <div className="mt-3 flex items-start gap-4">
                {/* Left: the user's sent replies, some picked, some skipped */}
                <ul ref={repliesRef} className="min-h-[104px] flex-1 space-y-1.5">
                  {PAST_REPLIES.slice(0, revealed).map((r, i) => {
                    const decided = i < marked;
                    const flying =
                      (phase === "absorb" || phase === "thinking") && r.picked;
                    const skipped = decided && !r.picked;
                    return (
                      <li
                        key={r.subject}
                        data-picked={r.picked ? "true" : undefined}
                        style={flying ? { animationDelay: `${i * 110}ms` } : undefined}
                        className={`flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-xs transition ${
                          flying ? "iw-fly-to-robot" : "iw-fade-up"
                        } ${
                          decided && r.picked
                            ? "border-teal-300 text-zinc-800"
                            : skipped
                              ? "border-zinc-200 text-zinc-400 opacity-50"
                              : "border-zinc-200 text-zinc-600"
                        }`}
                      >
                        {decided ? (
                          r.picked ? (
                            <span className="iw-fade-up font-bold text-teal-600">✓</span>
                          ) : (
                            <span className="iw-fade-up font-bold text-zinc-300">✕</span>
                          )
                        ) : (
                          <span className="h-3 w-3 rounded border border-zinc-300" />
                        )}
                        <span className={skipped ? "line-through" : undefined}>
                          {r.subject}
                        </span>
                        <span className="ml-auto shrink-0 text-[10px] text-zinc-400">
                          sent {r.sent}
                        </span>
                        {skipped && (
                          <span className="shrink-0 text-[10px] font-medium text-zinc-400">
                            skipped
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {/* Right: the robot that eats the picked replies and learns */}
                <div className="relative flex w-20 shrink-0 flex-col items-center justify-end self-stretch pb-1">
                  {phase === "thinking" && (
                    <div className="iw-fade-up absolute -top-1 right-0 rounded-2xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm">
                      Learning{".".repeat(dots)}
                      <span className="absolute -bottom-1.5 left-3 h-3 w-3 rotate-45 border-b border-r border-zinc-200 bg-white" />
                    </div>
                  )}
                  <span
                    ref={robotRef}
                    aria-hidden
                    className={`text-4xl ${phase === "thinking" ? "iw-pulse-dot" : ""}`}
                  >
                    🤖
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* The morning brief lands after the drafts are done */}
        {phase === "brief" && (
          <div className="border-t border-zinc-100 px-4 py-4 sm:px-5 iw-fade-up">
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-zinc-900">☕ Your morning brief</p>
                <span className="text-xs text-zinc-400">Daily · 8:00</span>
              </div>
              <ul className="mt-2.5 min-h-[96px] space-y-1.5">
                {BRIEF_LINES.slice(0, briefLines).map((line) => (
                  <li key={line.text} className="iw-fade-up flex items-center gap-2 text-[13px] text-zinc-700">
                    <span aria-hidden>{line.icon}</span>
                    {line.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Ask your inbox: the user asks in plain English, the AI answers from triaged mail */}
        {showChat && (
          <div className="border-t border-zinc-100 px-4 py-4 sm:px-5 iw-fade-up">
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">
                💬 Ask your inbox
              </p>
              <div className="mt-3 min-h-[150px] space-y-2.5">
                {/* User question, typed live */}
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-md bg-zinc-900 px-3.5 py-2 text-[13px] text-white">
                    {chatTyped}
                    {phase === "chat" && (
                      <span className="iw-caret ml-0.5 inline-block h-3.5 w-[2px] translate-y-[2px] bg-white align-middle" />
                    )}
                  </p>
                </div>

                {phase === "chatThinking" && (
                  <div className="flex justify-start">
                    <p className="iw-fade-up flex items-center gap-2 rounded-2xl rounded-bl-md bg-white px-3.5 py-2 text-[13px] text-zinc-400 ring-1 ring-zinc-200/70">
                      <span className="iw-pulse-dot inline-block h-2 w-2 rounded-full bg-violet-500" />
                      Checking your mail…
                    </p>
                  </div>
                )}

                {phase === "chatAnswer" && (
                  <div className="flex justify-start">
                    <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-white px-3.5 py-2.5 text-[13px] text-zinc-700 ring-1 ring-zinc-200/70">
                      {CHAT_ANSWER.slice(0, chatLines).map((line, i) => {
                        if (line.kind === "intro") {
                          return (
                            <p key={i} className="iw-fade-up">
                              {line.text}
                            </p>
                          );
                        }
                        if (line.kind === "header") {
                          return (
                            <p key={i} className="iw-fade-up mt-2 text-xs font-semibold text-zinc-900">
                              {line.text}
                            </p>
                          );
                        }
                        return (
                          <p key={i} className="iw-fade-up mt-1 flex items-baseline gap-1.5">
                            <span className="h-1 w-1 shrink-0 translate-y-[-2px] rounded-full bg-zinc-400" />
                            <span>
                              <strong className="font-semibold text-zinc-900">{line.sender}</strong>{" "}
                              — {line.text}
                            </span>
                          </p>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GmailMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#EA4335" d="M2 6.5V18a2 2 0 0 0 2 2h2V9.2L12 14l6-4.8V20h2a2 2 0 0 0 2-2V6.5l-10 8-10-8z" />
      <path fill="#4285F4" d="M22 6.5V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v.5l10 8 10-8z" />
      <path fill="#34A853" d="M2 6.5 12 14.5" opacity="0" />
      <path fill="#FBBC05" d="M2 6v.5l4 3.2V4H4a2 2 0 0 0-2 2z" />
      <path fill="#C5221F" d="M22 6v.5l-4 3.2V4h2a2 2 0 0 1 2 2z" />
    </svg>
  );
}
