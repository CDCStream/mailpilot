// Generates a real brief for the first user (AI digest + email) and dumps the
// HTML to a local file for visual inspection.
// Usage: npx tsx --env-file=.env.local scripts/send-test-brief.mts
import { writeFileSync } from "fs";
import { desc, eq } from "drizzle-orm";

// Public URL so the logo in the email header resolves outside localhost.
process.env.NEXT_PUBLIC_APP_URL = "https://www.inboxwingman.com";

const { db, users, briefs } = await import("../src/lib/db/index.js");
const { buildAndSendBrief } = await import("../src/lib/brief.js");

const user = await db.query.users.findFirst();
if (!user) {
  console.error("no users in db");
  process.exit(1);
}
const sent = await buildAndSendBrief(user.id, { ignoreEnabled: true });
console.log("buildAndSendBrief:", sent);

const [latest] = await db.query.briefs.findMany({
  where: eq(briefs.userId, user.id),
  orderBy: [desc(briefs.createdAt)],
  limit: 1,
});
if (latest) {
  writeFileSync("scripts/brief-preview.html", latest.html);
  console.log("preview: scripts/brief-preview.html —", latest.subject);
}
process.exit(0);
