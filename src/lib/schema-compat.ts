import { desc, eq } from "drizzle-orm";
import { db, retriageJobs, users } from "@/lib/db";

/**
 * Reads optional round-2 columns/tables without taking the dashboard down
 * if the matching SQL migration has not been applied yet.
 */
export async function readClassifierVersion(userId: string): Promise<string | null> {
  try {
    const row = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { classifierVersion: true },
    });
    return row?.classifierVersion ?? null;
  } catch (err) {
    console.error("classifier_version column missing — run drizzle/0006_retriage_security.sql", err);
    return null;
  }
}

export type SafeRetriageJob = {
  status: string;
  scope: string;
  processed: number;
  total: number;
  changed: number | null;
};

function parseChanged(error: string | null | undefined): number | null {
  const match = error?.match(/^changed:(\d+)$/);
  return match ? Number(match[1]) : null;
}

export async function readLatestRetriageJob(userId: string): Promise<SafeRetriageJob | null> {
  try {
    const job = await db.query.retriageJobs.findFirst({
      where: eq(retriageJobs.userId, userId),
      orderBy: [desc(retriageJobs.createdAt)],
      columns: {
        status: true,
        scope: true,
        processed: true,
        total: true,
        error: true,
      },
    });
    if (!job) return null;
    return {
      status: job.status,
      scope: job.scope,
      processed: job.processed ?? 0,
      total: job.total ?? 0,
      changed: parseChanged(job.error),
    };
  } catch (err) {
    console.error("retriage_jobs table missing — run drizzle/0006_retriage_security.sql", err);
    return null;
  }
}
