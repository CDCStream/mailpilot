"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, lt } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { db, retriageJobs } from "@/lib/db";
import { RETRIAGE_SCOPES, type RetriageScope } from "@/lib/classifier-version";
import { inngest } from "@/inngest/client";
import { failStaleRetriageJobs } from "@/lib/retriage-job";
import { countRetriageTargets } from "@/lib/retriage-query";

export type RetriageActionState = { ok: boolean; error?: string } | null;

/**
 * Enqueue only. Never imports the Gmail pipeline, `after()`, or the batch
 * runner — those 500/503 the settings page when they run on the request path.
 */
export async function startRetriage(
  _prev: RetriageActionState,
  formData: FormData,
): Promise<NonNullable<RetriageActionState>> {
  try {
    const userId = await requireUserId();
    const scopeRaw = String(formData.get("scope") ?? "30");
    const scope: RetriageScope = (RETRIAGE_SCOPES as readonly string[]).includes(scopeRaw)
      ? (scopeRaw as RetriageScope)
      : "30";

    await failStaleRetriageJobs();

    const staleZero = new Date(Date.now() - 15_000);
    await db
      .update(retriageJobs)
      .set({ status: "cancelled", error: "stale", updatedAt: new Date() })
      .where(
        and(
          eq(retriageJobs.userId, userId),
          inArray(retriageJobs.status, ["queued", "running", "cancel_requested"]),
          eq(retriageJobs.total, 0),
          eq(retriageJobs.processed, 0),
          lt(retriageJobs.createdAt, staleZero),
        ),
      );

    const active = await db.query.retriageJobs.findFirst({
      where: and(
        eq(retriageJobs.userId, userId),
        inArray(retriageJobs.status, ["queued", "running", "cancel_requested"]),
      ),
    });
    if (active) {
      revalidatePath("/dashboard/settings");
      return { ok: true };
    }

    const total = await countRetriageTargets(userId, scope);
    const inserted = await db
      .insert(retriageJobs)
      .values({
        userId,
        scope,
        status: total === 0 ? "done" : "queued",
        total,
        processed: 0,
      })
      .returning({ id: retriageJobs.id });
    const job = inserted[0];
    if (!job) {
      console.error("retriage job insert returned no row");
      return { ok: false, error: "Re-triage failed to start — try again" };
    }

    if (total > 0) {
      // Fire-and-forget: awaiting Inngest here 503'd the action on Vercel.
      void inngest
        .send({
          name: "app/user.retriage",
          data: { userId, jobId: job.id },
        })
        .catch((err) => console.error("retriage event send failed", err));
    }

    revalidatePath("/dashboard/settings");
    return { ok: true };
  } catch (err) {
    console.error("startRetriage failed", err);
    return { ok: false, error: "Re-triage failed to start — try again" };
  }
}

export async function cancelRetriage() {
  try {
    const userId = await requireUserId();
    await db
      .update(retriageJobs)
      .set({ status: "cancel_requested", updatedAt: new Date() })
      .where(
        and(
          eq(retriageJobs.userId, userId),
          inArray(retriageJobs.status, ["queued", "running"]),
        ),
      );
    revalidatePath("/dashboard/settings");
  } catch (err) {
    console.error("cancelRetriage failed", err);
  }
}
