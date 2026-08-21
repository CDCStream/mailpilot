import type { Category } from "@/lib/db/schema";

/** Round-11 labelled Security negatives — policy / promo / vendor-compliance, never an account event. */
export const SECURITY_NEGATIVES: {
  from: string;
  email: string;
  subject: string;
  expect: Exclude<Category, "security">;
}[] = [
  {
    from: "Udemy <no-reply@e.udemymail.com>",
    email: "no-reply@e.udemymail.com",
    subject: "Fuat, still interested in Search Engine Optimization (SEO) prep?",
    expect: "marketing",
  },
  {
    from: "Netflix <info@mailer.netflix.com>",
    email: "info@mailer.netflix.com",
    subject: "Important: How to update your Netflix Household",
    expect: "notification",
  },
  {
    from: "Fyxer Privacy <privacy@fyxer.com>",
    email: "privacy@fyxer.com",
    subject: "An update on Fyxer's sub-processors",
    expect: "notification",
  },
];

const SUBPROCESS_RE = /sub\s*[-–—]?\s*process/i;
const HOUSEHOLD_RE = /household/i;
const UDEMY_PROMO_RE = /still interested|seo prep|search engine optimization/i;
const ACCOUNT_EVENT_RE =
  /data breach|breach affecting|sign-in|login from|verification code|two-factor|2fa|mfa|password (changed|reset|expir)|security key/i;

/**
 * Vendor policy, DPA, household how-to, or course promo — not a Security event,
 * even when the body talks about "security", "privacy", or "verification".
 */
export function matchSecurityNegative(
  from: string,
  fromEmail: string,
  subject: string,
  bodyExcerpt = "",
): Category | null {
  const blob = `${from} ${fromEmail} ${subject} ${bodyExcerpt}`;
  const email = fromEmail.toLowerCase();

  if (/udemy|udemymail/i.test(blob) && UDEMY_PROMO_RE.test(blob)) return "marketing";
  if (/netflix/i.test(blob) && HOUSEHOLD_RE.test(blob)) return "notification";
  if (
    (/fyxer/i.test(blob) || email.startsWith("privacy@")) &&
    (SUBPROCESS_RE.test(blob) || /privacy/i.test(blob)) &&
    !ACCOUNT_EVENT_RE.test(`${subject} ${bodyExcerpt}`)
  ) {
    return "notification";
  }
  if (SUBPROCESS_RE.test(blob) || /\bdpa\b|data processing add/i.test(blob)) return "notification";
  if (HOUSEHOLD_RE.test(blob) && /how to update|sharing|profile/i.test(blob)) return "notification";
  return null;
}
