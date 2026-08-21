"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AddRuleForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    const instruction = String(new FormData(event.currentTarget).get("instruction") ?? "").trim();
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || data?.ok === false) {
        setError(data?.error ?? "Could not add that rule.");
      } else {
        event.currentTarget.reset();
      }
    } catch {
      setError("Could not add that rule.");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="mt-10 flex flex-wrap items-center gap-3">
      <input
        name="instruction"
        required
        maxLength={300}
        placeholder='e.g. "Archive all receipts", "Never draft replies to newsletters from acme.com"'
        className="flex-1 rounded-full border border-zinc-300 px-5 py-2.5 text-sm outline-none focus:border-teal-600"
      />
      <button
        type="submit"
        disabled={busy}
        className="shrink-0 rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-70"
      >
        {busy ? "Adding rule…" : "Add rule"}
      </button>
      {error && <p className="w-full text-xs text-rose-700">{error}</p>}
    </form>
  );
}
