/** Sandbox price IDs from the Inbox Wingman Paddle sandbox account. */
export const PADDLE_SANDBOX_PLAN_PRICES = {
  pilot: "pri_01m1v3xp7f4xkzy0jkfc8esswm",
  wingman: "pri_01m1v3xpcb2ckv1maj7v6hrct3",
} as const;

export const PADDLE_SANDBOX_TOPUP_PRICES: Record<string, string> = {
  "100": "pri_01m1v3xpgsdd4pprpm60b1satr",
  "250": "pri_01m1v3xpn5r0063kqf0ymfqvt3",
  "500": "pri_01m1v3xpwhp9kjrmf1vp3g2mdm",
  "750": "pri_01m1v3xqd9d25r369cgm6wjeaz",
  "1000": "pri_01m1v3xqhvx6ea0etdnkkx1v13",
  "1500": "pri_01m1v3xqp1cjdr1cqyz07h6wm7",
  "2000": "pri_01m1v3xqtdz45jqnrms3wacnhf",
  "3000": "pri_01m1v3xqz00xzqpdw7j34yt7p0",
};

/** Live price IDs from the Inbox Wingman Paddle live account. */
export const PADDLE_LIVE_PLAN_PRICES = {
  pilot: "pri_01m1v6syc7bggqdv85ywxpwqjr",
  wingman: "pri_01m1v6sz5v38r5bq2ndetvp12j",
} as const;

export const PADDLE_LIVE_TOPUP_PRICES: Record<string, string> = {
  "100": "pri_01m1v6szhaw0s1ezgrzb5eybvg",
  "250": "pri_01m1v6szqe5zksmmt9h67wrzqg",
  "500": "pri_01m1v6szxf4r30j2kdgqsxzmba",
  "750": "pri_01m1v6t038tn160pqst2mxbztj",
  "1000": "pri_01m1v6t098jwd3pbee2vd58bhf",
  "1500": "pri_01m1v6t0f45qfy2rvskepq66ta",
  "2000": "pri_01m1v6t0n1kq3svhgjnxce6ndd",
  "3000": "pri_01m1v6t0v1jc7aa5q5rpqssen2",
};

export function isPaddleLive(): boolean {
  return process.env.NEXT_PUBLIC_PADDLE_ENV === "production";
}

export function paddlePlanPrices() {
  return isPaddleLive() ? PADDLE_LIVE_PLAN_PRICES : PADDLE_SANDBOX_PLAN_PRICES;
}

export function paddleTopupPrices() {
  return isPaddleLive() ? PADDLE_LIVE_TOPUP_PRICES : PADDLE_SANDBOX_TOPUP_PRICES;
}
