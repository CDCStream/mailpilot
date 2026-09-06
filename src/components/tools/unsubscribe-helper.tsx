"use client";

import { useMemo, useState } from "react";

type Action = "unsubscribe" | "filter" | "keep";

const NOISE = [
  "noreply",
  "no-reply",
  "newsletter",
  "news@",
  "updates@",
  "marketing@",
  "promo",
  "notifications@",
  "digest@",
];

function suggest(line: string): Action {
  const lower = line.toLowerCase();
  if (NOISE.some((n) => lower.includes(n))) return "unsubscribe";
  if (lower.includes("invoice") || lower.includes("billing") || lower.includes("receipt")) {
    return "filter";
  }
  return "keep";
}

function label(action: Action): string {
  if (action === "unsubscribe") return "Unsubscribe in Gmail";
  if (action === "filter") return "Filter (keep, skip inbox)";
  return "Keep";
}

export function UnsubscribeHelper() {
  const [raw, setRaw] = useState("");
  const [copied, setCopied] = useState(false);

  const rows = useMemo(() => {
    return raw
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 40)
      .map((line) => ({ line, action: suggest(line) }));
  }, [raw]);

  const filterQuery = useMemo(() => {
    const domains = rows
      .filter((r) => r.action !== "keep")
      .map((r) => {
        const email = r.line.match(/[\w.+-]+@([\w.-]+)/);
        return email ? `from:${email[1]}` : `from:${r.line.replace(/\s+/g, "")}`;
      });
    return [...new Set(domains)].slice(0, 12).join(" OR ");
  }, [rows]);

  async function copyQuery() {
    if (!filterQuery) return;
    await navigator.clipboard.writeText(filterQuery);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <label htmlFor="senders" className="text-sm font-medium text-zinc-900">
        Senders to review (one per line)
      </label>
      <textarea
        id="senders"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={"news@vendor.com\nbilling@stripe.com\nAlex at Acme <alex@acme.com>"}
        rows={7}
        className="mt-2 w-full rounded-xl border border-zinc-300 px-4 py-3 text-sm focus:border-teal-600 focus:outline-none"
      />
      <p className="mt-2 text-xs text-zinc-500">
        Suggestions only — this tool never opens Gmail or unsubscribes for you.
      </p>

      {rows.length > 0 && (
        <ul className="mt-5 space-y-2">
          {rows.map((r) => (
            <li
              key={r.line}
              className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-sm"
            >
              <span className="break-all text-zinc-800">{r.line}</span>
              <span
                className={
                  r.action === "unsubscribe"
                    ? "shrink-0 text-amber-700"
                    : r.action === "filter"
                      ? "shrink-0 text-teal-700"
                      : "shrink-0 text-zinc-500"
                }
              >
                {label(r.action)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {filterQuery && (
        <div className="mt-5 rounded-xl bg-zinc-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Gmail search / filter
          </p>
          <p className="mt-2 break-all font-mono text-xs text-zinc-800">{filterQuery}</p>
          <button
            type="button"
            onClick={copyQuery}
            className="mt-3 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
          >
            {copied ? "Copied" : "Copy Gmail query"}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            Paste into Gmail search. For a sender with an Unsubscribe link, open the
            message and use Gmail&apos;s unsubscribe — don&apos;t reply &quot;stop&quot;.
          </p>
        </div>
      )}
    </div>
  );
}
