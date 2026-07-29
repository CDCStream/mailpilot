import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);
const rows = await sql`
  select email,
         last_history_id is not null as onboarded,
         label_map is not null as labels,
         backfill_started_at,
         (select count(*) from messages m where m.account_id = email_accounts.id) as msgs
  from email_accounts
  order by created_at
`;
console.log(JSON.stringify(rows, null, 2));
await sql.end();
