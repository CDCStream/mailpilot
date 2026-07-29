"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { OnboardingTour } from "./tour";

type Status = {
  hasAccount: boolean;
  labelsReady: boolean;
  voiceReady: boolean;
  done: boolean;
};

type SentSample = {
  id: string;
  to: string;
  subject: string;
  snippet: string;
  date: string;
};

type InboxMode = "focus" | "quiet" | "label_only";
type Persona = "founder" | "agency" | "sales" | "support" | "personal";
type TonePreset = "warm" | "direct" | "formal" | "playful";

const PERSONA_OPTIONS: {
  id: Persona;
  title: string;
  desc: string;
  dot: string;
  defaults: { mode: InboxMode; tone: TonePreset };
}[] = [
  {
    id: "founder",
    title: "Founder / Exec",
    desc: "Investors, team, high-stakes threads",
    dot: "bg-indigo-500",
    defaults: { mode: "focus", tone: "direct" },
  },
  {
    id: "agency",
    title: "Agency / Client work",
    desc: "Clients, projects, invoices",
    dot: "bg-violet-500",
    defaults: { mode: "quiet", tone: "warm" },
  },
  {
    id: "sales",
    title: "Sales",
    desc: "Prospects, follow-ups, outreach",
    dot: "bg-amber-500",
    defaults: { mode: "focus", tone: "direct" },
  },
  {
    id: "support",
    title: "Support / Ops",
    desc: "Requests, tickets, updates",
    dot: "bg-teal-500",
    defaults: { mode: "quiet", tone: "warm" },
  },
  {
    id: "personal",
    title: "Personal",
    desc: "Newsletters, receipts, friends & family",
    dot: "bg-rose-500",
    defaults: { mode: "focus", tone: "warm" },
  },
];

const MODE_OPTIONS: {
  id: InboxMode;
  title: string;
  desc: string;
  chips: string[];
}[] = [
  {
    id: "focus",
    title: "I only want to see what needs my attention",
    desc: "Newsletters, marketing, notifications and cold email are labeled and archived — findable in Gmail's sidebar, out of your inbox.",
    chips: ["To Respond", "FYI"],
  },
  {
    id: "quiet",
    title: "Keep my inbox, hide the junk",
    desc: "Newsletters, marketing and cold email are archived after labeling. Notifications stay in your inbox.",
    chips: ["To Respond", "FYI", "Notification"],
  },
  {
    id: "label_only",
    title: "Just label — don't move anything",
    desc: "Your inbox stays exactly as it is. Wingman only adds labels you can filter by.",
    chips: ["Everything stays"],
  },
];

const TONE_OPTIONS: { id: TonePreset; title: string; desc: string; preview: string }[] = [
  {
    id: "warm",
    title: "Warm",
    desc: "Friendly and considerate",
    preview:
      "Of course — Thursday's no problem at all. I'll move the invite to the same time. If anything else shifts on your side, just let me know!",
  },
  {
    id: "direct",
    title: "Direct",
    desc: "Short and to the point",
    preview:
      "Thursday works, same time. I'll move the invite — anything you want added to the agenda beforehand?",
  },
  {
    id: "formal",
    title: "Formal",
    desc: "Polished and precise",
    preview:
      "Thursday suits us well. I will update the invitation for the same time and share a revised agenda ahead of the call.",
  },
  {
    id: "playful",
    title: "Playful",
    desc: "Light and personable",
    preview:
      "Thursday it is! Invite's moving as we speak. Bring the tough questions — I'll bring the answers (and the agenda).",
  },
];

const TOTAL_STEPS = 4;
const MAX_VOICE_SAMPLES = 10;

type VoicePath = "preset" | "samples";

const VOICE_PATH_OPTIONS: { id: VoicePath; title: string; desc: string; icon: string }[] = [
  {
    id: "preset",
    title: "Pick a ready-made tone",
    desc: "Choose a style and see a live example — fastest way to start.",
    icon: "🎚️",
  },
  {
    id: "samples",
    title: "Learn from my past replies",
    desc: "Hand-pick sent emails that sound like you — the most personal drafts.",
    icon: "🤖",
  },
];

