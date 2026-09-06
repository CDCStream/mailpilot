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
  type CustomerCreatedEvent,
  type CustomerUpdatedEvent,
} from "@paddle/paddle-node-sdk";
import { eq } from "drizzle-orm";
import { db, subscriptions, users } from "@/lib/db";
import { applyPaddleSubscription, applyTopupFromTransaction } from "@/lib/paddle-sync";

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
      await applyTopupFromTransaction(event.data);
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
