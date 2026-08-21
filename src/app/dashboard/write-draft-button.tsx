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

  async function onClick() {
    setBusy(true);
    try {
      const start = await fetch("/api/draft/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      if (!start.ok) throw new Error("start failed");
      for (let i = 0; i < 8; i += 1) {
        const tick = await fetch("/api/draft/tick", { method: "POST" });
        const data = (await tick.json().catch(() => null)) as {
          status?: string;
          messageId?: string;
          draftId?: string;
        } | null;
        if (data?.draftId && data.messageId === messageId) break;
        if (data?.status === "skipped" && data.messageId === messageId) break;
        if (data?.status === "idle") break;
      }
    } catch {
      // Tick / cron still drain a queued request.
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={() => void onClick()} disabled={busy} className={className}>
      {busy ? pendingLabel : children}
    </button>
  );
}
