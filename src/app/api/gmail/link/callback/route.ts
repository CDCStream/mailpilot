import { NextResponse } from "next/server";
import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, emailAccounts } from "@/lib/db";
import { encryptSecret } from "@/lib/crypto";
import { inngest } from "@/inngest/client";
import { resolveCreditLimit } from "@/lib/usage";
import { maxAccountsFor } from "@/lib/plans";

export async function GET(req: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await auth();
  const sessionUserId = session?.user?.id;
  if (!sessionUserId) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err || !code || !state) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?error=link_canceled`);
  }

  // State must match the signed-in user (prevents attaching mailboxes to someone else).
  if (state !== sessionUserId) {
    return NextResponse.redirect(`${appUrl}/dashboard/settings?error=link_mismatch`);
  }

  const { plan } = await resolveCreditLimit(sessionUserId);
  const existing = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, sessionUserId),
  });
  const max = maxAccountsFor(plan);
  if (existing.length >= max) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?error=account_limit&max=${max}`,
    );
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl}/api/gmail/link/callback`,
  );

  try {
    const { tokens } = await oauth2.getToken(code);
    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?error=no_refresh_token`);
    }
    oauth2.setCredentials(tokens);

    const oauth = google.oauth2({ version: "v2", auth: oauth2 });
    const { data: profile } = await oauth.userinfo.get();
    const email = profile.email?.toLowerCase();
    if (!email) {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?error=no_email`);
    }

    // Don't steal an account already owned by a different user.
    const ownedElsewhere = await db.query.emailAccounts.findFirst({
      where: eq(emailAccounts.email, email),
    });
    if (ownedElsewhere && ownedElsewhere.userId !== sessionUserId) {
      return NextResponse.redirect(`${appUrl}/dashboard/settings?error=email_taken`);
    }

    const [row] = await db
      .insert(emailAccounts)
      .values({
        userId: sessionUserId,
        provider: "gmail",
        email,
        refreshTokenEnc: encryptSecret(tokens.refresh_token),
        status: "active",
        // Show the "importing your mail" banner from the very first page load;
        // the backfill job clears it when the import finishes.
        backfillStartedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [emailAccounts.userId, emailAccounts.email],
        set: {
          refreshTokenEnc: encryptSecret(tokens.refresh_token),
          status: "active",
          lastError: null,
          backfillStartedAt: new Date(),
        },
      })
      .returning();

    // The mailbox is linked at this point; kicking off background setup is
    // best-effort. If the event can't be sent (e.g. Inngest unreachable), the
    // half-hourly safety net re-triggers setup for un-onboarded accounts.
    try {
      await inngest.send({ name: "app/account.connected", data: { accountId: row.id } });
    } catch (e) {
      console.error("gmail linked but setup event failed (safety net will retry)", e);
      return NextResponse.redirect(
        `${appUrl}/dashboard/settings?linked=${encodeURIComponent(email)}&setup=deferred`,
      );
    }

    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?linked=${encodeURIComponent(email)}`,
    );
  } catch (e) {
    console.error("gmail link failed", e);
    return NextResponse.redirect(`${appUrl}/dashboard/settings?error=link_failed`);
  }
}
