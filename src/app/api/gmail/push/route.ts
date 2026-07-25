import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, emailAccounts } from "@/lib/db";
import { inngest } from "@/inngest/client";

/**
 * Google Cloud Pub/Sub push endpoint for Gmail watch notifications.
 *
 * The push subscription URL must include the shared secret, e.g.
 *   https://<app>/api/gmail/push?token=<PUBSUB_VERIFICATION_TOKEN>
 *
 * Payload: { message: { data: base64({"emailAddress": ..., "historyId": ...}) } }
 * We always answer 200 for valid requests (even unknown accounts) so Pub/Sub
 * doesn't retry forever; actual sync work happens in Inngest.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.PUBSUB_VERIFICATION_TOKEN;
  if (!expected || req.nextUrl.searchParams.get("token") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let emailAddress: string | undefined;
  try {
    const body = await req.json();
    const decoded = Buffer.from(body?.message?.data ?? "", "base64").toString("utf8");
    emailAddress = (JSON.parse(decoded) as { emailAddress?: string }).emailAddress;
  } catch {
    // Malformed payload: acknowledge so Pub/Sub doesn't redeliver garbage.
    return NextResponse.json({ ok: true });
  }
  if (!emailAddress) return NextResponse.json({ ok: true });

  const accounts = await db.query.emailAccounts.findMany({
    where: and(
      eq(emailAccounts.email, emailAddress.toLowerCase()),
      eq(emailAccounts.status, "active"),
    ),
  });

  const ready = accounts.filter((a) => a.lastHistoryId);
  if (ready.length > 0) {
    await inngest.send(
      ready.map((a) => ({ name: "app/account.sync" as const, data: { accountId: a.id } })),
    );
  }

  return NextResponse.json({ ok: true, queued: ready.length });
}
