/**
 * Sets every catalog price to tax exclusive (customer pays VAT/KDV on top).
 *
 *   npx tsx scripts/set-paddle-tax-exclusive.ts live
 *   npx tsx scripts/set-paddle-tax-exclusive.ts sandbox
 */
import { readFileSync } from "node:fs";
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

async function main() {
  const target = process.argv[2] === "sandbox" ? "sandbox" : "live";
  const live = target === "live";
  const apiKey = live
    ? process.env.PADDLE_LIVE_API_KEY || readEnvLocal("PADDLE_LIVE_API_KEY")
    : process.env.PADDLE_API_KEY || readEnvLocal("PADDLE_API_KEY");
  if (!apiKey) {
    console.error(`Missing ${live ? "PADDLE_LIVE_API_KEY" : "PADDLE_API_KEY"}`);
    process.exit(1);
  }

  const paddle = new Paddle(apiKey, {
    environment: live ? Environment.production : Environment.sandbox,
  });

  const list = paddle.prices.list({ perPage: 50 });
  let updated = 0;
  for await (const price of list) {
    if (price.taxMode === "external") {
      console.log(`ok      ${price.id}`);
      continue;
    }
    await paddle.prices.update(price.id, { taxMode: "external" });
    console.log(`updated ${price.id}  ${price.taxMode} → external`);
    updated += 1;
  }
  console.log(`${target}: ${updated} prices set exclusive`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
