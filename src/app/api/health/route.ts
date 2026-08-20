import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Uptime probe: 200 when Postgres answers, 503 otherwise. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("health check failed", err);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
