"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { requireUserId } from "@/auth";
import {
  db,
  emailAccounts,
  followups,
  rules,
  users,
  DEFAULT_PREFERENCES,
  type UserPreferences,
} from "@/lib/db";
import { buildVoiceProfile, parseRule } from "@/lib/ai";
import { getGmailClient, listRecentSentTexts } from "@/lib/gmail";

export async function updatePreferences(formData: FormData) {
  const userId = await requireUserId();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const current = user?.preferences ?? DEFAULT_PREFERENCES;

  const next: UserPreferences = {
    ...current,
    archiveLowPriority: formData.get("archiveLowPriority") === "on",
    draftsEnabled: formData.get("draftsEnabled") === "on",
    briefEnabled: formData.get("briefEnabled") === "on",
    briefHour: Math.min(23, Math.max(0, Number(formData.get("briefHour") ?? current.briefHour))),
    timezone: String(formData.get("timezone") || current.timezone),
    toneInstructions: String(formData.get("toneInstructions") ?? "").slice(0, 500),
    followUpDays: Math.min(
      14,
      Math.max(1, Number(formData.get("followUpDays") ?? current.followUpDays)),
    ),
  };

  await db.update(users).set({ preferences: next }).where(eq(users.id, userId));
  revalidatePath("/dashboard/settings");
}

export async function addRule(formData: FormData) {
  const userId = await requireUserId();
  const instruction = String(formData.get("instruction") ?? "").trim();
  if (!instruction || instruction.length > 300) return;

  const parsed = await parseRule(instruction);
  await db.insert(rules).values({ userId, instruction, parsed });
  revalidatePath("/dashboard/rules");
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

export async function dismissFollowup(followupId: string) {
  const userId = await requireUserId();
  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return;

  await db
    .update(followups)
    .set({ status: "dismissed" })
    .where(and(eq(followups.id, followupId), inArray(followups.accountId, accountIds)));
  revalidatePath("/dashboard/followups");
}

export async function rebuildVoiceProfile() {
  const userId = await requireUserId();
  const account = await db.query.emailAccounts.findFirst({
    where: and(eq(emailAccounts.userId, userId), eq(emailAccounts.status, "active")),
  });
  if (!account) return;

  const gmail = getGmailClient(account.refreshTokenEnc);
  const samples = await listRecentSentTexts(gmail, account.email, 40);
  const profile = await buildVoiceProfile(samples);
  await db.update(users).set({ voiceProfile: profile }).where(eq(users.id, userId));
  revalidatePath("/dashboard/settings");
}
