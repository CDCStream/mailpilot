"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteChatThread, renameChatThread, setChatThreadArchived } from "../actions";

/** One conversation row in the chat history sidebar: open, rename, archive, delete. */
export function ThreadItem({
  id,
  title,
  dateLabel,
  selected,
  archived,
}: {
  id: string;
  title: string;
  dateLabel: string;
  selected: boolean;
  archived: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(title);
  const [confirming, setConfirming] = useState(false);

  const iconBtn =
    "rounded-full p-1.5 text-zinc-300 opacity-0 transition hover:bg-zinc-200 hover:text-zinc-600 group-hover:opacity-100 focus:opacity-100";

  function saveRename() {
    const clean = draft.trim();
    setRenaming(false);
    if (!clean || clean === title) {
      setDraft(title);
      return;
    }
    startTransition(async () => {
      await renameChatThread(id, clean);
    });
  }

  return (
    <div
      className={`group flex items-center gap-0.5 rounded-xl px-3 py-2 ${
        selected ? "bg-teal-50" : "hover:bg-zinc-50"
      } ${pending ? "opacity-50" : ""}`}
    >
      {renaming ? (
        <input
          autoFocus
          value={draft}
          maxLength={80}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveRename();
            if (e.key === "Escape") {
              setDraft(title);
              setRenaming(false);
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-teal-300 bg-white px-2 py-1 text-sm outline-none"
        />
      ) : (
        <Link href={`/dashboard/chat?t=${id}`} className="min-w-0 flex-1">
          <p
            className={`truncate text-sm ${
              selected ? "font-medium text-teal-900" : "text-zinc-700"
            }`}
          >
            {title}
          </p>
          <p className="text-[11px] text-zinc-400">{dateLabel}</p>
        </Link>
      )}

      {!renaming && (
        <>
          <button
            type="button"
            aria-label="Rename conversation"
            title="Rename"
            onClick={() => {
              setDraft(title);
              setRenaming(true);
            }}
            className={iconBtn}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label={archived ? "Restore conversation" : "Archive conversation"}
            title={archived ? "Restore" : "Archive"}
            onClick={() =>
              startTransition(async () => {
                await setChatThreadArchived(id, !archived);
              })
            }
            className={iconBtn}
          >
            {archived ? (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9zM12 17v-5m0 0-2.5 2.5M12 12l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3M4 9h16v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9zM9.5 13h5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
          <button
            type="button"
            aria-label="Delete conversation"
            title="Delete"
            onClick={() => setConfirming(true)}
            className={`${iconBtn} hover:text-rose-600`}
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </>
      )}

      {/* Delete needs a second, explicit yes — it can't be undone */}
      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4"
          onClick={() => setConfirming(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-base font-semibold text-zinc-900">Delete this conversation?</h2>
            <p className="mt-2 text-sm text-zinc-500">
              &ldquo;{title}&rdquo; will be permanently deleted. This cannot be undone — archive it
              instead if you might need it later.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  startTransition(async () => {
                    await deleteChatThread(id);
                    if (selected) router.push("/dashboard/chat");
                  });
                }}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700"
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
