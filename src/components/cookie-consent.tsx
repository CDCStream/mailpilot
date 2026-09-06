"use client";

import { useEffect, useState } from "react";
import { AHREFS_KEY, loadAhrefs } from "@/lib/ahrefs";
import { applyConsent, googleTagsEnabled, readConsent } from "@/lib/gtag";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!googleTagsEnabled() && !AHREFS_KEY) return;
    setVisible(readConsent() === null);
  }, []);

  if (!visible) return null;

  function choose(choice: "granted" | "denied") {
    applyConsent(choice);
    if (choice === "granted") loadAhrefs();
    setVisible(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-zinc-200 bg-white/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-600">
          We use Google Analytics, Ads, and Ahrefs (Consent Mode) to measure visits and
          sign-ups. Gmail content is never sent.{" "}
          <a href="/privacy" className="underline">
            Privacy
          </a>
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => choose("denied")}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => choose("granted")}
            className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
