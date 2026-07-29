import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** Triage categories applied as Gmail labels. */
export const CATEGORIES = [
  "to_respond",
  "fyi",
  "newsletter",
  "marketing",
  "notification",
  "cold_email",
] as const;
export type Category = (typeof CATEGORIES)[number];

export type VoiceProfile = {
  greetingStyle: string;
  signOff: string;
  tone: string;
  formality: string;
  averageLength: string;
  quirks: string[];
  languages: string[];
};

/**
 * What stays in the inbox after labeling:
 * focus = only To Respond + FYI stay; quiet = junk archived, notifications stay;
 * label_only = nothing is moved; custom = user picks categories per toggle.
 */
export type InboxMode = "focus" | "quiet" | "label_only" | "custom";

/** Categories archived out of the inbox for each preset mode. */
export const INBOX_MODE_ARCHIVE: Record<InboxMode, Category[]> = {
  focus: ["newsletter", "marketing", "notification", "cold_email"],
  quiet: ["newsletter", "marketing", "cold_email"],
  label_only: [],
  custom: [], // resolved from prefs.archiveCategories instead
};

/** When reply drafts are generated: every reply-worthy email, urgent ones only, or only on manual request. */
export type DraftStyle = "everything" | "important_only" | "manual";

/** Self-described role picked during onboarding; used for smarter defaults. */
export type Persona = "founder" | "agency" | "sales" | "support" | "personal";

/** Canned tone presets offered during onboarding. */
export type TonePreset = "warm" | "direct" | "formal" | "playful";

/** Draft-prompt instructions seeded by each tone preset. */
export const TONE_PRESET_INSTRUCTIONS: Record<TonePreset, string> = {
  warm: "Write in a warm, friendly tone. Be considerate and personable while staying professional.",
  direct:
    "Keep replies short, direct and to the point. No filler; only a brief greeting and the answer.",
  formal:
    "Write in a polished, formal business tone. Full sentences, courteous and precise, no slang.",
  playful:
    "Write in a light, upbeat tone. Friendly and a little informal, but still clear and professional.",
};

/** Language the AI writes email summaries (and the daily brief digest) in. */
export const SUMMARY_LANGUAGES = {
  auto: "Match each email's language",
  en: "English",
  tr: "Türkçe",
  de: "Deutsch",
  fr: "Français",
  es: "Español",
  pt: "Português",
  it: "Italiano",
  nl: "Nederlands",
} as const;

export type SummaryLanguage = keyof typeof SUMMARY_LANGUAGES;

export type UserPreferences = {
  /** Legacy flag superseded by inboxMode; kept because stored rows may predate it. */
  archiveLowPriority: boolean;
  /** Missing on old rows — read via resolveInboxMode(). */
  inboxMode?: InboxMode;
  /** Categories archived when inboxMode === "custom". */
  archiveCategories?: Category[];
  /** Skip triage for emails the user already labeled themselves (default true). */
  respectUserLabels?: boolean;
  /** Draft every reply-worthy email, or only urgent ones (default "everything"). */
  draftStyle?: DraftStyle;
  /** Delete unused Wingman drafts after N days; 0 disables (default 14). */
  draftCleanupDays?: number;
  /** Self-described role from onboarding. */
  persona?: Persona;
  /** Tone preset chosen in onboarding; its instructions seed toneInstructions. */
  tonePreset?: TonePreset;
  /** Language for AI summaries and the daily brief digest (default "en"). */
  summaryLanguage?: SummaryLanguage;
  /** Auto-create reply drafts for "To Respond" emails. */
  draftsEnabled: boolean;
  briefEnabled: boolean;
  /** Local hour (0-23) at which the daily brief is sent. */
  briefHour: number;
  /** IANA timezone, e.g. "Europe/Istanbul". */
  timezone: string;
  /** Weekly automatic voice-profile retraining from recent sent replies (default true). */
  autoRetrainVoice?: boolean;
  /** Extra free-form tone instructions appended to draft prompts. */
  toneInstructions: string;
};

export function resolveInboxMode(
  prefs: Pick<UserPreferences, "archiveLowPriority" | "inboxMode">,
): InboxMode {
  return prefs.inboxMode ?? (prefs.archiveLowPriority ? "quiet" : "label_only");
}

