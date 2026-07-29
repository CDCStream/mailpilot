"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setActiveAccount } from "./actions";

type AccountItem = {
  id: string;
  email: string;
  status: string;
};

function Avatar({ label, all }: { label: string; all?: boolean }) {
  if (all) {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-600 to-emerald-500 text-white">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-600 to-emerald-500 text-sm font-semibold text-white">
      {label.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Workspace-style inbox switcher at the top of the dashboard sidebar.
 * Scopes Overview / Inbox / Drafts to one Gmail account, or "All inboxes".
 */
export function AccountSwitcher({
  accounts,
  activeId,
  canAdd,
}: {
  accounts: AccountItem[];
  activeId: string | null;
  canAdd: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const active = accounts.find((a) => a.id === activeId) ?? null;

  function choose(id: string | null) {
    setOpen(false);
    startTransition(async () => {
      await setActiveAccount(id);
      router.refresh();
    });
  }

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-zinc-50";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-left shadow-sm transition hover:border-zinc-300 ${
          pending ? "opacity-60" : ""
        }`}
      >
        <Avatar all={!active} label={active?.email ?? ""} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-zinc-900">
            {active ? active.email.split("@")[0] : "All inboxes"}
          </span>
          <span className="block truncate text-[11px] text-zinc-400">
            {active ? active.email : `${accounts.length} account${accounts.length === 1 ? "" : "s"} connected`}
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute inset-x-0 z-40 mt-2 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-lg">
            <button type="button" onClick={() => choose(null)} className={itemClass}>
              <Avatar all label="" />
              <span className="min-w-0 flex-1 truncate font-medium text-zinc-900">
                All inboxes
              </span>
              {!active && (
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>

            <div className="my-1 border-t border-zinc-100" />

            <div className="max-h-56 overflow-y-auto">
              {accounts.map((a) => (
                <button key={a.id} type="button" onClick={() => choose(a.id)} className={itemClass}>
                  <Avatar label={a.email} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-zinc-900">{a.email}</span>
                    {a.status !== "active" && (
                      <span className="mt-0.5 inline-block rounded-full bg-rose-50 px-2 py-px text-[10px] font-semibold text-rose-600">
                        Needs reconnect
                      </span>
                    )}
                  </span>
                  {active?.id === a.id && (
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-teal-600" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              ))}
            </div>

            <div className="my-1 border-t border-zinc-100" />

            {canAdd ? (
              <a href="/api/gmail/link" className={`${itemClass} font-medium text-teal-700`}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-teal-300 text-teal-600">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                  </svg>
                </span>
                Connect another Gmail
              </a>
            ) : (
              <Link href="/dashboard/billing" className={`${itemClass} text-zinc-500`} onClick={() => setOpen(false)}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-zinc-400">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                  </svg>
                </span>
                Upgrade for more inboxes
              </Link>
            )}

            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2.5 py-2 text-xs font-medium text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-600"
            >
              Manage accounts →
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
