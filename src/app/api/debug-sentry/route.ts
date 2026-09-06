import { NextResponse } from "next/server";

/** Temporary verification route. 404 in production unless SENTRY_TEST=1. */
export async function GET() {
  if (process.env.NODE_ENV === "production" && process.env.SENTRY_TEST !== "1") {
    return new NextResponse("Not found", { status: 404 });
  }
  throw new Error("Sentry test error " + Date.now());
}
