import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL);
console.log("users:", await sql`select id, email, created_at from users`);
console.log(
  "briefs:",
  await sql`select id, user_id, subject, created_at from briefs order by created_at desc`,
);
await sql.end();
