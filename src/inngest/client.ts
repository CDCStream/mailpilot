import { sentryMiddleware } from "@inngest/middleware-sentry";
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "mailpilot",
  middleware: [sentryMiddleware({ onlyCaptureFinalAttempt: true })],
});

export type Events = {
  "app/account.connected": { data: { accountId: string } };
  "app/account.sync": { data: { accountId: string } };
};
