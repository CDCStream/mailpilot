"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { requireUserId, signOut } from "@/auth";
import {
  db,
  chatThreads,
  emailAccounts,
  messages,
  rules,
  subscriptions,
  users,
  CATEGORIES,
  DEFAULT_PREFERENCES,
  SUMMARY_LANGUAGES,
  resolveInboxMode,
  type Category,
  type DraftStyle,
  type ParsedRule,
  type SummaryLanguage,
  type UserPreferences,
} from "@/lib/db";
import { forgetSenderCategory } from "@/lib/sender-cache";
import { buildAndSendBrief } from "@/lib/brief";
import { getStripe } from "@/lib/billing";
import { decryptSecret } from "@/lib/crypto";
import { applyLabels, getGmailClient } from "@/lib/gmail";
import { RULE_TEMPLATES } from "@/lib/rule-templates";
import { inngest } from "@/inngest/client";
import { ACTIVE_ACCOUNT_COOKIE } from "./active-account";

/**
 * Scopes the whole dashboard to one Gmail account (or back to "All inboxes"
 * with null). Stored in a cookie so it survives navigation and sessions.
 */
export async function setActiveAccount(accountId: string | null) {
  const userId = await requireUserId();
  const store = await cookies();
  if (!accountId) {
    store.delete(ACTIVE_ACCOUNT_COOKIE);
  } else {
    const account = await db.query.emailAccounts.findFirst({
      where: and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, userId)),
    });
    if (!account) return;
    store.set(ACTIVE_ACCOUNT_COOKIE, accountId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }
  revalidatePath("/dashboard", "layout");
}

export async function updatePreferences(formData: FormData) {
  const userId = await requireUserId();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const current = user?.preferences ?? DEFAULT_PREFERENCES;

  const rawMode = String(formData.get("inboxMode") ?? "");
  const inboxMode =
    rawMode === "focus" || rawMode === "quiet" || rawMode === "label_only" || rawMode === "custom"
      ? rawMode
      : resolveInboxMode(current);

  const archiveCategories = formData
    .getAll("archiveCategories")
    .map(String)
    .filter((c): c is Category => (CATEGORIES as readonly string[]).includes(c));

  const rawStyle = String(formData.get("draftStyle") ?? "");
  const draftStyle: DraftStyle =
    rawStyle === "important_only" || rawStyle === "manual" || rawStyle === "always"
      ? (rawStyle as DraftStyle)
      : "always";

  const rawLanguage = String(formData.get("summaryLanguage") ?? "");
  const summaryLanguage: SummaryLanguage =
    rawLanguage in SUMMARY_LANGUAGES
      ? (rawLanguage as SummaryLanguage)
      : (current.summaryLanguage ?? "en");

  const next: UserPreferences = {
    ...current,
    inboxMode,
    archiveCategories,
    archiveLowPriority: inboxMode !== "label_only",
    respectUserLabels: formData.get("respectUserLabels") === "on",
    draftStyle,
    draftPolicyV2: true,
    summaryLanguage,
    draftCleanupDays: Math.min(
      90,
      Math.max(0, Math.round(Number(formData.get("draftCleanupDays") ?? current.draftCleanupDays ?? 14)) || 0),
    ),
    // "Manual" in the draft-timing selector means: never draft automatically.
    draftsEnabled: draftStyle !== "manual",
    briefEnabled: formData.get("briefEnabled") === "on",
    briefHour: Math.min(23, Math.max(0, Number(formData.get("briefHour") ?? current.briefHour))),
    timezone: String(formData.get("timezone") || current.timezone),
    toneInstructions: String(formData.get("toneInstructions") ?? "").slice(0, 500),
  };

  await db.update(users).set({ preferences: next }).where(eq(users.id, userId));
  revalidatePath("/dashboard/settings");
  redirect("/dashboard/settings?saved=1");
}

