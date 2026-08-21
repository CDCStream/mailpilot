import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { RETRIAGE_SCOPES, type RetriageScope } from "@/lib/classifier-version";
import { inngest } from "@/inngest/client";
import { enqueueRetriageJob } from "@/lib/retriage-enqueue";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Enqueue only. Must return 200 — Settings Server Actions 503 on the RSC refetch. */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const scopeRaw = String(body?.scope ?? "7");
  const scope: RetriageScope = (RETRIAGE_SCOPES as readonly string[]).includes(scopeRaw)
    ? (scopeRaw as RetriageScope)
    : "7";

  try {
    const result = await enqueueRetriageJob(userId, scope);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
    }
    if (result.total > 0 && !result.alreadyActive) {
      void inngest
        .send({ name: "app/user.retriage", data: { userId, jobId: result.jobId } })
        .catch((err) => console.error("retriage event send failed", err));
    }
    return NextResponse.json({
      ok: true,
      jobId: result.jobId,
      total: result.total,
      alreadyActive: result.alreadyActive ?? false,
    });
  } catch (err) {
    console.error("retriage start failed", err);
    return NextResponse.json({ ok: false, error: "Re-triage failed to start — try again" }, { status: 200 });
  }
}
