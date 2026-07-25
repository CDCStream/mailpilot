import type { Category, ParsedRule, RuleCondition } from "@/lib/db/schema";
import { isValidCategory } from "@/lib/ai";

export type RuleInput = {
  fromEmail: string;
  subject: string;
  bodyExcerpt: string;
  category: Category;
};

export type RuleOutcome = {
  category: Category;
  forceArchive: boolean;
  keepInInbox: boolean;
  skipDraft: boolean;
  star: boolean;
  appliedRule?: string;
};

function matches(cond: RuleCondition, input: RuleInput): boolean {
  const value = cond.value.toLowerCase();
  const field = (() => {
    switch (cond.field) {
      case "from":
        return input.fromEmail;
      case "domain":
        return input.fromEmail.split("@")[1] ?? "";
      case "subject":
        return input.subject;
      case "body":
        return input.bodyExcerpt;
      case "category":
        return input.category;
    }
  })().toLowerCase();

  switch (cond.op) {
    case "contains":
      return field.includes(value);
    case "equals":
    case "is":
      return field === value;
  }
}

/** Applies user rules on top of the LLM classification. First matching rule wins per action type. */
export function applyRules(
  ruleList: { parsed: ParsedRule; description: string }[],
  input: RuleInput,
): RuleOutcome {
  const outcome: RuleOutcome = {
    category: input.category,
    forceArchive: false,
    keepInInbox: false,
    skipDraft: false,
    star: false,
  };

  for (const rule of ruleList) {
    const { conditions, actions } = rule.parsed;
    if (conditions.length === 0) continue;
    if (!conditions.every((c) => matches(c, { ...input, category: outcome.category }))) continue;

    for (const action of actions) {
      switch (action.type) {
        case "set_category":
          if (action.value && isValidCategory(action.value)) outcome.category = action.value;
          break;
        case "archive":
          outcome.forceArchive = true;
          break;
        case "keep_in_inbox":
          outcome.keepInInbox = true;
          break;
        case "skip_draft":
          outcome.skipDraft = true;
          break;
        case "star":
          outcome.star = true;
          break;
      }
    }
    outcome.appliedRule = rule.description;
  }

  return outcome;
}
