"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Status = {
  hasAccount: boolean;
  labelsReady: boolean;
  voiceReady: boolean;
  done: boolean;
};

export function OnboardingProgress() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      const res = await fetch("/api/onboarding", { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (!cancelled) setError(body.error ?? "Setup could not start.");
        return;
      }
      poll();
    }

    async function poll() {
      const res = await fetch("/api/onboarding");
      if (res.ok) {
        const data: Status = await res.json();
        if (cancelled) return;
        setStatus(data);
        if (data.done) {
          router.replace("/dashboard");
          return;
        }
      }
      if (!cancelled) setTimeout(poll, 3000);
    }

    start();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  const steps = [
    { label: "Gmail connected", done: status?.hasAccount ?? false },
    { label: "Labels created in Gmail", done: status?.labelsReady ?? false },
    { label: "Writing style learned", done: status?.voiceReady ?? false },
    { label: "Recent inbox triaged", done: status?.done ?? false },
  ];

  return (
    <ul className="mt-10 space-y-4 text-left">
      {steps.map((s) => (
        <li key={s.label} className="flex items-center gap-3 text-sm">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              s.done ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-400"
            }`}
          >
            {s.done ? "✓" : "·"}
          </span>
          <span className={s.done ? "text-zinc-900" : "text-zinc-500"}>{s.label}</span>
          {!s.done && <span className="ml-auto animate-pulse text-zinc-300">…</span>}
        </li>
      ))}
    </ul>
  );
}