export async function toggleRule(ruleId: string) {
  const userId = await requireUserId();
  const rule = await db.query.rules.findFirst({
    where: and(eq(rules.id, ruleId), eq(rules.userId, userId)),
  });
  if (!rule) return;
  await db.update(rules).set({ enabled: !rule.enabled }).where(eq(rules.id, ruleId));
  revalidatePath("/dashboard/rules");
}

export async function deleteRule(ruleId: string) {
  const userId = await requireUserId();
  await db.delete(rules).where(and(eq(rules.id, ruleId), eq(rules.userId, userId)));
  revalidatePath("/dashboard/rules");
}

/** Deletes a saved AI chat conversation. */
export async function deleteChatThread(threadId: string) {
  const userId = await requireUserId();
  await db
    .delete(chatThreads)
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)));
  revalidatePath("/dashboard/chat");
}

/** Renames a saved AI chat conversation. */
export async function renameChatThread(threadId: string, title: string) {
  const userId = await requireUserId();
  const clean = title.trim().slice(0, 80);
  if (!clean) return;
  await db
    .update(chatThreads)
    .set({ title: clean })
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)));
  revalidatePath("/dashboard/chat");
}

/** Archives (or restores) an AI chat conversation without deleting it. */
export async function setChatThreadArchived(threadId: string, archived: boolean) {
  const userId = await requireUserId();
  await db
    .update(chatThreads)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)));
  revalidatePath("/dashboard/chat");
}

/** Compiles and sends a brief right now, outside the daily schedule. */
export async function sendBriefNow() {
  const userId = await requireUserId();
  await buildAndSendBrief(userId, { ignoreEnabled: true });
  revalidatePath("/dashboard/briefs");
}

/** Sets the daily send hour from the brief page's time chips (re-enables the brief too). */
export async function updateBriefHour(formData: FormData) {
  const userId = await requireUserId();
  const hour = Math.round(Number(formData.get("hour")));
  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return;

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const current = user?.preferences ?? DEFAULT_PREFERENCES;
  await db
    .update(users)
    .set({ preferences: { ...current, briefHour: hour, briefEnabled: true } })
    .where(eq(users.id, userId));
  revalidatePath("/dashboard/briefs");
  revalidatePath("/dashboard/settings");
}

const IMPORT_WINDOW_DAYS = 5;

/**
 * Imports the next older 5-day window of inbox mail for every connected
 * account, walking back from the oldest email already stored. Triage runs in
 * the background; results appear in the Inbox within a minute or two.
 */
export async function importOlderInbox() {
  const userId = await requireUserId();
  const accounts = await db.query.emailAccounts.findMany({
    where: and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, "active")),
  });

  for (const account of accounts) {
    const oldest = await db.query.messages.findFirst({
      where: eq(messages.accountId, account.id),
      orderBy: [asc(messages.receivedAt)],
      columns: { receivedAt: true },
    });
    // One-hour overlap pad; already-imported emails are deduped anyway.
    const beforeMs = (oldest?.receivedAt?.getTime() ?? Date.now()) + 60 * 60 * 1000;
    const afterMs = beforeMs - IMPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    await db
      .update(emailAccounts)
      .set({ backfillStartedAt: new Date() })
      .where(eq(emailAccounts.id, account.id));
    await inngest.send({
      name: "app/account.backfill",
      data: { accountId: account.id, afterMs, beforeMs },
    });
  }
  revalidatePath("/dashboard/inbox");
}


export async function addRuleTemplate(formData: FormData) {
  const userId = await requireUserId();
  const templateId = String(formData.get("templateId") ?? "");
  const domain = String(formData.get("domain") ?? "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");

  const template = RULE_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return;

  if (template.needsDomain) {
    if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) return;
  }

  const instruction =
    typeof template.instruction === "function"
      ? template.instruction(domain)
      : template.instruction;
  const parsed: ParsedRule =
    typeof template.parsed === "function" ? template.parsed(domain) : template.parsed;

  // Avoid duplicate identical instructions.
  const existing = await db.query.rules.findFirst({
    where: and(eq(rules.userId, userId), eq(rules.instruction, instruction)),
  });
  if (existing) {
    revalidatePath("/dashboard/rules");
    return;
  }

  await db.insert(rules).values({ userId, instruction, parsed });
  revalidatePath("/dashboard/rules");
}

