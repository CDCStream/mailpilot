import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db, retriageJobs } from "@/lib/db";
import { failStaleRetriageJobs } from "@/lib/retriage-job";
import { processRetriageBatch } from "@/lib/retriage-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Processes one committed re-triage batch for the signed-in user.
 * The settings panel polls this so progress does not depend on Inngest
 * delivering `app/user.retriage` (that send is what 503'd the Server Action).
 */
export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await failStaleRetriageJobs();
    const job = await db.query.retriageJobs.findFirst({
      where: and(
        eq(retriageJobs.userId, userId),
        inArray(retriageJobs.status, ["queued", "running", "cancel_requested"]),
      ),
    });
    if (!job) {
      return NextResponse.json({ status: "idle", processed: 0, total: 0, changed: 0 });
    }
    const result = await processRetriageBatch(job.id, userId);
    const advanced = result.advanced ?? result.processed - job.processed;
    if (result.status === "running" && advanced <= 0) {
      console.error("retriage zero-progress", {
        jobId: job.id,
        processed: job.processed,
        total: job.total,
        batchIds: result.batchIds,
      });
      return NextResponse.json(
        { ...result, advanced: 0, error: "zero-progress" },
        { status: 409 },
      );
    }
    return NextResponse.json({ ...result, advanced });
  } catch (err) {
    console.error("retriage tick failed", err);
    return NextResponse.json({ status: "failed", error: "tick-error" }, { status: 500 });
  }
}
