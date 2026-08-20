import OpenAI from "openai";
import { z } from "zod";
import {
  CATEGORIES,
  type Category,
  type ParsedRule,
  type SummaryLanguage,
  type VoiceProfile,
} from "@/lib/db/schema";

/** English names the model understands, for the summary-language instruction. */
const LANGUAGE_NAMES: Record<Exclude<SummaryLanguage, "auto">, string> = {
  en: "English",
  tr: "Turkish",
  de: "German",
  fr: "French",
  es: "Spanish",
  pt: "Portuguese",
  it: "Italian",
  nl: "Dutch",
};

function languageInstruction(lang: SummaryLanguage | undefined, what: string): string {
  if (!lang || lang === "en") return "";
  if (lang === "auto") return `\nWrite ${what} in the same language as the email itself.`;
  return `\nWrite ${what} in ${LANGUAGE_NAMES[lang]}, regardless of the email's language.`;
}

let openaiSingleton: OpenAI | null = null;

function openaiClient(): OpenAI {
  if (!openaiSingleton) {
    openaiSingleton = new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "sk-placeholder" });
  }
  return openaiSingleton;
}

const CLASSIFY_MODEL = process.env.OPENAI_CLASSIFY_MODEL || "gpt-5-mini";
const DRAFT_MODEL = process.env.OPENAI_DRAFT_MODEL || "gpt-5";

