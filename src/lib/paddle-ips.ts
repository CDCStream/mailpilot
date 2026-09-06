/**
 * Paddle webhook source IPs. Fetched from the public endpoint — do not hard-code.
 * Live: https://api.paddle.com/ips
 * Sandbox: https://sandbox-api.paddle.com/ips
 */

type IpsResponse = { data?: { ipv4_cidrs?: string[] } };

let cached: { at: number; cidrs: string[] } | null = null;
const TTL_MS = 60 * 60 * 1000;

export function paddleIpsUrl(): string {
  return process.env.NEXT_PUBLIC_PADDLE_ENV === "production"
    ? "https://api.paddle.com/ips"
    : "https://sandbox-api.paddle.com/ips";
}

export async function paddleWebhookCidrs(): Promise<string[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.cidrs;
  const res = await fetch(paddleIpsUrl(), { cache: "no-store" });
  if (!res.ok) return cached?.cidrs ?? [];
  const json = (await res.json()) as IpsResponse;
  const cidrs = json.data?.ipv4_cidrs ?? [];
  if (cidrs.length > 0) cached = { at: Date.now(), cidrs };
  return cidrs;
}

export function requestClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? request.headers.get("cf-connecting-ip") ?? "";
}

/** Paddle currently publishes /32 CIDRs. Treat anything else as exact host match. */
export function ipInCidrList(ip: string, cidrs: string[]): boolean {
  if (!ip) return false;
  return cidrs.some((cidr) => {
    const [base] = cidr.split("/");
    return !!base && ip === base;
  });
}
