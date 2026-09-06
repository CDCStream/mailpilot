"use client";

/** Public IDs only — leave unset and nothing loads. */
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-83RT884KSZ";
export const ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID || "AW-15728739136";
export const ADS_SUBSCRIBE_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_SUBSCRIBE_LABEL || "";
export const ADS_SIGNUP_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL || "";

export const CONSENT_KEY = "iw_consent";
const SIGNUP_FIRED_KEY = "iw_ads_signup_fired";
const PURCHASE_FIRED_KEY = "iw_ads_purchase_fired";
const CHECKOUT_KEY = "iw_checkout";

export type ConsentChoice = "granted" | "denied";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export function googleTagsEnabled(): boolean {
  return Boolean(GA_ID || ADS_ID);
}

export function readConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(CONSENT_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function applyConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(CONSENT_KEY, choice);
  } catch {
    /* private mode */
  }
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("consent", "update", {
    analytics_storage: choice,
    ad_storage: choice,
    ad_user_data: choice,
    ad_personalization: choice,
  });
  if (choice === "granted") sendPageView();
}

/** Path only — never send query strings (they can include a Gmail address). */
export function sendPageView(pathname?: string): void {
  if (typeof window === "undefined" || !window.gtag) return;
  const path = pathname || window.location.pathname;
  window.gtag("event", "page_view", {
    page_path: path,
    page_title: document.title,
    page_location: `${window.location.origin}${path}`,
  });
}

/** GA4 event. Never send emails, message content, or Gmail payloads. */
export function gaEvent(action: string, params: Record<string, unknown> = {}): void {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", action, params);
}

export function adsConversion(opts: {
  label?: string;
  value?: number;
  currency?: string;
  transactionId?: string;
} = {}): void {
  if (typeof window === "undefined" || !window.gtag) return;
  const label = opts.label || ADS_SUBSCRIBE_LABEL;
  if (!ADS_ID || !label) return;
  window.gtag("event", "conversion", {
    send_to: `${ADS_ID}/${label}`,
    value: opts.value,
    currency: opts.currency || "USD",
    transaction_id: opts.transactionId,
  });
}

export function rememberCheckout(payload: { type: string; value?: number }): void {
  try {
    sessionStorage.setItem(CHECKOUT_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

function consumeCheckout(): { type: string; value?: number } | null {
  try {
    const raw = sessionStorage.getItem(CHECKOUT_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(CHECKOUT_KEY);
    return JSON.parse(raw) as { type: string; value?: number };
  } catch {
    return null;
  }
}

export function beginCheckout(payload: { type: string; value?: number }): void {
  rememberCheckout(payload);
  gaEvent("begin_checkout", {
    currency: "USD",
    value: payload.value,
    item_name: payload.type,
  });
}

export function trackSignUp(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(SIGNUP_FIRED_KEY) === "1") return;
  } catch {
    /* private mode */
  }
  gaEvent("sign_up", { method: "google" });
  adsConversion({ label: ADS_SIGNUP_LABEL });
  try {
    localStorage.setItem(SIGNUP_FIRED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function trackPurchase(opts?: { value?: number; transactionId?: string }): void {
  if (typeof window === "undefined") return;
  const pending = consumeCheckout();
  const value = opts?.value ?? pending?.value;
  const key = `${PURCHASE_FIRED_KEY}:${opts?.transactionId ?? pending?.type ?? "ok"}`;
  try {
    if (sessionStorage.getItem(key) === "1") return;
  } catch {
    /* private mode */
  }
  gaEvent("purchase", {
    currency: "USD",
    value,
    item_name: pending?.type ?? "subscribe",
  });
  adsConversion({
    label: ADS_SUBSCRIBE_LABEL,
    value,
    transactionId: opts?.transactionId,
  });
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    /* ignore */
  }
}
