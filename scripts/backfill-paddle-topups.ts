/**
 * Grant completed live top-ups that the webhook missed.
 *   npx tsx scripts/backfill-paddle-topups.ts <user-email>
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";

function readEnvLocal(name: string): string {
  const path = resolve(process.cwd(), ".env.local");
  let text = "";
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return "";
  }
  const matches = [...text.matchAll(new RegExp(`^${name}=(.*)$`, "gm"))];
  const raw = matches.at(-1)?.[1]?.trim() ?? "";
  return raw.replace(/^["']|["']$/g, "");
}

for (const name of ["DATABASE_URL", "PADDLE_LIVE_API_KEY", "NEXT_PUBLIC_PADDLE_ENV"]) {
  const value = process.env[name] || readEnvLocal(name);
  if (value) process.env[name] = value;
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npx tsx scripts/backfill-paddle-topups.ts <email>");
    process.exit(1);
  }

  const apiKey = process.env.PADDLE_LIVE_API_KEY || readEnvLocal("PADDLE_LIVE_API_KEY");
  if (!apiKey) {
    console.error("Missing PADDLE_LIVE_API_KEY");
    process.exit(1);
  }

  const { db, subscriptions, users } = await import("../src/lib/db");
  const { applyTopupFromTransaction } = await import("../src/lib/paddle-sync");

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, bonusCredits: true },
  });
  if (!user) {
    console.error("User not found");
    process.exit(1);
  }

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, user.id),
  });
  const storedCustomerId = sub?.stripeCustomerId ?? "";

  const paddle = new Paddle(apiKey, { environment: Environment.production });
  const liveIds: string[] = [];
  const customers = paddle.customers.list({ email: [email], perPage: 5 });
  for await (const customer of customers) {
    liveIds.push(customer.id);
  }
  if (liveIds.length === 0) {
    console.error(
      JSON.stringify({
        error: "No live Paddle customer for email",
        storedCustomerPrefix: storedCustomerId.slice(0, 8),
      }),
    );
    process.exit(1);
  }

  if (storedCustomerId !== liveIds[0]) {
    await db
      .update(subscriptions)
      .set({ stripeCustomerId: liveIds[0], updatedAt: new Date() })
      .where(eq(subscriptions.userId, user.id));
  }

  const collection = paddle.transactions.list({
    customerId: liveIds,
    status: ["completed"],
    perPage: 30,
  });

  let granted = 0;
  let seen = 0;
  for await (const txn of collection) {
    seen += 1;
    const applied = await applyTopupFromTransaction({
      id: txn.id,
      customerId: txn.customerId,
      customData: (txn.customData ?? null) as Record<string, unknown> | null,
      items: txn.items,
      details: txn.details,
    });
    if (applied) granted += 1;
  }

  const after = await db.query.users.findFirst({
    where: eq(users.id, user.id),
    columns: { bonusCredits: true },
  });
  console.log(
    JSON.stringify({
      beforeWallet: user.bonusCredits,
      afterWallet: after?.bonusCredits ?? user.bonusCredits,
      storedCustomerMatchedLive: storedCustomerId === liveIds[0],
      liveCustomers: liveIds.length,
      transactionsSeen: seen,
      newlyGranted: granted,
    }),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
