import {
  EventName,
  type EventEntity,
  type SubscriptionActivatedEvent,
  type SubscriptionCanceledEvent,
  type SubscriptionCreatedEvent,
  type SubscriptionPastDueEvent,
  type SubscriptionPausedEvent,
  type SubscriptionResumedEvent,
  type SubscriptionTrialingEvent,
  type SubscriptionUpdatedEvent,
  type TransactionCompletedEvent,
  type CustomerCreatedEvent,
  type CustomerUpdatedEvent,
} from "@paddle/paddle-node-sdk";
import { eq } from "drizzle-orm";
import { db, creditTopups, subscriptions, users } from "@/lib/db";
import { applyPaddleSubscription } from "@/lib/paddle-sync";
import { grantBonusCredits } from "@/lib/usage";

type SubscriptionEvent =
  | SubscriptionCreatedEvent
  | SubscriptionUpdatedEvent
  | SubscriptionCanceledEvent
  | SubscriptionActivatedEvent
  | SubscriptionPastDueEvent
  | SubscriptionPausedEvent
  | SubscriptionResumedEvent
  | SubscriptionTrialingEvent;

function customString(
  data: Record<string, unknown> | null | undefined,
  key: string,
): string {
  const value = data?.[key];
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

export async function processPaddleEvent(event: EventEntity): Promise<void> {
  switch (event.eventType) {
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionUpdated:
    case EventName.SubscriptionCanceled:
    case EventName.SubscriptionActivated:
    case EventName.SubscriptionPastDue:
    case EventName.SubscriptionPaused:
    case EventName.SubscriptionResumed:
    case EventName.SubscriptionTrialing:
      await upsertSubscription(event);
      return;
    case EventName.TransactionCompleted:
      await handleTopupTransaction(event);
      return;
    case EventName.CustomerCreated:
    case EventName.CustomerUpdated:
      await upsertCustomer(event);
      return;
    default:
      return;
  }
}

async function upsertSubscription(event: SubscriptionEvent): Promise<void> {
  await applyPaddleSubscription(event.data);
}

async function handleTopupTransaction(event: TransactionCompletedEvent): Promise<void> {
  const txn = event.data;
  const custom = (txn.customData ?? {}) as Record<string, unknown>;
  if (customString(custom, "type") !== "credit_topup") return;

  const userId = customString(custom, "userId");
  const packId = customString(custom, "packId") || "unknown";
  const credits = Number(customString(custom, "credits"));
  if (!userId || !Number.isFinite(credits) || credits <= 0) return;

  const amountCents = Number(txn.details?.totals?.total ?? 0);

  const inserted = await db
    .insert(creditTopups)
    .values({
      userId,
      stripeSessionId: txn.id,
      packId,
      credits,
      amountCents: Number.isFinite(amountCents) ? amountCents : 0,
    })
    .onConflictDoNothing()
    .returning({ id: creditTopups.id });

  if (inserted.length === 0) return;
  await grantBonusCredits(userId, credits);
}

async function upsertCustomer(
  event: CustomerCreatedEvent | CustomerUpdatedEvent,
): Promise<void> {
  const customerId = event.data.id;
  const custom = (event.data.customData ?? {}) as Record<string, unknown>;
  const userIdFromMeta = customString(custom, "userId");
  const email = event.data.email;

  let userId = userIdFromMeta;
  if (!userId && email) {
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });
    userId = user?.id ?? "";
  }
  if (!userId) return;

  await db
    .insert(subscriptions)
    .values({ userId, stripeCustomerId: customerId, status: "none" })
    .onConflictDoUpdate({
      target: subscriptions.userId,
      set: { stripeCustomerId: customerId, updatedAt: new Date() },
    });
}
