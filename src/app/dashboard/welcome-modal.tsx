"use client";

import { useEffect, useState } from "react";
import { InboxDemo } from "@/components/inbox-demo";

const STORAGE_KEY = "iw-welcome-seen";

/** One-time welcome dialog on the first dashboard visit, reusing the landing demo. */
export function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Open after a beat so the dashboard paints first (and to satisfy hydration).
    const t = setTimeout(() => {
      try {
        if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
      } catch {
        // Storage unavailable (private mode etc.) — skip the modal rather than loop it.
      }
    }, 400);
    return () => clearTimeout(t);
  }, []);

  function close() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-sm"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to Inbox Wingman"
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Welcome to Inbox Wingman</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Here&apos;s what&apos;s happening in your Gmail from now on — every new email gets
              labeled, noise is archived, and reply-worthy mail gets a draft in your voice.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-5">
          <InboxDemo />
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <p className="text-xs text-zinc-400">
            Nothing sends without your approval — drafts wait in Gmail.
          </p>
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
          >
            Got it — let&apos;s go
          </button>
        </div>
      </div>
    </div>
  );
}
