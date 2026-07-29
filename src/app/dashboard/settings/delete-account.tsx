"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { deleteAccount } from "../actions";

const DELETED = [
  "Your subscription — canceled immediately, no further charges",
  "Wingman's Gmail access — revoked at Google for every connected account",
  "Profile, encrypted Gmail tokens and voice profile",
  "Triaged message metadata and AI summaries",
  "Rules, AI chat history, saved briefs and credit records",
];

const KEPT = [
  "Your Gmail mailbox and every email in it — Wingman never touches the mail itself",
  "Wingman labels already applied in Gmail (remove them in Gmail if you like)",
];

function ConfirmDeleteButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
      )}
      {pending ? "Deleting your account…" : "Permanently delete my account"}
    </button>
  );
}

/** Danger-zone card + two-step confirmation modal (review → type your email). */
export function DeleteAccountSection({
  email,
  accountEmails,
}: {
  email: string;
  accountEmails: string[];
}) {
  const [step, setStep] = useState<0 | 1 | 2>(0); // 0 closed, 1 review, 2 confirm
  const [typed, setTyped] = useState("");
  const emailMatches = typed.trim().toLowerCase() === email.toLowerCase();

  function close() {
    setStep(0);
    setTyped("");
  }

  return (
    <section className="rounded-2xl border border-rose-200 bg-rose-50/40 p-6">
      <h2 className="font-semibold text-rose-900">Delete account</h2>
      <p className="mt-2 text-sm text-rose-800/80">
        Permanently removes your Wingman account and everything we store, cancels your
        subscription, and revokes our Gmail access at Google. Your Gmail itself is untouched.
      </p>
      <button
        type="button"
        onClick={() => setStep(1)}
        className="mt-4 rounded-full border border-rose-300 bg-white px-5 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50"
      >
        Delete my account…
      </button>

      {step > 0 && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/50 p-4 backdrop-blur-sm"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
          >
            {step === 1 ? (
              <>
                <h2 className="text-lg font-semibold text-zinc-900">
                  Review what happens when you delete
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {accountEmails.length > 1
                    ? `This covers all ${accountEmails.length} connected Gmail accounts (${accountEmails.join(", ")}).`
                    : `This covers your connected Gmail account${accountEmails[0] ? ` (${accountEmails[0]})` : ""}.`}
                </p>

                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-rose-700">
                  Deleted immediately
                </p>
                <ul className="mt-2 space-y-1.5">
                  {DELETED.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-zinc-700">
                      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Not affected
                </p>
                <ul className="mt-2 space-y-1.5">
                  {KEPT.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-zinc-700">
                      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>

                <p className="mt-5 rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
                  This is permanent and cannot be undone — deleted data is not recoverable,
                  even by support.
                </p>

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                  >
                    Keep my account
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-zinc-900">Final confirmation</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Type your account email to confirm. Deletion starts the moment you click the
                  button below.
                </p>

                <form action={deleteAccount} className="mt-4">
                  <label className="block text-sm">
                    <span className="mb-1 block text-zinc-600">
                      Type <strong className="font-semibold text-zinc-900">{email}</strong> to
                      continue
                    </span>
                    <input
                      type="email"
                      name="confirm"
                      autoFocus
                      autoComplete="off"
                      value={typed}
                      onChange={(e) => setTyped(e.target.value)}
                      placeholder={email}
                      className="w-full rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-rose-500"
                    />
                  </label>
                  <div className="mt-5 flex justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
                    >
                      ← Back
                    </button>
                    <ConfirmDeleteButton disabled={!emailMatches} />
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