async function jsonCompletion<T>(
  model: string,
  system: string,
  user: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const reasoningModel = /^(gpt-5|o[1-9])/i.test(model);
  const res = await openaiClient().chat.completions.create({
    model,
    response_format: { type: "json_object" },
    ...(reasoningModel ? {} : { temperature: 0 }),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const raw = res.choices[0]?.message?.content ?? "{}";
  return schema.parse(JSON.parse(raw));
}

// ---------- Classification ----------

const classificationSchema = z.object({
  category: z.enum(CATEGORIES),
  needs_reply: z.boolean(),
  urgent: z.boolean().catch(false),
  summary: z.string().nullable().catch(null),
});

export type Classification = {
  category: Category;
  needs_reply: boolean;
  urgent: boolean;
  /** Null when the model/body failed — never invent an "action needed" line. */
  summary: string | null;
};

export const CLASSIFY_SYSTEM = `You are an expert assistant triaging a technical founder's inbox (CI, GitHub, Sentry, SaaS alerts, plus real human mail).
Classify the email into exactly one category:
- "to_respond": a REAL PERSON is asking the user something and expects a written email reply, or a human is waiting (e.g. GitHub review requested). NEVER for no-reply@, notifications@, newsletters, promotions, invoices, or the user's own tools emailing them.
- "fyi": relevant human correspondence that requires no reply (confirmations from known contacts, cc'd threads, status updates).
- "newsletter": editorial content the user subscribed to (digests, publications, blogs). Has informational takeaways. Example: "AlphaSignal <news@alphasignal.ai> — Today's AI briefing".
- "marketing": promotional email — sales, discounts, course launches, webinars, product pitches. Platform instructor promos (Udemy, Coursera) are ALWAYS marketing, never notification or to_respond. Examples: Netflix "new shows", Adobe "50% off", Udemy "5 Days Only: Lowest Prices", Cambly "book now and save".
- "notification": automated operational messages that are NOT money and NOT security (shipping, calendar, CI success, LinkedIn invites, "your export is ready").
- "money": payments, failed charges, invoices, receipts, subscription renewals, payouts, card expiry. Sources: Stripe, Cursor, Ahrefs, Vercel billing, banks. Example: "Cursor — $100.36 payment was unsuccessful".
- "security": ONLY events about the user's OWN account — sign-in, 2FA/MFA change, password or token change, new device or key, access-token expiry, provider security advisory. Example: "Vercel — New sign-in detected on your Vercel account", "[npm] Two-factor authentication disabled". NEVER a job posting, newsletter, or marketing email that happens to contain the word "security". Negative example: LinkedIn Job Alerts — "Security Architecture Professionals at Trendyol Group" is NOTIFICATION, not security.
- "cold_email": unsolicited outreach from a stranger trying to sell or pitch something.

Disambiguation (worked examples):
- Udemy instructor "on SALE" / coupon / bundle → marketing (not notification, not to_respond).
- Netflix / Adobe promo → marketing. Cambly / Udemy promo → marketing. Same intent, same label.
- Morning briefing / editorial digest with no CTA to buy → newsletter.
- "Payment unsuccessful" / invoice / renewal → money (outranks notification).
- "2FA disabled" / "security key added" / "tokens expiring" / "New sign-in detected on your Vercel account" → security (outranks notification).
- LinkedIn Job Alerts ("Security Architecture Professionals at Trendyol Group", "Data Scientist at Rollic") → notification. Classify on sender intent, not job-title keywords.
- A person wrote from a personal or company mailbox asking a question → to_respond.
- A human support agent replying on a thread the user opened (e.g. Captapi Support <support@captapi.com> "Re: tiktok-transcript timed out") → to_respond, not fyi.

Also return:
- "needs_reply": true ONLY when a human expects a written email reply. False for bots, noreply@, e-sign portals, ticket assignments, CI/Sentry alerts — even if the user must act in another app.
- "urgent": true only when the email needs a reply AND is time-sensitive or high-stakes (deadline, waiting client/boss, deal at risk, explicit ASAP). Routine questions are not urgent.
- "summary": one sentence describing the email. Never claim the user must act unless the body clearly says so. If the body is empty or you cannot summarize, return null.
Respond with JSON: {"category": ..., "needs_reply": ..., "urgent": ..., "summary": ...}`;

export async function classifyEmail(input: {
  from: string;
  to: string;
  subject: string;
  bodyExcerpt: string;
  summaryLanguage?: SummaryLanguage;
  messageId?: string;
}): Promise<Classification> {
  const system = CLASSIFY_SYSTEM + languageInstruction(input.summaryLanguage, 'the "summary"');
  const excerpt = input.bodyExcerpt.trim();
  const user = `From: ${input.from}\nTo: ${input.to}\nSubject: ${input.subject}\n\nBody (excerpt):\n${excerpt.slice(0, 1500) || "(empty)"}`;
  try {
    const result = await jsonCompletion(CLASSIFY_MODEL, system, user, classificationSchema);
    const summary = result.summary?.trim() ? result.summary.trim() : null;
    return { ...result, summary };
  } catch (err) {
    return handleClassifyFailure({
      messageId: input.messageId ?? null,
      from: input.from,
      subject: input.subject,
      bodyEmpty: excerpt.length === 0,
      error: err,
    });
  }
}

/** Logged, null-summary fallback. Never asserts that the user must act. */
export function handleClassifyFailure(input: {
  messageId: string | null;
  from: string;
  subject: string;
  bodyEmpty: boolean;
  error: unknown;
}): Classification {
  const cause = input.error instanceof Error ? input.error.message : String(input.error);
  console.error("classifyEmail failed", {
    messageId: input.messageId,
    from: input.from,
    subject: input.subject,
    bodyEmpty: input.bodyEmpty,
    error: cause,
  });
  return { category: "fyi", needs_reply: false, urgent: false, summary: null };
}

// ---------- Voice profile ----------

const voiceProfileSchema = z.object({
  greetingStyle: z.string(),
  signOff: z.string(),
  tone: z.string(),
  formality: z.string(),
  averageLength: z.string(),
  quirks: z.array(z.string()),
  languages: z.array(z.string()),
});

export async function buildVoiceProfile(
  sentSamples: { subject: string; body: string }[],
): Promise<VoiceProfile> {
  const samples = sentSamples
    .slice(0, 30)
    .map((s, i) => `--- Sample ${i + 1} ---\nSubject: ${s.subject}\n${s.body}`)
    .join("\n\n");

  return jsonCompletion(
    CLASSIFY_MODEL,
    `You analyze a person's sent emails and produce a concise writing-style profile used to draft replies in their voice.
Respond with JSON: {"greetingStyle": string, "signOff": string, "tone": string, "formality": string, "averageLength": string, "quirks": string[], "languages": string[]}.
Be specific and quote their actual habits (e.g. greetingStyle: "Hi <first name>," / signOff: "Best,\\nJohn").`,
    samples || "No samples available. Return a neutral professional profile.",
    voiceProfileSchema,
  );
}

// ---------- Draft generation ----------

export async function generateReplyDraft(input: {
  userName: string;
  voiceProfile: VoiceProfile | null;
  toneInstructions: string;
  from: string;
  subject: string;
  bodyExcerpt: string;
  summary: string;
}): Promise<string> {
  // Voice profile wins over onboarding presets. Without a profile, default terse
  // (technical-founder default) rather than warm corporate.
  const profile = input.voiceProfile
    ? JSON.stringify(input.voiceProfile)
    : "No profile yet; write terse, direct, technical. Skip fluff greetings and sign-offs unless the thread clearly needs them.";

  const toneLine =
    !input.voiceProfile && input.toneInstructions
      ? `Tone instructions: ${input.toneInstructions}`
      : input.voiceProfile
        ? "Follow the voice profile above exactly — it overrides any generic tone preset."
        : "";

  const res = await openaiClient().chat.completions.create({
    model: DRAFT_MODEL,
    messages: [
      {
        role: "system",
        content: `You draft email replies on behalf of ${input.userName}. You write exactly in their voice, based on this style profile:
${profile}
${toneLine}

Rules:
- Write ONLY the reply body as plain text. No subject line, no commentary, no placeholders like [Name] unless unavoidable.
- Match the language of the incoming email.
- Be concise and directly address what the sender asked.
- If a decision or information only the user can provide is needed, write the reply around it naturally but keep it easy to edit.
- Use the greeting and sign-off style from the profile (including "none").`,
      },
      {
        role: "user",
        content: `Incoming email:\nFrom: ${input.from}\nSubject: ${input.subject}\n\n${input.bodyExcerpt}\n\n(One-line summary: ${input.summary})\n\nDraft the reply now.`,
      },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

// ---------- Natural-language rules ----------

const parsedRuleSchema = z.object({
  conditions: z.array(
    z.object({
      field: z.enum(["from", "domain", "subject", "body", "category"]),
      op: z.enum(["contains", "equals", "is"]),
      value: z.string(),
    }),
  ),
  actions: z.array(
    z.object({
      type: z.enum(["set_category", "archive", "skip_draft", "star", "keep_in_inbox"]),
      value: z.string().optional(),
    }),
  ),
  description: z.string(),
});

export async function parseRule(instruction: string): Promise<ParsedRule> {
  return jsonCompletion(
    CLASSIFY_MODEL,
    `Convert a natural-language email rule into structured JSON.
Fields: from (sender address), domain (sender domain), subject, body, category (one of: ${CATEGORIES.join(", ")}).
Ops: contains, equals, is. Conditions are ANDed.
Actions: set_category (value = category), archive, skip_draft, star, keep_in_inbox.
Also produce a short human-readable "description".
Respond with JSON: {"conditions": [...], "actions": [...], "description": "..."}.
Example: "Archive invoices and label them as notifications" ->
{"conditions":[{"field":"subject","op":"contains","value":"invoice"}],"actions":[{"type":"set_category","value":"notification"},{"type":"archive"}],"description":"Archive emails mentioning invoices and categorize as Notification"}`,
    instruction,
    parsedRuleSchema,
  );
}

// ---------- Ask your inbox ----------

/** Answers a free-form question using stored inbox metadata (no email bodies). */
export async function askInbox(input: {
  question: string;
  context: string;
  /** Previous chat turns, oldest first, so follow-up questions keep their context. */
  history?: { role: "user" | "assistant"; content: string }[];
}): Promise<string> {
  const res = await openaiClient().chat.completions.create({
    model: CLASSIFY_MODEL,
    messages: [
      {
        role: "system",
        content: `You are the user's inbox assistant. Answer their question using ONLY the inbox data provided (sender, subject, category, one-line summary, dates, draft status).
Rules:
- Answer in the same language as the question.
- If the data doesn't contain the answer, say you don't see it in the recent inbox data — never invent emails.
- Dates in the data are ISO format; phrase them naturally (e.g. "yesterday", "on Jul 22").

Formatting (light markdown, keep it scannable):
- Start with one short sentence that directly answers the question (e.g. a count or yes/no) — no heading.
- When listing more than ~3 emails, group them under short bold headers like **Needs your reply (2)** or **Notifications (6)** instead of one long flat list.
- Bullets look like: - **Sender** — subject (date). Add the one-line summary only when it helps.
- Use the human category names exactly as given in the data (e.g. "To Respond", "Notification") — never raw codes like to_respond.
- No tables, no nested lists, no headings other than bold lines. Keep the whole answer compact.

Inbox data (most recent first):
${input.context}`,
      },
      ...(input.history ?? []).slice(-8),
      { role: "user", content: input.question },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

// ---------- Brief summarization ----------

const briefDigestSchema = z.object({
  overview: z.string().catch(""),
  newsletterHighlights: z.array(z.string()).catch([]),
  deadlines: z.array(z.string()).catch([]),
  logistics: z.array(z.string()).catch([]),
});

export type BriefDigest = z.infer<typeof briefDigestSchema>;

const BRIEF_DIGEST_SYSTEM = `You compile a morning email briefing. You get four groups of inbox items (one-line each): OBLIGATIONS (money + security), CORRESPONDENCE (real people), NEWSLETTERS (editorial/marketing), NOTIFICATIONS (other automated mail).

Produce JSON with:
- "overview": 2-4 plain-text bullet lines (each starting with "• ") summarizing what matters most. Lead with OBLIGATIONS (failed payments, security events), then CORRESPONDENCE. Never mention Inbox Wingman's own brief emails. Empty string if nothing notable.
- "newsletterHighlights": up to 5 short takeaways from NEWSLETTERS. Sales, webinars, surveys, and free-trial countdowns belong HERE, not in deadlines. Empty array if none.
- "deadlines": ONLY dates where the user faces a consequence — money moves, access is lost, a service degrades, or a person is waiting. Examples that QUALIFY: failed payment, token/2FA expiry, subscription renewal they must act on, a human's deadline. Examples that do NOT qualify: a sale ending, a webinar, a survey, a workshop, a BOGO code, "free access ends". Empty array if none.
- "logistics": bills, receipts, order and delivery updates (e.g. "Amazon order arriving today", "Ahrefs renews Aug 26, Visa 1942"). Empty array if none.

Rules: plain text only, no markdown. Never invent items. Keep every line under 140 characters.`;

export async function buildBriefDigest(input: {
  correspondence: string[];
  newsletters: string[];
  notifications: string[];
  obligations?: string[];
  summaryLanguage?: SummaryLanguage;
}): Promise<BriefDigest> {
  // "auto" makes no sense for a digest spanning many emails; fall back to English.
  const lang = input.summaryLanguage === "auto" ? "en" : input.summaryLanguage;
  const system = BRIEF_DIGEST_SYSTEM + languageInstruction(lang, "every output field");
  const section = (title: string, items: string[]) =>
    `${title}:\n${items.length ? items.join("\n") : "(none)"}`;
  const user = [
    section("OBLIGATIONS", (input.obligations ?? []).slice(0, 25)),
    section("CORRESPONDENCE", input.correspondence.slice(0, 25)),
    section("NEWSLETTERS", input.newsletters.slice(0, 25)),
    section("NOTIFICATIONS", input.notifications.slice(0, 25)),
  ].join("\n\n");

  try {
    return await jsonCompletion(CLASSIFY_MODEL, system, user, briefDigestSchema);
  } catch {
    return { overview: "", newsletterHighlights: [], deadlines: [], logistics: [] };
  }
}

export function isValidCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
