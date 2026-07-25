import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "mailpilot" });

export type Events = {
  "app/account.connected": { data: { accountId: string } };
  "app/account.sync": { data: { accountId: string } };
};