/** Best-effort revocation of a Google refresh token so Wingman loses Gmail access at Google's side. */
async function revokeGoogleToken(refreshTokenEnc: string) {
  try {
    const token = decryptSecret(refreshTokenEnc);
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch {
    // Token may already be invalid/revoked; deletion proceeds regardless.
  }
}

export async function disconnectAccount(accountId: string) {
  const userId = await requireUserId();
  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  if (accounts.length <= 1) return; // keep at least one mailbox
  const target = accounts.find((a) => a.id === accountId);
  if (!target) return;

  await revokeGoogleToken(target.refreshTokenEnc);
  await db.delete(emailAccounts).where(and(eq(emailAccounts.id, accountId), eq(emailAccounts.userId, userId)));
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}

/**
 * GDPR-grade account deletion: cancels the subscription, revokes Gmail access at
 * Google's side, and removes every stored row (all tables cascade from users).
 */
export async function deleteAccount(formData: FormData) {
  const userId = await requireUserId();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) return;
  // The user must type their own email — a deliberate, hard-to-fat-finger confirmation.
  const confirm = String(formData.get("confirm") ?? "").trim().toLowerCase();
  if (confirm !== user.email.toLowerCase()) return;

  // Cancel any live subscription first so the user isn't billed again.
  // (Stripe today; swap for Paddle when the billing migration lands.)
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.userId, userId),
  });
  if (sub?.stripeSubscriptionId) {
    try {
      await getStripe().subscriptions.cancel(sub.stripeSubscriptionId);
    } catch {
      // Already canceled or billing not configured — don't block deletion.
    }
  }

  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  for (const account of accounts) {
    await revokeGoogleToken(account.refreshTokenEnc);
  }

  await db.delete(users).where(eq(users.id, userId));
  await signOut({ redirectTo: "/" });
}

/** Flips the weekly automatic voice retraining on or off. */
export async function toggleAutoRetrainVoice() {
  const userId = await requireUserId();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const current = user?.preferences ?? DEFAULT_PREFERENCES;
  await db
    .update(users)
    .set({
      preferences: { ...current, autoRetrainVoice: !(current.autoRetrainVoice ?? true) },
    })
    .where(eq(users.id, userId));
  revalidatePath("/dashboard/training");
}

export async function recategorizeMessage(formData: FormData) {
  const userId = await requireUserId();
  const messageId = String(formData.get("messageId") ?? "");
  const category = String(formData.get("category") ?? "");
  if (!messageId || !(CATEGORIES as readonly string[]).includes(category)) return;

  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  const row = await db.query.messages.findFirst({
    where: and(
      eq(messages.id, messageId),
      inArray(messages.accountId, accounts.map((a) => a.id)),
    ),
  });
  if (!row) return;
  const account = accounts.find((a) => a.id === row.accountId);
  if (!account) return;

  const next = category as Category;
  const labelMap = account.labelMap ?? {};
  const add: string[] = [];
  const remove: string[] = [];
  if (row.category && row.category !== next && labelMap[row.category]) {
    remove.push(labelMap[row.category]);
  }
  if (labelMap[next]) add.push(labelMap[next]);
  if (add.length || remove.length) {
    try {
      await applyLabels(getGmailClient(account.refreshTokenEnc), row.gmailMessageId, add, remove);
    } catch (err) {
      console.error("recategorize labels failed", err);
    }
  }

  await db.update(messages).set({ category: next }).where(eq(messages.id, row.id));

  const email =
    /<([^>]+)>/.exec(row.fromAddress ?? "")?.[1]?.toLowerCase() ??
    (row.fromAddress ?? "").toLowerCase();
  await forgetSenderCategory(userId, email);

  revalidatePath("/dashboard/inbox");
  revalidatePath("/dashboard");
}
