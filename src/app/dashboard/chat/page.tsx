import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUserId } from "@/auth";
import { db, chatThreads } from "@/lib/db";
import { CREDIT_COSTS } from "@/lib/plans";
import { InboxChat } from "./chat-client";
import { ThreadItem } from "./thread-item";

function threadDate(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const userId = await requireUserId();
  const { t } = await searchParams;

  const threads = await db.query.chatThreads.findMany({
    where: eq(chatThreads.userId, userId),
    orderBy: [desc(chatThreads.updatedAt)],
    limit: 50,
  });
  const active = threads.filter((th) => !th.archivedAt);
  const archived = threads.filter((th) => th.archivedAt);
  const selected = t ? threads.find((th) => th.id === t) : undefined;

  return (
    <div className="flex w-full flex-col px-6 py-8 lg:h-dvh lg:px-10">
      <h1 className="text-2xl font-bold">AI Chat</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Talk to your whole inbox — follow-up questions welcome. Answers come from your triaged
        mail, never invented ({CREDIT_COSTS.ask} credits per question).
      </p>

      <div className="mt-6 grid min-h-[65vh] flex-1 gap-4 lg:min-h-0 lg:grid-cols-[250px_minmax(0,1fr)]">
        {/* Past conversations */}
        <aside className="hidden min-h-0 flex-col lg:flex">
          <Link
            href="/dashboard/chat"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            New chat
          </Link>

          <p className="mt-5 text-[11px] font-semibold uppercase tracking-widest text-zinc-400">
            History
          </p>
          <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {active.length === 0 && (
              <p className="rounded-xl border border-dashed border-zinc-200 p-4 text-xs text-zinc-400">
                Past conversations will show up here.
              </p>
            )}
            {active.map((th) => (
              <ThreadItem
                key={th.id}
                id={th.id}
                title={th.title}
                dateLabel={threadDate(th.updatedAt)}
                selected={selected?.id === th.id}
                archived={false}
              />
            ))}

            {archived.length > 0 && (
              <details className="pt-2">
                <summary className="cursor-pointer list-none px-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-400 hover:text-zinc-600">
                  Archived ({archived.length})
                </summary>
                <div className="mt-1 space-y-1">
                  {archived.map((th) => (
                    <ThreadItem
                      key={th.id}
                      id={th.id}
                      title={th.title}
                      dateLabel={threadDate(th.updatedAt)}
                      selected={selected?.id === th.id}
                      archived
                    />
                  ))}
                </div>
              </details>
            )}
          </div>
        </aside>

        {/* Conversation — keyed so switching threads resets the client state */}
        <div className="flex min-h-0 flex-col">
          <InboxChat
            key={selected?.id ?? "new"}
            threadId={selected?.id}
            initialTurns={selected?.turns ?? []}
          />
        </div>
      </div>
    </div>
  );
}
