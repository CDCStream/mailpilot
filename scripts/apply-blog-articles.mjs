import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);
const file = readFileSync(resolve("drizzle/0010_blog_articles.sql"), "utf8");
const statements = file
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);
for (const statement of statements) {
  await sql.unsafe(statement);
  console.log("ok", statement.slice(0, 60).replace(/\s+/g, " "));
}
await sql.end();
console.log("blog_articles table ready");
