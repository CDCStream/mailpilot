// Pushes production env vars to Vercel. Values come from .env.local (never
// printed); AUTH_SECRET and PUBSUB_VERIFICATION_TOKEN are freshly generated.
// Usage: node scripts/push-vercel-env.mjs
import { readFileSync } from "fs";
import { randomBytes } from "crypto";
import { spawnSync } from "child_process";

// Parse .env.local — last occurrence of a key wins.
const envMap = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) envMap[m[1]] = m[2];
}

const POOLED_DB =
  "postgresql://postgres.cxnbxiryrnnrwjexyimv:GBfvdcsxaz321_@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";
const pubsubToken = randomBytes(24).toString("hex");

const vars = {
  DATABASE_URL: POOLED_DB,
  AUTH_SECRET: randomBytes(32).toString("base64"),
  TOKEN_ENCRYPTION_KEY: envMap.TOKEN_ENCRYPTION_KEY,
  GOOGLE_CLIENT_ID: envMap.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: envMap.GOOGLE_CLIENT_SECRET,
  OPENAI_API_KEY: envMap.OPENAI_API_KEY,
  RESEND_API_KEY: envMap.RESEND_API_KEY,
  BILLING_ENABLED: "false",
  PUBSUB_VERIFICATION_TOKEN: pubsubToken,
};

for (const [name, value] of Object.entries(vars)) {
  if (!value) {
    console.log(`SKIP ${name} (no value in .env.local)`);
    continue;
  }
  const res = spawnSync("npx", ["vercel", "env", "add", name, "production", "--force"], {
    input: value,
    shell: true,
    encoding: "utf8",
  });
  const out = (res.stdout + res.stderr).trim().split("\n").pop();
  console.log(res.status === 0 ? `OK   ${name}` : `FAIL ${name}: ${out}`);
}

console.log(`\nPUBSUB_VERIFICATION_TOKEN=${pubsubToken}`);
