"use client";

import { useState } from "react";

/**
 * Sender avatar: brand favicon when the domain has one, otherwise a colored
 * initial. Google's favicon service returns a tiny 16px globe for unknown
 * domains — we detect that on load and fall back to the initial.
 */
export function SenderAvatar({
  domain,
  initial,
  colorClass,
  size = 36,
}: {
  domain: string | null;
  initial: string;
  colorClass: string;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showLogo = Boolean(domain) && !failed;

  return (
    <span
      style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold ${
        showLogo ? "bg-white ring-1 ring-zinc-200" : `text-white ${colorClass}`
      }`}
    >
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny remote favicons; next/image needs remote-domain config
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
          alt=""
          width={size - 12}
          height={size - 12}
          className="rounded"
          onError={() => setFailed(true)}
          onLoad={(e) => {
            // The service's "not found" fallback is a 16px globe.
            if (e.currentTarget.naturalWidth <= 16) setFailed(true);
          }}
        />
      ) : (
        initial
      )}
    </span>
  );
}
