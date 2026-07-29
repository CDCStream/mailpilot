// Sends a one-off test email to verify the Resend key + verified domain work.
// Usage: node --env-file=.env.local scripts/test-resend.mjs someone@gmail.com
import { Resend } from "resend";

const to = process.argv[2];
if (!to) {
  console.error("usage: node scripts/test-resend.mjs <email>");
  process.exit(1);
}

const resend = new Resend(process.env.RESEND_API_KEY);
const from = process.env.BRIEF_FROM_EMAIL ?? "Inbox Wingman <brief@inboxwingman.com>";
const { data, error } = await resend.emails.send({
  from,
  to,
  subject: "Inbox Wingman — email delivery test",
  html: "<p>Resend + inboxwingman.com domain is working. Daily briefs will arrive from this address.</p>",
});
console.log(error ? `FAILED: ${error.name} — ${error.message}` : `sent, id: ${data.id}`);
