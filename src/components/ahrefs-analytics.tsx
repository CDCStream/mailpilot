"use client";

import { useEffect } from "react";
import { loadAhrefs } from "@/lib/ahrefs";
import { readConsent } from "@/lib/gtag";

export function AhrefsAnalytics() {
  useEffect(() => {
    if (readConsent() === "granted") loadAhrefs();
  }, []);
  return null;
}
