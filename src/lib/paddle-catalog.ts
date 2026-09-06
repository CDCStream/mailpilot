/** Sandbox price IDs from scripts/seed-paddle-catalog.ts. Live overrides via env. */
export const PADDLE_SANDBOX_PLAN_PRICES = {
  pilot: "pri_01m1v18gjhx46z1w8texnejx3r",
  wingman: "pri_01m1v18gxhrkkre4t7ddrhd5jx",
} as const;

export const PADDLE_SANDBOX_TOPUP_PRICES: Record<string, string> = {
  "100": "pri_01m1v18h8rmef5aag7jwy7becp",
  "250": "pri_01m1v18hemaw6hxnhzzrt797m9",
  "500": "pri_01m1v18hmd33mj8348x75yf5bx",
  "750": "pri_01m1v18htw7jr0tcrcsrx5j4we",
  "1000": "pri_01m1v18j154tm5dzm03vze13bn",
  "1500": "pri_01m1v18j7c726j0h3p8x9w6g7g",
  "2000": "pri_01m1v18jd47ncq55d20ff416pq",
  "3000": "pri_01m1v18jjzs0chvdvbwrxgz3gg",
};
