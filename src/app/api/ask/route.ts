import { NextResponse } from "next/server";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { auth } from "@/auth";
import { db, chatThreads, emailAccounts, messages, type ChatTurn } from "@/lib/db";
import { CATEGORY_NAMES } from "@/app/dashboard/categories";
import { askInbox } from "@/lib/ai";
import type { Category } from "@/lib/db";
import { consumeCredits } from "@/lib/usage";
import {
  isNeedsYouCategory,
  NEEDS_YOU_WINDOW_LABEL,
  needsYouSince,
} from "@/lib/needs-you";

/** How many past turns feed the model as conversation memory. */
const MEMORY_TURNS = 12;

/** "Ask AI about your inbox" — answers from stored metadata (never email bodies). */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const question = String(body?.question ?? "").trim();
  if (!question || question.length > 300) {
    return NextResponse.json({ error: "Ask a question (max 300 characters)." }, { status: 400 });
  }

  // Conversation memory comes from the saved thread, not from the client.
  const threadId = typeof body?.threadId === "string" ? body.threadId : null;
  const thread = threadId
    ? await db.query.chatThreads.findFirst({
        where: and(eq(chatThreads.id, threadId), eq(chatThreads.userId, userId)),
      })
    : null;
  const history: ChatTurn[] = (thread?.turns ?? [])
    .slice(-MEMORY_TURNS)
    .map((t) => ({ role: t.role, content: t.content.slice(0, 2000) }));

  const accounts = await db.query.emailAccounts.findMany({
    where: eq(emailAccounts.userId, userId),
  });
  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) {
    return NextResponse.json({ error: "No Gmail account connected." }, { status: 400 });
  }
  const emailById = new Map(accounts.map((a) => [a.id, a.email]));

  const since = new Date();
  since.setDate(since.getDate() - 14);

  const recent = await db.query.messages.findMany({
    where: and(inArray(messages.accountId, accountIds), gte(messages.receivedAt, since)),
    orderBy: [desc(messages.receivedAt)],
    limit: 80,
  });
  const needsYouCount = recent.filter(
    (m) =>
      isNeedsYouCategory(m.category as Category) &&
      m.summary &&
      m.receivedAt &&
      m.receivedAt >= needsYouSince(),
  ).length;

  if (!(await consumeCredits(userId, "ask"))) {
    return NextResponse.json(
      { error: "You're out of AI credits this month. Top up in Billing to keep asking." },
      { status: 402 },
    );
  }

  const lines = recent.map((m) => {
    const parts = [
      `[${m.category ? CATEGORY_NAMES[m.category as Category] : "Uncategorized"}]`,
      `from: ${m.fromAddress}`,
      `subject: ${m.subject || "(no subject)"}`,
      m.summary ? `summary: ${m.summary}` : null,
      m.receivedAt ? `received: ${m.receivedAt.toISOString().slice(0, 16)}` : null,
      m.draftId ? "reply draft ready in Gmail" : null,
      accounts.length > 1 ? `mailbox: ${emailById.get(m.accountId)}` : null,
    ].filter(Boolean);
    return `- ${parts.join(" | ")}`;
  });

  const answer = await askInbox({
    question,
    context: [
      `Canonical "needs you" count: ${needsYouCount} (${NEEDS_YOU_WINDOW_LABEL}; Money + Security + To Respond with a real summary). If the user asks how many emails need them, use this number and state the window.`,
      `Retrieval window for other questions: last 14 days, ${recent.length} rows (not the full mailbox).`,
      lines.join("\n") || "(no recent inbox data)",
    ].join("\n"),
    history,
  });

  // Persist the exchange so the user can revisit and continue the conversation.
  const newTurns: ChatTurn[] = [
    ...(thread?.turns ?? []),
    { role: "user", content: question },
    { role: "assistant", content: answer },
  ];
  let savedThreadId = thread?.id ?? null;
  if (thread) {
    await db
      .update(chatThreads)
      .set({ turns: newTurns, updatedAt: new Date() })
      .where(eq(chatThreads.id, thread.id));
  } else {
    const inserted = await db
      .insert(chatThreads)
      .values({ userId, title: question.slice(0, 80), turns: newTurns })
      .returning({ id: chatThreads.id });
    savedThreadId = inserted[0].id;
  }

  return NextResponse.json({ answer, threadId: savedThreadId });
}
