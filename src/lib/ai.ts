import OpenAI from "openai";
import { z } from "zod";
import {
  CATEGORIES,
  type Category,
  type ParsedRule,
  type VoiceProfile,
} from "@/lib/db/schema";

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
  const res = await openaiClient().chat.completions.create({
    model,
    response_format: { type: "json_object" },
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
  summary: z.string(),
});

export type Classification = z.infer<typeof classificationSchema>;

const CLASSIFY_SYSTEM = `You are an expert executive assistant triaging a professional's inbox.
Classify the email into exactly one category:
- "to_respond": a real person is asking the user something, expects a reply, or the thread needs the user's action.
- "fyi": relevant human correspondence that requires no reply (confirmations from known contacts, cc'd threads, status updates).
- "newsletter": editorial content the user subscribed to (digests, publications, blogs).
- "marketing": promotional email from companies (sales, offers, product announcements).
- "notification": automated transactional messages (receipts, alerts, calendar, shipping, security codes, invoices).
- "cold_email": unsolicited outreach from a stranger trying to sell or pitch something.

Also return "needs_reply" (true only for to_respond) and a one-sentence "summary" of the email.
Respond with JSON: {"category": ..., "needs_reply": ..., "summary": ...}`;

export async function classifyEmail(input: {
  from: string;
  to: string;
  subject: string;
  bodyExcerpt: string;
}): Promise<Classification> {
  const user = `From: ${input.from}\nTo: ${input.to}\nSubject: ${input.subject}\n\nBody (excerpt):\n${input.bodyExcerpt.slice(0, 1500)}`;
  try {
    return await jsonCompletion(CLASSIFY_MODEL, CLASSIFY_SYSTEM, user, classificationSchema);
  } catch {
    // Fail safe: keep the email visible rather than mis-filing it.
    return { category: "fyi", needs_reply: false, summary: input.subject };
  }
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
  const profile = input.voiceProfile
    ? JSON.stringify(input.voiceProfile)
    : "No profile yet; write neutral, warm, professional.";

  const res = await openaiClient().chat.completions.create({
    model: DRAFT_MODEL,
    messages: [
      {
        role: "system",
        content: `You draft email replies on behalf of ${input.userName}. You write exactly in their voice, based on this style profile:
${profile}
${input.toneInstructions ? `Extra instructions from the user: ${input.toneInstructions}` : ""}

Rules:
- Write ONLY the reply body as plain text. No subject line, no commentary, no placeholders like [Name] unless unavoidable.
- Match the language of the incoming email.
- Be concise and directly address what the sender asked.
- If a decision or information only the user can provide is needed, write the reply around it naturally but keep it easy to edit.
- Use the greeting and sign-off style from the profile.`,
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

// ---------- Brief summarization ----------

export async function summarizeForBrief(items: string[]): Promise<string> {
  if (items.length === 0) return "";
  const res = await openaiClient().chat.completions.create({
    model: CLASSIFY_MODEL,
    messages: [
      {
        role: "system",
        content:
          "Summarize these inbox items into a short, scannable morning briefing (3-6 bullet points max, plain text, no markdown headers). Prioritize what needs action.",
      },
      { role: "user", content: items.join("\n") },
    ],
  });
  return res.choices[0]?.message?.content?.trim() ?? "";
}

export function isValidCategory(value: string): value is Category {
  return (CATEGORIES as readonly string[]).includes(value);
}
