"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-full bg-white text-zinc-900 antialiased">
        <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
          <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Error</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Something broke</h1>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600">
            We logged it. Try again, or go back to the inbox.
          </p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
            >
              Try again
            </button>
            <a
              href="/dashboard"
              className="rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
            >
              Dashboard
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
