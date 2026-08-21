"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RetrainButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const res = await fetch("/api/voice/retrain", { method: "POST" });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; retrained?: number } | null;
      if (data?.ok) {
        router.push(`/dashboard/training?retrained=${data.retrained ?? 0}`);
        router.refresh();
        return;
      }
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? "Re-learning from your sent mail… (~30s)" : "Re-learn from recent sent mail"}
    </button>
  );
}
