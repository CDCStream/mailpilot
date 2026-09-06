"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { readConsent, sendPageView } from "@/lib/gtag";

function Tracker() {
  const pathname = usePathname();
  const search = useSearchParams();
  const gaInitialDone = useRef(false);

  useEffect(() => {
    if (!pathname || pathname.startsWith("/api")) return;
    const path = search.toString() ? `${pathname}?${search}` : pathname;
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event: "page_view",
        path,
        referrer: document.referrer || null,
      }),
      keepalive: true,
    }).catch(() => {});

    const consented = readConsent() === "granted";
    if (!consented) return;
    // First load is also sent by gtag config when consent was already granted.
    if (!gaInitialDone.current) {
      gaInitialDone.current = true;
      sendPageView(pathname);
      return;
    }
    sendPageView(pathname);
  }, [pathname, search]);

  return null;
}

export function PageViewTracker() {
  return (
    <Suspense fallback={null}>
      <Tracker />
    </Suspense>
  );
}
