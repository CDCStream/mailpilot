/**
 * Creates Inbox Wingman products + prices in Paddle sandbox.
 * Does not print the API key. Re-runs skip products that already exist by name.
 *
 *   npx tsx scripts/seed-paddle-catalog.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { PLANS, TOPUP_PACKS } from "../src/lib/plans";

const APP = "inbox-wingman";
const NAMES = {
  pilot: "Inbox Wingman Pilot",
  wingman: "Inbox Wingman Wingman",
  credits: "Inbox Wingman AI credits",
} as const;

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

async function allProducts(paddle: Paddle) {
  const found: { id: string; name: string }[] = [];
  const list = paddle.products.list({ perPage: 50 });
  for await (const product of list) {
    found.push({ id: product.id, name: product.name });
  }
  return found;
}

async function seed() {
  const apiKey = process.env.PADDLE_API_KEY || readEnvLocal("PADDLE_API_KEY");
  if (!apiKey.startsWith("pdl_sdbx_")) {
    console.error(
      "Add a sandbox API key to .env.local as PADDLE_API_KEY=pdl_sdbx_apikey_... (Developer tools → Authentication). Do not paste it in chat.",
    );
    process.exit(1);
  }

  const paddle = new Paddle(apiKey, { environment: Environment.sandbox });
  const existing = await allProducts(paddle);
  const byName = new Map(existing.map((p) => [p.name, p.id]));

  async function ensureProduct(
    name: string,
    description: string,
    customData: Record<string, string>,
  ): Promise<string> {
    const already = byName.get(name);
    if (already) {
      console.log(`exists  ${name}  ${already}`);
      return already;
    }
    const created = await paddle.products.create({
      name,
      description,
      taxCategory: "saas",
      customData,
    });
    byName.set(name, created.id);
    console.log(`created ${name}  ${created.id}`);
    return created.id;
  }

  const pilotId = await ensureProduct(NAMES.pilot, `${PLANS.pilot.credits} AI credits / month · up to ${PLANS.pilot.maxAccounts} Gmail accounts`, {
    app: APP,
    kind: "plan",
    plan: "pilot",
  });
  const wingmanId = await ensureProduct(
    NAMES.wingman,
    `${PLANS.wingman.credits} AI credits / month · up to ${PLANS.wingman.maxAccounts} Gmail accounts`,
    { app: APP, kind: "plan", plan: "wingman" },
  );
  const creditsId = await ensureProduct(NAMES.credits, "One-time AI credit top-up · credits never expire", {
    app: APP,
    kind: "topup",
  });

  async function pricesFor(productId: string) {
    const out: { id: string; description: string; customData: Record<string, unknown> | null }[] = [];
    const list = paddle.prices.list({ productId: [productId], perPage: 50 });
    for await (const price of list) {
      out.push({
        id: price.id,
        description: price.description,
        customData: (price.customData as Record<string, unknown> | null) ?? null,
      });
    }
    return out;
  }

  const monthly = async (productId: string, plan: "pilot" | "wingman") => {
    const dollars = PLANS[plan].priceMonthly;
    const description = `${NAMES[plan]} monthly USD`;
    const existingPrice = (await pricesFor(productId)).find(
      (p) => p.customData?.plan === plan || p.description === description,
    );
    if (existingPrice) {
      console.log(`exists  ${plan} monthly  ${existingPrice.id}`);
      return existingPrice.id;
    }
    const price = await paddle.prices.create({
      productId,
      name: "Monthly",
      description,
      unitPrice: { amount: String(dollars * 100), currencyCode: "USD" },
      billingCycle: { interval: "month", frequency: 1 },
      taxMode: "external",
      quantity: { minimum: 1, maximum: 1 },
      customData: { app: APP, kind: "plan", plan },
    });
    console.log(`price   ${plan} monthly $${dollars}  ${price.id}`);
    return price.id;
  };

  const pilotPriceId = await monthly(pilotId, "pilot");
  const wingmanPriceId = await monthly(wingmanId, "wingman");

  const existingTopups = await pricesFor(creditsId);
  const topupPriceIds: Record<string, string> = {};
  for (const pack of TOPUP_PACKS) {
    const description = `${pack.credits} Inbox Wingman AI credits`;
    const already = existingTopups.find(
      (p) => p.customData?.pack === pack.id || p.description === description,
    );
    if (already) {
      topupPriceIds[pack.id] = already.id;
      console.log(`exists  topup ${pack.credits}  ${already.id}`);
      continue;
    }
    const price = await paddle.prices.create({
      productId: creditsId,
      name: `${pack.credits} credits`,
      description,
      unitPrice: { amount: String(pack.priceCents), currencyCode: "USD" },
      taxMode: "external",
      quantity: { minimum: 1, maximum: 1 },
      customData: { app: APP, kind: "topup", pack: pack.id },
    });
    topupPriceIds[pack.id] = price.id;
    console.log(`price   topup ${pack.credits} $${pack.priceCents / 100}  ${price.id}`);
  }

  const catalog = {
    environment: "sandbox",
    products: { pilot: pilotId, wingman: wingmanId, credits: creditsId },
    prices: {
      pilotMonthly: pilotPriceId,
      wingmanMonthly: wingmanPriceId,
      topups: topupPriceIds,
    },
  };
  const out = resolve(process.cwd(), ".paddle-catalog.sandbox.json");
  writeFileSync(out, `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`wrote   ${out}`);
}

seed().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
