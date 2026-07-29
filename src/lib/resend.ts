import { Resend } from "resend";

let resendSingleton: Resend | null = null;

export function getResend(): Resend {
  if (!resendSingleton) {
    resendSingleton = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");
  }
  return resendSingleton;
}

export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const from = process.env.BRIEF_FROM_EMAIL ?? "Inbox Wingman <onboarding@resend.dev>";
  // The Resend SDK reports API failures via `error` instead of throwing —
  // surface them so callers can log/handle delivery problems.
  const { error } = await getResend()
    .emails.send({ from, to: opts.to, subject: opts.subject, html: opts.html });
  if (error) throw new Error(`resend: ${error.name} — ${error.message}`);
}
