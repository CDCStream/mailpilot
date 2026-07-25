import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, rules } from "@/lib/db";
import { addRule, deleteRule, toggleRule } from "../actions";

export default async function RulesPage() {
  const session = await auth();
  const userRules = await db.query.rules.findMany({
    where: eq(rules.userId, session!.user.id),
    orderBy: rules.createdAt,
  });

  return (
    <div>
      <h1 className="text-2xl font-bold">Rules</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Write rules in plain English. Inbox Wingman converts them into filters applied during
        triage.
      </p>

      <form action={addRule} className="mt-8 flex gap-3">
        <input
          name="instruction"
          required
          maxLength={300}
          placeholder='e.g. "Archive all receipts", "Never draft replies to newsletters from acme.com"'
          className="flex-1 rounded-full border border-zinc-300 px-5 py-2.5 text-sm outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700"
        >
          Add rule
        </button>
      </form>

      {userRules.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">
          No rules yet. Try: &quot;Star anything from my domain&quot; or &quot;Archive cold
          emails immediately&quot;.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {userRules.map((rule) => (
            <li
              key={rule.id}
              className={`flex items-center gap-4 rounded-2xl border p-4 ${
                rule.enabled ? "border-zinc-200" : "border-zinc-100 opacity-60"
              }`}
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{rule.instruction}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{rule.parsed.description}</p>
              </div>
              <form
                action={async () => {
                  "use server";
                  await toggleRule(rule.id);
                }}
              >
                <button type="submit" className="text-xs font-medium text-zinc-500 hover:text-zinc-900">
                  {rule.enabled ? "Disable" : "Enable"}
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await deleteRule(rule.id);
                }}
              >
                <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
