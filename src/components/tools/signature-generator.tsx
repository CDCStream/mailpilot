"use client";

import { useMemo, useState } from "react";

/** Free email signature generator. Everything stays in the browser. */

type Fields = {
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
};

const EMPTY: Fields = {
  name: "",
  title: "",
  company: "",
  email: "",
  phone: "",
  website: "",
};

function asPlain(f: Fields): string {
  const lines = [
    f.name.trim(),
    [f.title.trim(), f.company.trim()].filter(Boolean).join(" · "),
    f.email.trim(),
    f.phone.trim(),
    f.website.trim(),
  ].filter(Boolean);
  return lines.join("\n");
}

export function SignatureGenerator() {
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [copied, setCopied] = useState(false);
  const preview = useMemo(() => asPlain(fields), [fields]);

  function set<K extends keyof Fields>(key: K, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }

  async function copy() {
    if (!preview) return;
    await navigator.clipboard.writeText(preview);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const inputs: { key: keyof Fields; label: string; placeholder: string; type?: string }[] = [
    { key: "name", label: "Name", placeholder: "Alex Rivera" },
    { key: "title", label: "Title", placeholder: "Founder" },
    { key: "company", label: "Company", placeholder: "Rivera Studio" },
    { key: "email", label: "Email", placeholder: "alex@studio.com", type: "email" },
    { key: "phone", label: "Phone", placeholder: "+1 415 555 0142", type: "tel" },
    { key: "website", label: "Website", placeholder: "https://studio.com" },
  ];

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-3">
          {inputs.map((input) => (
            <label key={input.key} className="block text-sm font-medium text-zinc-900">
              {input.label}
              <input
                type={input.type ?? "text"}
                value={fields[input.key]}
                onChange={(e) => set(input.key, e.target.value)}
                placeholder={input.placeholder}
                autoComplete="off"
                className="mt-1 w-full rounded-xl border border-zinc-300 px-3 py-2 text-sm font-normal focus:border-teal-600 focus:outline-none"
              />
            </label>
          ))}
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-900">Gmail-ready preview</p>
          <div className="mt-1 min-h-40 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-800 whitespace-pre-wrap">
            {preview || "Fill the fields — a plain-text signature appears here."}
          </div>
          <button
            type="button"
            onClick={copy}
            disabled={!preview}
            className="mt-3 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {copied ? "Copied" : "Copy signature"}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            In Gmail: Settings → See all settings → General → Signature. Paste, then save.
            Runs in your browser — nothing is sent or stored.
          </p>
        </div>
      </div>
    </div>
  );
}
