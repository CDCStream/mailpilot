// Quick connectivity check for a Postgres URL passed via TEST_DATABASE_URL.
import postgres from "postgres";

const sql = postgres(process.env.TEST_DATABASE_URL, { max: 1, prepare: false });
const [{ now }] = await sql`select now()`;
const tables = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name
`;
console.log("connected, server time:", now);
console.log("tables:", tables.map((t) => t.table_name).join(", ") || "(none)");
await sql.end();
