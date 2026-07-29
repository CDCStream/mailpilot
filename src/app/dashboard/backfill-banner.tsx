"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Shown while a historical import runs in the background. Polls the server so
 * newly triaged emails stream in and the banner disappears when the import ends
 * (the server simply stops rendering it).
 */
export function BackfillBanner() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 7000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
      <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      <p>
        <span className="font-semibold">Importing your last 5 days of email…</span>{" "}
        Wingman is categorizing and summarizing each one — they&apos;ll appear here as
        they&apos;re processed. Feel free to keep exploring.
      </p>
    </div>
  );
}
