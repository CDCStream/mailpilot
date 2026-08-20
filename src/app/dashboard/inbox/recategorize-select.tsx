"use client";

import { recategorizeMessage } from "../actions";
import type { Category } from "@/lib/db";
import { CATEGORY_BADGES, CATEGORY_NAMES } from "../categories";
import { CATEGORIES } from "@/lib/db/schema";

export function RecategorizeSelect({
  messageId,
  category,
}: {
  messageId: string;
  category: Category | null;
}) {
  return (
    <form action={recategorizeMessage} className="mt-1 shrink-0">
      <input type="hidden" name="messageId" value={messageId} />
      <select
        name="category"
        defaultValue={category ?? ""}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-medium outline-none ${
          category ? CATEGORY_BADGES[category] : "bg-zinc-100 text-zinc-500"
        }`}
      >
        <option value="" disabled>
          Category
        </option>
        {CATEGORIES.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_NAMES[c]}
          </option>
        ))}
      </select>
    </form>
  );
}
