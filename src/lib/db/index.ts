import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
  dbClient?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.dbClient ??
  postgres(process.env.DATABASE_URL ?? "postgres://localhost:5432/mailpilot", {
    max: 5,
    prepare: false, // required for transaction-mode poolers (Supabase/Neon pgbouncer)
  });

if (process.env.NODE_ENV !== "production") globalForDb.dbClient = client;

export const db = drizzle(client, { schema });
export * from "./schema";
