const DEFAULT_ADMIN_EMAILS = ["fuatsezer199696@gmail.com"];

function parseList(raw: string | undefined): string[] {
  return (raw || "")
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function funnelAdminEmails(): string[] {
  return [
    ...new Set([
      ...DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase()),
      ...parseList(process.env.FUNNEL_ADMIN_EMAILS),
    ]),
  ];
}

export function isFunnelAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return funnelAdminEmails().includes(email.trim().toLowerCase());
}

export function funnelSinceIso(days = 14): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
