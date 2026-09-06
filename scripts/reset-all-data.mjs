// DANGER: wipes EVERY row in the app database for a from-scratch live test.
// Revokes every stored Google refresh token first so re-connecting starts
// from a clean consent screen. Usage:
//   CONFIRM=WIPE node --env-file=.env.local scripts/reset-all-data.mjs
import { createDecipheriv } from "crypto";
import postgres from "postgres";

if (process.env.CONFIRM !== "WIPE") {
  console.error("Refusing to run. Set CONFIRM=WIPE to wipe the database.");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

function decryptSecret(payload) {
  const key = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY, "hex");
  const [ivB64, dataB64, tagB64] = payload.split(".");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

const sql = postgres(process.env.DATABASE_URL);

const accounts = await sql`select refresh_token_enc from email_accounts`;
let revoked = 0;
let revokeFailed = 0;
for (const account of accounts) {
  try {
    const token = decryptSecret(account.refresh_token_enc);
    const res = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      { method: "POST" },
    );
    if (res.ok) revoked += 1;
    else revokeFailed += 1;
  } catch {
    revokeFailed += 1;
  }
}
console.log(`google revoke: ${revoked} ok, ${revokeFailed} failed, ${accounts.length} accounts`);

const tables = [
  "credit_topups",
  "credit_usage",
  "usage_counters",
  "subscriptions",
  "briefs",
  "chat_threads",
  "rules",
  "followups",
  "sender_category_cache",
  "retriage_jobs",
  "messages",
  "email_accounts",
  "users",
];
for (const table of tables) {
  const exists = await sql`
    select exists (
      select 1
      from information_schema.tables
      where table_schema = 'public' and table_name = ${table}
    ) as ok
  `;
  if (!exists[0]?.ok) {
    console.log(`skipped ${table} (missing)`);
    continue;
  }
  const [{ n }] = await sql`select count(*)::int as n from ${sql(table)}`;
  await sql`truncate table ${sql(table)} cascade`;
  console.log(`truncated ${table} (${n} rows)`);
}

await sql.end();
console.log("done — database is empty, ready for a fresh live test");
