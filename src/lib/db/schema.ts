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

export type UserPreferences = {
  /** Archive newsletter/marketing/cold-email out of the inbox after labeling. */
  archiveLowPriority: boolean;
  /** Auto-create reply drafts for "To Respond" emails. */
  draftsEnabled: boolean;
  briefEnabled: boolean;
  /** Local hour (0-23) at which the daily brief is sent. */
  briefHour: number;
  /** IANA timezone, e.g. "Europe/Istanbul". */
  timezone: string;
  /** Extra free-form tone instructions appended to draft prompts. */
  toneInstructions: string;
  /** Days to wait before flagging an unanswered sent email. */
  followUpDays: number;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  archiveLowPriority: false,
  draftsEnabled: true,
  briefEnabled: true,
  briefHour: 8,
  timezone: "UTC",
  toneInstructions: "",
  followUpDays: 3,
};

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  voiceProfile: jsonb("voice_profile").$type<VoiceProfile | null>(),
  preferences: jsonb("preferences").$type<UserPreferences>(),
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

export const followups = pgTable(
  "followups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => emailAccounts.id, { onDelete: "cascade" }),
    threadId: text("thread_id").notNull(),
    subject: text("subject"),
    toRecipients: text("to_recipients"),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("waiting"), // waiting | due | replied | dismissed
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("followups_account_thread_idx").on(t.accountId, t.threadId)],
);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id"),
  status: text("status").notNull().default("none"), // trialing | active | past_due | canceled | none
  priceId: text("price_id"),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Per-user daily counters used to cap LLM spend. */
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
