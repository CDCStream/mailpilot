import { NextResponse } from "next/server";
import { google } from "googleapis";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, emailAccounts } from "@/lib/db";
import { resolveCreditLimit } from "@/lib/usage";
import { maxAccountsFor } from "@/lib/plans";

const GMAIL_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
].join(" ");

/** Starts Google OAuth to link an additional Gmail mailbox to the current user. */
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  const [{ plan }, accounts] = await Promise.all([
    resolveCreditLimit(userId),
    db.query.emailAccounts.findMany({ where: eq(emailAccounts.userId, userId) }),
  ]);
  const max = maxAccountsFor(plan);
  if (accounts.length >= max) {
    return NextResponse.redirect(
      `${appUrl}/dashboard/settings?error=account_limit&max=${max}`,
    );
  }

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl}/api/gmail/link/callback`,
  );

  const url = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state: userId,
    include_granted_scopes: true,
  });

  return NextResponse.redirect(url);
}
