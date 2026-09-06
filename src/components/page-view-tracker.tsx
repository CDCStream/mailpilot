"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { gaEvent } from "@/lib/gtag";

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

    // Path only — query strings can contain a Gmail address (`linked=`).
    if (!gaInitialDone.current) {
      gaInitialDone.current = true;
      return;
    }
    gaEvent("page_view", { page_path: pathname, page_location: `${window.location.origin}${pathname}` });
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
