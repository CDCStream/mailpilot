import type { Category } from "@/lib/db";

/** Safety valve: a backfill flag older than this is considered stale (failed run). */
const BACKFILL_STALE_MS = 30 * 60 * 1000;

/** True while any account has a historical import running in the background. */
export function isBackfilling(accounts: { backfillStartedAt: Date | null }[]): boolean {
  return accounts.some(
    (a) =>
      a.backfillStartedAt && Date.now() - a.backfillStartedAt.getTime() < BACKFILL_STALE_MS,
  );
}

export const CATEGORY_BADGES: Record<Category, string> = {
  to_respond: "bg-rose-100 text-rose-700",
  fyi: "bg-indigo-100 text-indigo-700",
  newsletter: "bg-amber-100 text-amber-700",
  marketing: "bg-orange-100 text-orange-700",
  notification: "bg-sky-100 text-sky-700",
  cold_email: "bg-zinc-100 text-zinc-500",
};

export const CATEGORY_NAMES: Record<Category, string> = {
  to_respond: "To Respond",
  fyi: "FYI",
  newsletter: "Newsletter",
  marketing: "Marketing",
  notification: "Notification",
  cold_email: "Cold Email",
};

export const CATEGORY_DOTS: Record<Category, string> = {
  to_respond: "bg-rose-500",
  fyi: "bg-indigo-500",
  newsletter: "bg-amber-500",
  marketing: "bg-orange-500",
  notification: "bg-sky-500",
  cold_email: "bg-zinc-400",
};

/** "Jane Doe <jane@x.com>" -> "Jane Doe" (falls back to the address). */
export function displayFrom(fromAddress: string | null): string {
  if (!fromAddress) return "";
  return fromAddress.replace(/<[^>]*>/, "").replaceAll('"', "").trim() || fromAddress;
}

/** Freemail providers where a "brand logo" would be misleading for personal senders. */
const FREEMAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "yandex.com",
  "mail.ru",
  "gmx.com",
  "gmx.de",
  "web.de",
  "hey.com",
]);

/**
 * Root domain used to look up the sender's brand logo
 * ("news.linkedin.com" -> "linkedin.com"); null for personal freemail senders.
 */
export function senderDomain(fromAddress: string | null): string | null {
  const m = /@([a-z0-9.-]+)/i.exec(fromAddress ?? "");
  if (!m) return null;
  const parts = m[1].toLowerCase().replace(/\.+$/, "").split(".");
  if (parts.length < 2) return null;
  const secondLevel = parts[parts.length - 2];
  const root =
    parts.length >= 3 && ["co", "com", "net", "org", "gov", "edu", "ac"].includes(secondLevel)
      ? parts.slice(-3).join(".")
      : parts.slice(-2).join(".");
  return FREEMAIL.has(root) ? null : root;
}