function StepHeader({ current }: { current: number }) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
        Step {current} of {TOTAL_STEPS}
      </p>
      <div className="flex items-center gap-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
          <span
            key={n}
            className={`h-2 rounded-full transition-all duration-300 ${
              n === current ? "w-9 bg-teal-600" : n < current ? "w-2 bg-teal-600" : "w-2 bg-zinc-200"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function TrustPanel() {
  return (
    <aside className="h-fit rounded-3xl border border-zinc-200 bg-zinc-50/60 p-7 text-left">
      <p className="text-base font-semibold text-zinc-900">Your email stays yours</p>
      <ul className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-600">
        {[
          ["Nothing sends without you.", "Wingman only creates drafts — you press send in Gmail."],
          ["Encrypted at rest.", "Gmail tokens are protected with AES-256-GCM."],
          ["Never used for training.", "Neither we nor our AI provider train models on your mail."],
          ["Leave anytime.", "Disconnect or delete your account — access is revoked at Google."],
        ].map(([bold, rest]) => (
          <li key={bold} className="flex gap-2">
            <span className="mt-0.5 text-teal-600">✓</span>
            <span>
              <span className="font-medium text-zinc-800">{bold}</span> {rest}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function OnboardingProgress() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1 persona, 2 inbox mode, 3 voice (tone or samples), 4 setup
  const [persona, setPersona] = useState<Persona | null>(null);
  const [mode, setMode] = useState<InboxMode>("focus");
  const [tone, setTone] = useState<TonePreset>("warm");
  const [voicePath, setVoicePath] = useState<VoicePath | null>(null);
  const [samples, setSamples] = useState<SentSample[] | null>(null);
  const [samplesError, setSamplesError] = useState<"permission" | "generic" | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tourDone, setTourDone] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  async function poll() {
    const res = await fetch("/api/onboarding");
    if (res.ok) {
      const data: Status = await res.json();
      if (cancelledRef.current) return;
      setStatus(data);
      if (data.done) return; // redirect handled below, once the tour is finished too
    }
    if (!cancelledRef.current) setTimeout(poll, 3000);
  }

  // Leave for the dashboard only when setup is done AND the user finished the tour.
  useEffect(() => {
    if (status?.done && tourDone) router.replace("/dashboard");
  }, [status?.done, tourDone, router]);

  function choosePersona(p: Persona) {
    setPersona(p);
    const defaults = PERSONA_OPTIONS.find((o) => o.id === p)!.defaults;
    setMode(defaults.mode);
    setTone(defaults.tone);
  }

  // Load the user's recent sent mail once they pick the "past replies" path.
  useEffect(() => {
    if (step !== 3 || voicePath !== "samples" || samples !== null || samplesError) return;
    let stale = false;
    fetch("/api/voice/samples")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { samples: SentSample[] }) => {
        if (!stale) setSamples(data.samples);
      })
      .catch((status: unknown) => {
        if (!stale) setSamplesError(status === 403 ? "permission" : "generic");
      });
    return () => {
      stale = true;
    };
  }, [step, voicePath, samples, samplesError]);

  function toggleSample(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id)
        ? prev.filter((v) => v !== id)
        : prev.length >= MAX_VOICE_SAMPLES
          ? prev
          : [...prev, id],
    );
  }

  async function start(voiceSampleIds: string[]) {
    setStep(4);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inboxMode: mode, persona, tonePreset: tone, voiceSampleIds }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      if (!cancelledRef.current) setError(body.error ?? "Setup could not start.");
      return;
    }
    poll();
  }

  if (error) {
    return (
      <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  // ---------- Setup phase (step 4): feature tour while the backend works ----------
  if (step === 4) {
    const steps = [
      { label: "Gmail connected", done: status?.hasAccount ?? false },
      { label: "Labels created in Gmail", done: status?.labelsReady ?? false },
      { label: "Writing style learned", done: status?.voiceReady ?? false },
      { label: "Recent inbox triaged", done: status?.done ?? false },
    ];
    const doneCount = steps.filter((s) => s.done).length;

    if (!tourDone) {
      return (
        <div className="mx-auto mt-10 max-w-2xl">
          <StepHeader current={4} />
          <OnboardingTour onFinished={() => setTourDone(true)} />
          <p className="mt-5 flex items-center justify-center gap-2 text-sm text-zinc-400">
            <span className="iw-pulse-dot inline-block h-1.5 w-1.5 rounded-full bg-teal-500" />
            Setting up in the background · {doneCount}/{steps.length} done
          </p>
        </div>
      );
    }

    return (
      <div className="mx-auto mt-10 max-w-2xl">
        <StepHeader current={4} />
        <p className="text-base text-zinc-600">
          Almost there — creating your Gmail labels, learning your writing style from sent mail,
          and triaging your most recent emails.
        </p>
        <ul className="mt-10 space-y-5 text-left">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-4 text-base">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  s.done ? "bg-emerald-100 text-emerald-700" : "bg-zinc-50"
                }`}
              >
                {s.done ? (
                  "✓"
                ) : (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-teal-600" />
                )}
              </span>
              <span className={s.done ? "text-zinc-900" : "text-zinc-500"}>{s.label}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  // ---------- Choice phases (steps 1–3) with the trust panel alongside ----------
  const selectedTone = TONE_OPTIONS.find((t) => t.id === tone)!;

  return (
    <div className="mt-10 grid gap-8 text-left lg:grid-cols-[minmax(0,1fr)_360px]">
      <div>
        <StepHeader current={step} />

        {step === 1 && (
          <>
            <h2 className="text-2xl font-semibold">What best describes you?</h2>
            <p className="mt-2 text-base text-zinc-600">
              We&apos;ll tune the triage and drafting defaults to fit — you can change everything
              later.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {PERSONA_OPTIONS.map((opt) => {
                const selected = persona === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => choosePersona(opt.id)}
                    aria-pressed={selected}
                    className={`rounded-2xl border p-6 text-left transition ${
                      opt.id === "personal" ? "sm:col-span-2" : ""
                    } ${
                      selected
                        ? "border-zinc-900 ring-1 ring-zinc-900"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={`h-3 w-3 rounded-full ${opt.dot}`} />
                      <span className="text-base font-semibold text-zinc-900">{opt.title}</span>
                    </span>
                    <span className="mt-1.5 block text-sm text-zinc-500">{opt.desc}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm text-zinc-400 underline-offset-2 hover:underline"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!persona}
                className="rounded-full bg-zinc-900 px-10 py-3.5 text-base font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Continue →
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-2xl font-semibold">Choose what stays in your inbox</h2>
            <p className="mt-2 text-base text-zinc-600">
              Every email gets a Wingman label in Gmail. You decide which ones also leave your
              inbox.
            </p>
            <div className="mt-8 space-y-4">
              {MODE_OPTIONS.map((opt) => {
                const selected = mode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMode(opt.id)}
                    aria-pressed={selected}
                    className={`w-full rounded-2xl border p-6 text-left transition ${
                      selected
                        ? "border-zinc-900 ring-1 ring-zinc-900"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    <p className="text-base font-semibold text-zinc-900">{opt.title}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{opt.desc}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {opt.chips.map((c) => (
                        <span
                          key={c}
                          className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-sm text-zinc-500 hover:text-zinc-700"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-full bg-zinc-900 px-10 py-3.5 text-base font-semibold text-white hover:bg-zinc-800"
              >
                Continue →
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-2xl font-semibold">How should Wingman find your voice?</h2>
            <p className="mt-2 text-base text-zinc-600">
              Drafts are written in your voice — you approve every word. Pick how Wingman should
              learn it.
            </p>

            {/* Two paths: ready-made tone vs. learning from the user's own sent replies */}
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {VOICE_PATH_OPTIONS.map((opt) => {
                const selected = voicePath === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setVoicePath(opt.id)}
                    aria-pressed={selected}
                    className={`rounded-2xl border p-6 text-left transition ${
                      selected
                        ? "border-zinc-900 ring-1 ring-zinc-900"
                        : "border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span aria-hidden className="text-lg">
                        {opt.icon}
                      </span>
                      <span className="text-base font-semibold text-zinc-900">{opt.title}</span>
                    </span>
                    <span className="mt-1.5 block text-sm text-zinc-500">{opt.desc}</span>
                  </button>
                );
              })}
            </div>

            {voicePath === "preset" && (
              <div className="iw-fade-up">
                <div className="mt-6 grid grid-cols-2 gap-4">
                  {TONE_OPTIONS.map((opt) => {
                    const selected = tone === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setTone(opt.id)}
                        aria-pressed={selected}
                        className={`rounded-2xl border p-5 text-left transition ${
                          selected
                            ? "border-teal-600 bg-teal-50/50 ring-1 ring-teal-600"
                            : "border-zinc-200 hover:border-zinc-400"
                        }`}
                      >
                        <p className="text-base font-semibold text-zinc-900">{opt.title}</p>
                        <p className="mt-1 text-sm text-zinc-500">{opt.desc}</p>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 rounded-2xl border border-teal-100 bg-teal-50/40 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                    Live preview
                  </p>
                  <div className="mt-3 rounded-xl border border-zinc-200 bg-white p-4">
                    <p className="text-sm font-semibold text-zinc-900">
                      Jordan · re: Proposal timeline
                    </p>
                    <p className="mt-1 text-sm text-zinc-500">
                      &ldquo;Could we push our review call to Thursday? A few things came up on
                      our side.&rdquo;
                    </p>
                  </div>
                  <div className="mt-2.5 rounded-xl border border-zinc-200 bg-white p-4">
                    <p className="flex items-center gap-2 text-xs text-zinc-400">
                      <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                        Draft
                      </span>
                      in your voice
                    </p>
                    <p
                      key={tone}
                      className="iw-fade-up mt-2 text-sm leading-relaxed text-zinc-700"
                    >
                      {selectedTone.preview}
                    </p>
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">
                    Wingman also learns from your sent mail during setup — private to you, never
                    used to train models.
                  </p>
                </div>
              </div>
            )}

            {voicePath === "samples" && (
              <div className="iw-fade-up">
                <p className="mt-6 text-sm text-zinc-600">
                  Pick 3–{MAX_VOICE_SAMPLES} sent emails that sound like you — Wingman copies its
                  drafting style straight from them.
                </p>

                {samplesError === "permission" ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <p className="font-semibold">Gmail permission is missing</p>
                    <p className="mt-1">
                      Your Google connection was made without Gmail access.{" "}
                      <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="font-medium underline"
                      >
                        Sign out
                      </button>{" "}
                      and sign back in — on the Google screen, make sure the checkbox that lets
                      Wingman read and manage your email is ticked.
                    </p>
                  </div>
                ) : samplesError === "generic" ? (
                  <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    Couldn&apos;t load your sent mail right now — pick a ready-made tone instead,
                    and Wingman will still learn your style automatically during setup.
                  </p>
                ) : samples === null ? (
                  <p className="mt-4 flex items-center gap-2 text-sm text-zinc-500">
                    <span className="iw-pulse-dot inline-block h-2 w-2 rounded-full bg-teal-500" />
                    Loading your recent sent mail…
                  </p>
                ) : samples.length === 0 ? (
                  <p className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
                    No suitable sent emails found yet — pick a ready-made tone instead. Wingman
                    keeps learning as you send mail.
                  </p>
                ) : (
                  <div className="mt-4 max-h-[340px] space-y-2 overflow-y-auto pr-1">
                    {samples.map((s) => {
                      const selected = selectedIds.includes(s.id);
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => toggleSample(s.id)}
                          aria-pressed={selected}
                          className={`w-full rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-teal-600 bg-teal-50/50 ring-1 ring-teal-600"
                              : "border-zinc-200 hover:border-zinc-400"
                          }`}
                        >
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-sm font-semibold text-zinc-900">
                              {s.subject}
                            </span>
                            <span className="shrink-0 text-xs text-zinc-400">
                              {new Date(s.date).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-zinc-400">
                            to {s.to}
                          </span>
                          <span className="mt-1 block text-sm leading-relaxed text-zinc-500">
                            {s.snippet.slice(0, 140)}
                            {s.snippet.length > 140 ? "…" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {selectedIds.length > 0 && (
                  <p className="mt-3 text-sm text-teal-700">
                    {selectedIds.length}/{MAX_VOICE_SAMPLES} selected
                    {selectedIds.length < 3 ? " — pick at least 3 for a good profile" : ""}
                  </p>
                )}
              </div>
            )}

            <div className="mt-8 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-sm text-zinc-500 hover:text-zinc-700"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => start(voicePath === "samples" ? selectedIds : [])}
                disabled={
                  voicePath === null || (voicePath === "samples" && selectedIds.length < 3)
                }
                className="rounded-full bg-zinc-900 px-10 py-3.5 text-base font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Start labelling my emails
              </button>
            </div>
            <p className="mt-3 text-right text-xs text-zinc-400">
              You can change all of this anytime in Settings.
            </p>
          </>
        )}
      </div>

      <TrustPanel />
    </div>
  );
}
