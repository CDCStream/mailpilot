import { cookies, headers } from "next/headers";
import { db, analyticsEvents } from "@/lib/db";

export const ANON_COOKIE = "iw_anon";

export const TRACKED_EVENTS = [
  "page_view",
  "signup",
  "account_connected",
  "onboarding_step",
  "onboarded",
  "draft_created",
  "brief_generated",
  "checkout_started",
  "paid",
] as const;

export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

export type TrackInput = {
  event: TrackedEvent;
  userId?: string | null;
  anonId?: string | null;
  path?: string | null;
  referrer?: string | null;
  properties?: Record<string, unknown>;
  request?: Request;
};

function decodeGeo(value: string | null): string | null {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function geoFromHeaders(h: Headers): { country: string | null; region: string | null; city: string | null } {
  return {
    country: h.get("x-vercel-ip-country"),
    region: h.get("x-vercel-ip-country-region"),
    city: decodeGeo(h.get("x-vercel-ip-city")),
  };
}

export function newAnonId(): string {
  return crypto.randomUUID();
}

export async function readAnonId(): Promise<string> {
  const jar = await cookies();
  return jar.get(ANON_COOKIE)?.value || newAnonId();
}

/** Fire-and-forget product event. Never throws. */
export async function trackEvent(input: TrackInput): Promise<void> {
  try {
    let anonId = input.anonId || "";
    if (!anonId) {
      try {
        anonId = await readAnonId();
      } catch {
        anonId = newAnonId();
      }
    }

    let geo = { country: null as string | null, region: null as string | null, city: null as string | null };
    let userAgent: string | null = null;
    try {
      const h = input.request?.headers ?? (await headers());
      geo = geoFromHeaders(h instanceof Headers ? h : new Headers(h));
      userAgent = h.get("user-agent");
    } catch {
      // Inngest / scripts have no request headers.
    }

    await db.insert(analyticsEvents).values({
      userId: input.userId || null,
      anonId,
      event: input.event,
      path: input.path ?? null,
      referrer: input.referrer ?? null,
      properties: input.properties ?? null,
      userAgent,
      country: geo.country,
      region: geo.region,
      city: geo.city,
    });
  } catch (error) {
    console.error("trackEvent failed", input.event, error);
  }
}
