"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function WriteDraftButton({
  messageId,
  children,
  pendingLabel = "Writing…",
  className,
}: {
  messageId: string;
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    try {
      const start = await fetch("/api/draft/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (!start.ok) throw new Error("start failed");
      let lastReason: string | null = null;
      for (let i = 0; i < 8; i += 1) {
        const tick = await fetch("/api/draft/tick", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId }),
        });
        const data = (await tick.json().catch(() => null)) as {
          status?: string;
          messageId?: string;
          draftId?: string;
          reason?: string;
        } | null;
        if (data?.draftId) break;
        if (data?.status === "skipped" || data?.status === "error") {
          lastReason = data.reason ?? data.status ?? "skipped";
          break;
        }
        if (data?.status === "idle") break;
      }
      if (lastReason === "no-credits") setError("Not enough credits for a draft (3).");
      else if (lastReason === "no-content") setError("Nothing to draft from — no summary yet.");
      else if (lastReason && lastReason !== "idle") setError("Couldn’t write this draft. Try again.");
    } catch {
      setError("Couldn’t start the draft. Try again.");
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={() => void onClick()} disabled={busy} className={className}>
        {busy ? pendingLabel : children}
      </button>
      {error ? <span className="max-w-xs text-right text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
