import { desc, gte, inArray } from "drizzle-orm";
import { db, analyticsEvents, subscriptions, users } from "@/lib/db";
import { funnelAdminEmails, funnelSinceIso } from "@/lib/funnel-admin";

export type FunnelStep = {
  key: string;
  label: string;
  value: number;
};

export type FunnelPerson = {
  id: string;
  kind: "user" | "anon";
  email: string | null;
  lastPath: string | null;
  lastAt: string | null;
  events: number;
  signedUp: boolean;
  gmail: boolean;
  onboarded: boolean;
  drafted: boolean;
  checkout: boolean;
  paid: boolean;
  plan: string | null;
};

export async function loadWingmanFunnel(days = 14) {
  const since = new Date(funnelSinceIso(days));
  const adminEmails = funnelAdminEmails();
  const adminUsers = adminEmails.length
    ? await db.query.users.findMany({
        where: (u, { inArray }) => inArray(u.email, adminEmails),
        columns: { id: true, email: true },
      })
    : [];
  const adminIds = adminUsers.map((u) => u.id);

  const eventRows = await db
    .select()
    .from(analyticsEvents)
    .where(gte(analyticsEvents.createdAt, since))
    .orderBy(desc(analyticsEvents.createdAt))
    .limit(8000);

  const people = new Map<string, FunnelPerson>();

  function keyOf(row: { userId: string | null; anonId: string }) {
    return row.userId || `anon:${row.anonId}`;
  }

  function ensure(row: { userId: string | null; anonId: string }): FunnelPerson {
    const id = keyOf(row);
    const existing = people.get(id);
    if (existing) return existing;
    const created: FunnelPerson = {
      id,
      kind: row.userId ? "user" : "anon",
      email: null,
      lastPath: null,
      lastAt: null,
      events: 0,
      signedUp: false,
      gmail: false,
      onboarded: false,
      drafted: false,
      checkout: false,
      paid: false,
      plan: null,
    };
    people.set(id, created);
    return created;
  }

  for (const row of eventRows) {
    if (row.userId && adminIds.includes(row.userId)) continue;
    const person = ensure(row);
    person.events += 1;
    if (!person.lastAt) {
      person.lastAt = row.createdAt.toISOString();
      person.lastPath = row.path;
    }
    if (row.event === "signup") person.signedUp = true;
    if (row.event === "account_connected") person.gmail = true;
    if (row.event === "onboarded") person.onboarded = true;
    if (row.event === "draft_created") person.drafted = true;
    if (row.event === "checkout_started") person.checkout = true;
    if (row.event === "paid") person.paid = true;
    if (row.userId) person.kind = "user";
  }

  const userIds = [...people.values()].map((p) => p.id).filter((id) => !id.startsWith("anon:"));
  if (userIds.length > 0) {
    const dbUsers = await db.query.users.findMany({
      where: inArray(users.id, userIds),
      columns: { id: true, email: true, onboardedAt: true },
    });
    const subs = await db.query.subscriptions.findMany({
      where: inArray(subscriptions.userId, userIds),
      columns: { userId: true, status: true, plan: true },
    });
    const userById = new Map(dbUsers.map((u) => [u.id, u]));
    const subById = new Map(subs.map((s) => [s.userId, s]));
    for (const person of people.values()) {
      if (person.kind !== "user") continue;
      const u = userById.get(person.id);
      if (u?.email && adminEmails.includes(u.email.toLowerCase())) {
        people.delete(person.id);
        continue;
      }
      person.email = u?.email ?? null;
      if (u?.onboardedAt) person.onboarded = true;
      const sub = subById.get(person.id);
      if (sub?.status === "active" || sub?.status === "past_due") {
        person.paid = true;
        person.plan = sub.plan;
      }
    }
  }

  const list = [...people.values()];
  const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
  const visitors = list.length;
  const signups = list.filter((p) => p.kind === "user" || p.signedUp).length;
  const gmail = list.filter((p) => p.gmail).length;
  const onboarded = list.filter((p) => p.onboarded).length;
  const drafted = list.filter((p) => p.drafted).length;
  const stillActive = list.filter(
    (p) => (p.kind === "user" || p.signedUp) && p.lastAt && new Date(p.lastAt).getTime() >= twoDaysAgo,
  ).length;
  const checkout = list.filter((p) => p.checkout).length;
  const paid = list.filter((p) => p.paid).length;

  const steps: FunnelStep[] = [
    { key: "visitors", label: "Visitors", value: visitors },
    { key: "signups", label: "Signups", value: signups },
    { key: "gmail", label: "Gmail connected", value: gmail },
    { key: "onboarded", label: "Onboarded", value: onboarded },
    { key: "drafted", label: "First draft", value: drafted },
    { key: "active", label: "Still active", value: stillActive },
    { key: "checkout", label: "Checkout", value: checkout },
    { key: "paid", label: "Paid", value: paid },
  ];

  return { since: since.toISOString(), steps, people: list.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "")) };
}
