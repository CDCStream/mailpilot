"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function Tracker() {
  const pathname = usePathname();
  const search = useSearchParams();

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
