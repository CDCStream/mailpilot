import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ANON_COOKIE, newAnonId, trackEvent, type TrackedEvent } from "@/lib/analytics";

const CLIENT_EVENTS = new Set<TrackedEvent>(["page_view", "checkout_started", "onboarding_step"]);

export async function POST(req: Request) {
  let body: { event?: string; path?: string; referrer?: string; properties?: Record<string, unknown> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  const event = body.event as TrackedEvent;
  if (!CLIENT_EVENTS.has(event)) {
    return NextResponse.json({ error: "event not allowed" }, { status: 400 });
  }

  const session = await auth();
  const existing = req.headers.get("cookie")?.match(new RegExp(`${ANON_COOKIE}=([^;]+)`));
  const anonId = existing?.[1] || newAnonId();

  await trackEvent({
    event,
    userId: session?.user?.id,
    anonId,
    path: typeof body.path === "string" ? body.path.slice(0, 500) : null,
    referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 500) : null,
    properties: body.properties,
    request: req,
  });

  const res = NextResponse.json({ ok: true });
  if (!existing?.[1]) {
    res.cookies.set(ANON_COOKIE, anonId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return res;
}
