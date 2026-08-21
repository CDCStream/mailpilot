import { NextResponse } from "next/server";
import { inArray } from "drizzle-orm";
import { db, retriageJobs } from "@/lib/db";
import { failStaleRetriageJobs } from "@/lib/retriage-job";
import { processRetriageBatch } from "@/lib/retriage-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const authz = req.headers.get("authorization");
  if (secret && authz === `Bearer ${secret}`) return true;
  if (req.headers.get("x-vercel-cron") === "1") return true;
  return !secret && process.env.NODE_ENV !== "production";
}

/** Vercel cron: drain one batch per active job if Inngest never picked it up. */
export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await failStaleRetriageJobs();
    const jobs = await db.query.retriageJobs.findMany({
      where: inArray(retriageJobs.status, ["queued", "running"]),
      columns: { id: true, userId: true },
      limit: 8,
    });
    const results = [];
    for (const job of jobs) {
      results.push(await processRetriageBatch(job.id, job.userId));
    }
    return NextResponse.json({ ok: true, drained: results.length });
  } catch (err) {
    console.error("retriage cron failed", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
