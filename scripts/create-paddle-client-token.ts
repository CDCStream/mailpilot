/**
 * Creates a sandbox client-side token and writes NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
 * to .env.local if missing. Does not print the token.
 *
 *   npx tsx scripts/create-paddle-client-token.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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

function appendEnv(name: string, value: string) {
  const path = resolve(process.cwd(), ".env.local");
  const existing = readFileSync(path, "utf8");
  const line = existing.endsWith("\n") ? "" : "\n";
  writeFileSync(path, `${existing}${line}${name}=${value}\n`);
}

async function main() {
  const existing = readEnvLocal("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");
  if (existing) {
    console.log("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN already set — skipped.");
    return;
  }

  const apiKey = readEnvLocal("PADDLE_API_KEY");
  if (!apiKey) {
    throw new Error("PADDLE_API_KEY missing from .env.local");
  }

  const paddle = new Paddle(apiKey, { environment: Environment.sandbox });
  const token = await paddle.clientTokens.create({
    name: "Inbox Wingman frontend",
    description: "Overlay checkout for inboxwingman.com",
  });

  appendEnv("NEXT_PUBLIC_PADDLE_CLIENT_TOKEN", token.token);
  if (!readEnvLocal("NEXT_PUBLIC_PADDLE_ENV")) {
    appendEnv("NEXT_PUBLIC_PADDLE_ENV", "sandbox");
  }
  const prefix = token.token.slice(0, 8);
  console.log(`Wrote NEXT_PUBLIC_PADDLE_CLIENT_TOKEN (${prefix}…)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "failed");
  process.exit(1);
});
