"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, lt } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { db, retriageJobs } from "@/lib/db";
import { RETRIAGE_SCOPES, type RetriageScope } from "@/lib/classifier-version";
import { inngest } from "@/inngest/client";
import { listRetriageTargets } from "@/lib/retriage-query";
import { purgePoisonedSenderCache, relabelPoisonedLinkedInSecurity } from "@/lib/sender-cache";

export type RetriageActionState = { ok: boolean; error?: string } | null;

/**
 * Isolated from ../actions so this module never imports next/server `after()`
 * or the Gmail pipeline — both have taken the settings page down.
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

    const staleBefore = new Date(Date.now() - 15_000);
    await db
      .update(retriageJobs)
      .set({ status: "cancelled", error: "stale", updatedAt: new Date() })
      .where(
        and(
          eq(retriageJobs.userId, userId),
          inArray(retriageJobs.status, ["queued", "running", "cancel_requested"]),
          eq(retriageJobs.total, 0),
          eq(retriageJobs.processed, 0),
          lt(retriageJobs.createdAt, staleBefore),
        ),
      );
    await db
      .update(retriageJobs)
      .set({ status: "cancelled", error: "stale", updatedAt: new Date() })
      .where(
        and(
          eq(retriageJobs.userId, userId),
          inArray(retriageJobs.status, ["queued", "running", "cancel_requested"]),
          lt(retriageJobs.updatedAt, new Date(Date.now() - 30 * 60 * 1000)),
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

    try {
      await purgePoisonedSenderCache();
      await relabelPoisonedLinkedInSecurity();
    } catch (err) {
      console.error("retriage pre-start repair failed", err);
    }

    const targets = await listRetriageTargets(userId, scope);
    const inserted = await db
      .insert(retriageJobs)
      .values({
        userId,
        scope,
        status: targets.length === 0 ? "done" : "queued",
        total: targets.length,
        processed: 0,
      })
      .returning({ id: retriageJobs.id });
    const job = inserted[0];
    if (!job) {
      console.error("retriage job insert returned no row");
      return { ok: false, error: "Re-triage failed to start — try again" };
    }

    if (targets.length === 0) {
      revalidatePath("/dashboard/settings");
      return { ok: true };
    }

    await inngest.send({
      name: "app/user.retriage",
      data: { userId, jobId: job.id },
    });

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard");
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
