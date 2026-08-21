"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Drains eligible To Respond drafts in the background, same pattern as re-triage. */
export function DraftTicker({ pending }: { pending: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!pending) return;
    let stopped = false;
    let inFlight = false;

    const tick = async () => {
      if (inFlight || stopped) return;
      inFlight = true;
      try {
        const res = await fetch("/api/draft/tick", { method: "POST" });
        const data = (await res.json().catch(() => null)) as { status?: string } | null;
        if (data?.status === "idle") stopped = true;
      } catch {
        // Next interval retries.
      } finally {
        inFlight = false;
        if (!stopped) router.refresh();
      }
    };

    void tick();
    const t = setInterval(tick, 5000);
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [pending, router]);

  return null;
}
