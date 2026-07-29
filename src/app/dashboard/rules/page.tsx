import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, rules } from "@/lib/db";
import { RULE_TEMPLATES } from "@/lib/rule-templates";
import { addRule, addRuleTemplate, deleteRule, toggleRule } from "../actions";

export default async function RulesPage() {
  const session = await auth();
  const userRules = await db.query.rules.findMany({
    where: eq(rules.userId, session!.user.id),
    orderBy: rules.createdAt,
  });
  const existingInstructions = new Set(userRules.map((r) => r.instruction));

  return (
    <div className="w-full px-6 py-10 lg:px-10">
      <h1 className="text-2xl font-bold">Rules</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Write rules in plain English, or start from a template. Applied during every triage.
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-zinc-900">Quick templates</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {RULE_TEMPLATES.map((t) => {
            const sampleInstruction =
              typeof t.instruction === "function" ? t.instruction("acme.com") : t.instruction;
            const already =
              !t.needsDomain &&
              (existingInstructions.has(sampleInstruction) ||
                userRules.some((r) => r.instruction === sampleInstruction));

            return (
              <form
                key={t.id}
                action={addRuleTemplate}
                className="rounded-2xl border border-zinc-200 p-4"
              >
                <input type="hidden" name="templateId" value={t.id} />
                <p className="text-sm font-medium">{t.title}</p>
                <p className="mt-1 text-xs text-zinc-500">{t.blurb}</p>
                {t.needsDomain ? (
                  <div className="mt-3 flex gap-2">
                    <input
                      name="domain"
                      required
                      placeholder="acme.com"
                      pattern="[A-Za-z0-9.-]+\.[A-Za-z]{2,}"
                      className="min-w-0 flex-1 rounded-full border border-zinc-300 px-3 py-1.5 text-xs outline-none focus:border-teal-600"
                    />
                    <button
                      type="submit"
                      className="shrink-0 rounded-full bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <button
                    type="submit"
                    disabled={already}
                    className="mt-3 rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {already ? "Added" : "Add rule"}
                  </button>
                )}
              </form>
            );
          })}
        </div>
      </section>

      <form action={addRule} className="mt-10 flex gap-3">
        <input
          name="instruction"
          required
          maxLength={300}
          placeholder='e.g. "Archive all receipts", "Never draft replies to newsletters from acme.com"'
          className="flex-1 rounded-full border border-zinc-300 px-5 py-2.5 text-sm outline-none focus:border-teal-600"
        />
        <button
          type="submit"
          className="rounded-full bg-teal-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
        >
          Add rule
        </button>
      </form>

      {userRules.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-zinc-200 p-8 text-center text-sm text-zinc-500">
          No rules yet — try a template above.
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
                <button
                  type="submit"
                  className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
                >
                  {rule.enabled ? "Disable" : "Enable"}
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await deleteRule(rule.id);
                }}
              >
                <button
                  type="submit"
                  className="text-xs font-medium text-red-500 hover:text-red-700"
                >
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
