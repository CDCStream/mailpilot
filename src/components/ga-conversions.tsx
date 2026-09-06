"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { trackPurchase, trackSignUp } from "@/lib/gtag";

function Conversions() {
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const signup = search.get("signup");
  const status = search.get("status");
  const topup = search.get("topup");
  const credits = search.get("credits");

  useEffect(() => {
    if (signup === "1") {
      trackSignUp();
      const next = new URLSearchParams(search.toString());
      next.delete("signup");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      return;
    }
    if (status === "success" || topup === "success") {
      trackPurchase({
        transactionId: status === "success" ? "plan" : `topup:${credits ?? "ok"}`,
      });
    }
  }, [signup, status, topup, credits, pathname, router, search]);

  return null;
}

export function GaConversions() {
  return (
    <Suspense fallback={null}>
      <Conversions />
    </Suspense>
  );
}

export function SignupBeacon({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (enabled) trackSignUp();
  }, [enabled]);
  return null;
}
