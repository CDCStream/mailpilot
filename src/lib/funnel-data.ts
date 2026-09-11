import { and, asc, desc, eq, gte, inArray, or } from "drizzle-orm";
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
  /** Highest onboarding wizard step reached (0 = never opened it). */
  onboardingStep: number;
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
      onboardingStep: 0,
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
    if (row.event === "onboarding_step") {
      const step = Number(row.properties?.step) || 0;
      if (step > person.onboardingStep) person.onboardingStep = step;
    }
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

  const onboardingSteps: FunnelStep[] = [
    { key: "onb1", label: "1 · Persona", value: list.filter((p) => p.onboardingStep >= 1).length },
    { key: "onb2", label: "2 · Inbox mode", value: list.filter((p) => p.onboardingStep >= 2).length },
    { key: "onb3", label: "3 · Voice", value: list.filter((p) => p.onboardingStep >= 3).length },
    { key: "onb4", label: "4 · Setup started", value: list.filter((p) => p.onboardingStep >= 4).length },
    { key: "onb5", label: "Finished", value: list.filter((p) => p.onboardingStep >= 1 && p.onboarded).length },
  ];

  return {
    since: since.toISOString(),
    steps,
    onboardingSteps,
    people: list.sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? "")),
  };
}

export type FunnelJourneyEvent = {
  id: string;
  event: string;
  path: string | null;
  referrer: string | null;
  properties: Record<string, unknown> | null;
  createdAt: string;
};

function personFromEvents(
  id: string,
  rows: {
    event: string;
    path: string | null;
    createdAt: Date;
    userId: string | null;
    properties: Record<string, unknown> | null;
  }[],
): FunnelPerson {
  const last = rows[rows.length - 1];
  const first = rows[0];
  return {
    id,
    kind: rows.some((r) => r.userId) ? "user" : "anon",
    email: null,
    lastPath: last?.path ?? first?.path ?? null,
    lastAt: last?.createdAt.toISOString() ?? null,
    events: rows.length,
    signedUp: rows.some((r) => r.event === "signup"),
    gmail: rows.some((r) => r.event === "account_connected"),
    onboardingStep: rows.reduce(
      (max, r) =>
        r.event === "onboarding_step" ? Math.max(max, Number(r.properties?.step) || 0) : max,
      0,
    ),
    onboarded: rows.some((r) => r.event === "onboarded"),
    drafted: rows.some((r) => r.event === "draft_created"),
    checkout: rows.some((r) => r.event === "checkout_started"),
    paid: rows.some((r) => r.event === "paid"),
    plan: null,
  };
}

export async function loadFunnelJourney(personId: string, days = 14) {
  const since = new Date(funnelSinceIso(days));
  const adminEmails = funnelAdminEmails();
  const isAnon = personId.startsWith("anon:");
  const anonId = isAnon ? personId.slice("anon:".length) : null;
  const userId = isAnon ? null : personId;

  let rows;
  if (anonId) {
    rows = await db
      .select()
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.anonId, anonId), gte(analyticsEvents.createdAt, since)))
      .orderBy(asc(analyticsEvents.createdAt))
      .limit(500);
  } else if (userId) {
    const own = await db
      .select()
      .from(analyticsEvents)
      .where(and(eq(analyticsEvents.userId, userId), gte(analyticsEvents.createdAt, since)))
      .limit(500);
    const anonIds = [...new Set(own.map((r) => r.anonId).filter(Boolean))];
    rows = await db
      .select()
      .from(analyticsEvents)
      .where(
        and(
          anonIds.length
            ? or(eq(analyticsEvents.userId, userId), inArray(analyticsEvents.anonId, anonIds))
            : eq(analyticsEvents.userId, userId),
          gte(analyticsEvents.createdAt, since),
        ),
      )
      .orderBy(asc(analyticsEvents.createdAt))
      .limit(500);
  } else {
    return null;
  }

  if (rows.length === 0) return null;

  const person = personFromEvents(personId, rows);
  const linkedUserId = userId ?? rows.find((r) => r.userId)?.userId ?? null;
  if (linkedUserId) {
    const u = await db.query.users.findFirst({
      where: eq(users.id, linkedUserId),
      columns: { id: true, email: true, onboardedAt: true },
    });
    if (u?.email && adminEmails.includes(u.email.toLowerCase())) return null;
    person.email = u?.email ?? null;
    if (u?.onboardedAt) person.onboarded = true;
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, linkedUserId),
      columns: { status: true, plan: true },
    });
    if (sub?.status === "active" || sub?.status === "past_due") {
      person.paid = true;
      person.plan = sub.plan;
    }
  }

  return {
    since: since.toISOString(),
    person,
    events: rows.map((r) => ({
      id: r.id,
      event: r.event,
      path: r.path,
      referrer: r.referrer,
      properties: r.properties,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
