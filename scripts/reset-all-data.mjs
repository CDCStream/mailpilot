// DANGER: wipes EVERY row in the app database for a from-scratch live test.
// Revokes every stored Google refresh token first so re-connecting starts
// from a clean consent screen. Usage:
//   node --env-file=.env.local scripts/reset-all-data.mjs
import { createDecipheriv } from "crypto";
import postgres from "postgres";

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

const accounts = await sql`select email, refresh_token_enc from email_accounts`;
for (const account of accounts) {
  try {
    const token = decryptSecret(account.refresh_token_enc);
    const res = await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
      { method: "POST" },
    );
    console.log(`google revoke ${account.email}: ${res.status}`);
  } catch (e) {
    console.log(`google revoke ${account.email} failed (continuing): ${e.message}`);
  }
}

const tables = [
  "credit_topups",
  "credit_usage",
  "usage_counters",
  "subscriptions",
  "briefs",
  "chat_threads",
  "rules",
  "messages",
  "email_accounts",
  "users",
];
for (const table of tables) {
  const [{ n }] = await sql`select count(*)::int as n from ${sql(table)}`;
  await sql`truncate table ${sql(table)} cascade`;
  console.log(`truncated ${table} (${n} rows)`);
}

await sql.end();
console.log("done — database is empty, ready for a fresh live test");
