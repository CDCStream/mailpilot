"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { Category } from "@/lib/db";
import { CATEGORY_BADGES, CATEGORY_DOTS, CATEGORY_NAMES } from "../categories";
import { SenderAvatar } from "../sender-avatar";

export type InboxListRow = {
  id: string;
  href: string;
  from: string;
  subject: string;
  snippet: string | null;
  dateLabel: string;
  category: Category | null;
  draft: boolean;
  archived: boolean;
  domain: string | null;
  initial: string;
};

function highlight(text: string, term: string): ReactNode {
  if (!term) return text;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.split(new RegExp(`(${escaped})`, "gi")).map((part, i) =>
    part.toLowerCase() === term.toLowerCase() ? (
      <mark key={i} className="rounded-sm bg-yellow-200 px-0.5 text-inherit">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

export function InboxVirtualList({
  rows,
  selectedId,
  fromFilter,
  q,
  moreHref,
  moreLabel,
}: {
  rows: InboxListRow[];
  selectedId: string | null;
  fromFilter: string;
  q: string;
  moreHref?: string;
  moreLabel?: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);
  const extra = moreHref ? 1 : 0;
  const virtualizer = useVirtualizer({
    count: rows.length + extra,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 8,
  });

  return (
    <div ref={parentRef} className="min-h-0 flex-1 overflow-y-auto">
      <div
        className="relative w-full"
        style={{ height: `${virtualizer.getTotalSize()}px` }}
      >
        {virtualizer.getVirtualItems().map((item) => {
          if (item.index >= rows.length) {
            return (
              <div
                key="more"
                className="absolute left-0 top-0 w-full"
                style={{ transform: `translateY(${item.start}px)` }}
              >
                <Link
                  href={moreHref!}
                  scroll={false}
                  className="block px-4 py-3 text-center text-xs font-medium text-teal-700 hover:bg-teal-50/60"
                >
                  {moreLabel}
                </Link>
              </div>
            );
          }
          const m = rows[item.index];
          const isSelected = m.id === selectedId;
          return (
            <div
              key={m.id}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className="absolute left-0 top-0 w-full border-b border-zinc-50"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <Link
                href={m.href}
                scroll={false}
                className={`flex gap-3 border-l-[3px] px-4 py-3 transition ${
                  isSelected
                    ? "border-teal-600 bg-teal-50/60"
                    : "border-transparent hover:bg-zinc-50"
                }`}
              >
                <span className="mt-0.5">
                  <SenderAvatar
                    domain={m.domain}
                    initial={m.initial}
                    colorClass={m.category ? CATEGORY_DOTS[m.category] : "bg-zinc-300"}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-zinc-900">
                      {highlight(m.from, fromFilter)}
                    </span>
                    <span className="shrink-0 text-[11px] text-zinc-400">{m.dateLabel}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-zinc-600">
                    {highlight(m.subject, q)}
                  </span>
                  {q && m.snippet && (
                    <span className="mt-0.5 line-clamp-2 block text-xs text-zinc-500">
                      {highlight(m.snippet, q)}
                    </span>
                  )}
                  <span className="mt-1.5 flex items-center gap-1.5">
                    {m.category ? (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${CATEGORY_BADGES[m.category]}`}
                      >
                        {CATEGORY_NAMES[m.category]}
                      </span>
                    ) : (
                      <span className="rounded-md bg-zinc-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                        processing
                      </span>
                    )}
                    {m.draft && (
                      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                        draft
                      </span>
                    )}
                    {m.archived && (
                      <span className="text-[10px] uppercase tracking-wide text-zinc-400">
                        archived
                      </span>
                    )}
                  </span>
                </span>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
