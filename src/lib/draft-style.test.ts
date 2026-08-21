import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES } from "@/lib/db/schema";
import { migratedDraftPreferences, resolveDraftStyle } from "@/lib/draft-style";
import { finalizeTriageCategory, isNoActionSummary } from "@/lib/triage";

const RAHIMUDDIN =
  "User reacted with a ❤️ to the earlier bug-fix message — acknowledgement/thanks, no action required.";

describe("A-1 draft style default", () => {
  it("treats legacy important_only as always until the user re-selects it", () => {
    expect(resolveDraftStyle({ ...DEFAULT_PREFERENCES, draftStyle: "important_only", draftPolicyV2: false })).toBe(
      "always",
    );
    expect(resolveDraftStyle({ ...DEFAULT_PREFERENCES, draftStyle: "everything" })).toBe("always");
    expect(resolveDraftStyle({ ...DEFAULT_PREFERENCES, draftStyle: "always", draftPolicyV2: true })).toBe("always");
    expect(resolveDraftStyle({ ...DEFAULT_PREFERENCES, draftStyle: "important_only", draftPolicyV2: true })).toBe(
      "important_only",
    );
    expect(resolveDraftStyle({ ...DEFAULT_PREFERENCES, draftStyle: "manual" })).toBe("manual");
  });

  it("migrates stored important_only to always", () => {
    const next = migratedDraftPreferences({
      ...DEFAULT_PREFERENCES,
      draftStyle: "important_only",
      draftPolicyV2: false,
    });
    expect(next.draftStyle).toBe("always");
    expect(next.draftPolicyV2).toBe(true);
  });
});

describe("A-2 no-action summaries", () => {
  it("detects the Rahimuddin acknowledgement", () => {
    expect(isNoActionSummary(RAHIMUDDIN)).toBe(true);
    expect(isNoActionSummary("Captapi fixed the timeout; they recommend increasing the client timeout.")).toBe(
      false,
    );
  });

  it("demotes no-action To Respond mail to FYI", () => {
    expect(
      finalizeTriageCategory({
        from: "Rahimuddin Mohammad <rahim@captapi.com>",
        fromEmail: "rahim@captapi.com",
        subject: "Re: tiktok-transcript timed out after 15000ms",
        pre: {
          skipIngest: false,
          neverToRespond: false,
          category: null,
          reason: "pass",
          skipLlmCategory: false,
        },
        llmOrDefault: "to_respond",
        cached: null,
        summary: RAHIMUDDIN,
      }),
    ).toBe("fyi");
  });
});
