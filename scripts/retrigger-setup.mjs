// One-off: re-sends the setup event for linked accounts whose onboarding
// never ran (lastHistoryId is null). Run with:
//   node --env-file=.env.local scripts/retrigger-setup.mjs
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);
const rows = await sql`
  select id, email from email_accounts
  where status = 'active' and last_history_id is null
`;
await sql.end();

if (rows.length === 0) {
  console.log("no stuck accounts — nothing to do");
  process.exit(0);
}

for (const row of rows) {
  const res = await fetch("http://localhost:8288/e/dev", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "app/account.connected",
      data: { accountId: row.id },
    }),
  });
  console.log(`${row.email}: ${res.status} ${await res.text()}`);
}
