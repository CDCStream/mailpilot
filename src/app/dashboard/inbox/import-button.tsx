"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importOlderInbox } from "../actions";

/** How long we keep polling for freshly imported emails after a click. */
const WATCH_MS = 3 * 60 * 1000;
const POLL_MS = 8 * 1000;

export function ImportOlderButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [importing, setImporting] = useState(false);
  const stopAt = useRef(0);

  useEffect(() => {
    if (!importing) return;
    const timer = setInterval(() => {
      if (Date.now() > stopAt.current) {
        setImporting(false);
        return;
      }
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [importing, router]);

  const onClick = () => {
    startTransition(async () => {
      await importOlderInbox();
      stopAt.current = Date.now() + WATCH_MS;
      setImporting(true);
    });
  };

  if (importing) {
    return (
      <span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-medium text-teal-700">
        <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-teal-600 border-t-transparent" />
        Importing in the background — emails appear as they&apos;re processed
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-600 hover:border-teal-500 hover:text-teal-700 disabled:opacity-60"
    >
      {isPending ? (
        <span className="h-3 w-3 animate-spin rounded-full border-[2px] border-zinc-400 border-t-transparent" />
      ) : (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14m0 0-5-5m5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {isPending ? "Starting import…" : "Import 5 more days"}
    </button>
  );
}
