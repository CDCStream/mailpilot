// One-off test helper: fully removes one linked Gmail account (token revoked
// at Google + row deleted; messages cascade). Usage:
//   node --env-file=.env.local scripts/remove-account.mjs someone@gmail.com
import { createDecipheriv } from "crypto";
import postgres from "postgres";

const email = process.argv[2];
if (!email) {
  console.error("usage: node scripts/remove-account.mjs <email>");
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
const [account] = await sql`
  select id, refresh_token_enc from email_accounts where email = ${email.toLowerCase()}
`;
if (!account) {
  console.log("account not found:", email);
  await sql.end();
  process.exit(0);
}

// Revoke at Google so the re-link starts from a clean consent.
try {
  const token = decryptSecret(account.refresh_token_enc);
  const res = await fetch(
    `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`,
    { method: "POST" },
  );
  console.log("google revoke:", res.status);
} catch (e) {
  console.log("google revoke failed (continuing):", e.message);
}

const [{ n }] = await sql`
  select count(*)::int as n from messages where account_id = ${account.id}
`;
await sql`delete from email_accounts where id = ${account.id}`;
await sql.end();
console.log(`deleted ${email} (+ ${n} messages via cascade)`);