/** The effective set of categories to archive for this user. */
export function archiveSetFor(
  prefs: Pick<UserPreferences, "archiveLowPriority" | "inboxMode" | "archiveCategories">,
): Category[] {
  const mode = resolveInboxMode(prefs);
  return mode === "custom" ? (prefs.archiveCategories ?? []) : INBOX_MODE_ARCHIVE[mode];
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  archiveLowPriority: false,
  inboxMode: "label_only",
  archiveCategories: [],
  respectUserLabels: true,
  draftStyle: "everything",
  summaryLanguage: "en",
  draftCleanupDays: 14,
  draftsEnabled: true,
  briefEnabled: true,
  briefHour: 8,
  timezone: "UTC",
  autoRetrainVoice: true,
  toneInstructions: "",
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  voiceProfile: jsonb("voice_profile").$type<VoiceProfile | null>(),
  preferences: jsonb("preferences").$type<UserPreferences>(),
  /** Purchased top-up credits that never expire (spent after plan allowance). */
  bonusCredits: integer("bonus_credits").notNull().default(0),
  onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const emailAccounts = pgTable(
  "email_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("gmail"),
    email: text("email").notNull(),
    /** AES-256-GCM encrypted Google refresh token. */
    refreshTokenEnc: text("refresh_token_enc").notNull(),
    /** Gmail label name -> label id map, created during onboarding. */
    labelMap: jsonb("label_map").$type<Record<string, string> | null>(),
    lastHistoryId: text("last_history_id"),
    /** Expiry of the Gmail push notification watch (renewed daily, valid ~7 days). */
    watchExpiration: timestamp("watch_expiration", { withTimezone: true }),
    status: text("status").notNull().default("active"), // active | error | disconnected
    lastError: text("last_error"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    /** Set while a historical import (initial 5 days / "import more") runs; null when done. */
    backfillStartedAt: timestamp("backfill_started_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("email_accounts_user_email_idx").on(t.userId, t.email)],
);

export type MessageActions = {
  labeled?: string;
  archived?: boolean;
  draftCreated?: boolean;
  ruleApplied?: string;
};

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => emailAccounts.id, { onDelete: "cascade" }),
    gmailMessageId: text("gmail_message_id").notNull(),
    threadId: text("thread_id").notNull(),
    fromAddress: text("from_address"),
    subject: text("subject"),
    snippet: text("snippet"),
    category: text("category").$type<Category>(),
    summary: text("summary"),
    actions: jsonb("actions").$type<MessageActions>(),
    draftId: text("draft_id"),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("messages_account_message_idx").on(t.accountId, t.gmailMessageId)],
);

export type RuleCondition = {
  field: "from" | "domain" | "subject" | "body" | "category";
  op: "contains" | "equals" | "is";
  value: string;
};

export type RuleAction = {
  type: "set_category" | "archive" | "skip_draft" | "star" | "keep_in_inbox";
  value?: string;
};

export type ParsedRule = {
  conditions: RuleCondition[];
  actions: RuleAction[];
  description: string;
};

export const rules = pgTable("rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  instruction: text("instruction").notNull(),
  parsed: jsonb("parsed").$type<ParsedRule>().notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** Saved "Ask your inbox" conversations, so users can revisit and continue them. */
export const chatThreads = pgTable("chat_threads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  turns: jsonb("turns").$type<ChatTurn[]>().notNull(),
  /** Archived conversations are hidden from the main history list, not deleted. */
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Sent daily briefs, stored so the user can re-read them in the dashboard. */
export const briefs = pgTable("briefs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  html: text("html").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull().default("none"), // trialing | active | past_due | canceled | none
  /** pilot | wingman */
  plan: text("plan"),
  priceId: text("price_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Legacy daily counters (kept for historical rows; new spend uses credit_usage). */
export const usageCounters = pgTable(
  "usage_counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: text("day").notNull(), // YYYY-MM-DD (UTC)
    classifications: integer("classifications").notNull().default(0),
    drafts: integer("drafts").notNull().default(0),
  },
  (t) => [uniqueIndex("usage_user_day_idx").on(t.userId, t.day)],
);

/** Monthly AI credit spend (UTC calendar month). */
export const creditUsage = pgTable(
  "credit_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    period: text("period").notNull(), // YYYY-MM
    creditsUsed: integer("credits_used").notNull().default(0),
  },
  (t) => [uniqueIndex("credit_usage_user_period_idx").on(t.userId, t.period)],
);

/** One-time credit top-up purchases (idempotency via Stripe session id). */
export const creditTopups = pgTable(
  "credit_topups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stripeSessionId: text("stripe_session_id").notNull().unique(),
    packId: text("pack_id").notNull(),
    credits: integer("credits").notNull(),
    amountCents: integer("amount_cents").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("credit_topups_session_idx").on(t.stripeSessionId)],
);
