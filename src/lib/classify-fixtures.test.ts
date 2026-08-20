import { describe, expect, it, vi } from "vitest";
import { CLASSIFY_SYSTEM, handleClassifyFailure } from "@/lib/ai";
import { canBeToRespond } from "@/lib/bot-gate";
import { preClassify } from "@/lib/pre-classify";
import { nextCacheState, shouldApplyCachedCategory } from "@/lib/sender-cache-logic";

const LINKEDIN_ALERTS = [
  "Security Architecture Professionals at Trendyol Group",
  "Data Scientist at Rollic",
  "SQL Developer at Jobgether",
  "Field Support Responsible (İzmir) at Bosch Türkiye",
  "Government Relations Senior Manager at Pfizer",
  "AI & Data Science Long-Term Intern at EczaneRapor",
] as const;

const POSITIVES: { from: string; email: string; subject: string }[] = [
  { from: "Barış Bilen <baris@example.com>", email: "baris@example.com", subject: "Re: Veri sırası" },
  { from: "Miloš Radić <milos@example.com>", email: "milos@example.com", subject: "Just a question" },
  {
    from: "Isak at Polar <isak@polar.sh>",
    email: "isak@polar.sh",
    subject: "Re: Ongoing organization review - Lirefin",
  },
  {
    from: "Captapi Support <support@captapi.com>",
    email: "support@captapi.com",
    subject: "Re: tiktok-transcript timed out…",
  },
];

const NEGATIVES: { from: string; email: string; subject: string; expect?: string }[] = [
  ...LINKEDIN_ALERTS.map((subject) => ({
    from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
    email: "jobalerts-noreply@linkedin.com",
    subject,
    expect: "notification",
  })),
  {
    from: "Udemy Instructor: Ligency <no-reply@e.udemymail.com>",
    email: "no-reply@e.udemymail.com",
    subject: "Ready to build your first AI agent?",
    expect: "marketing",
  },
  {
    from: "jobs <vodafonepr-jobnotification@noreply12.jobs2web.com>",
    email: "vodafonepr-jobnotification@noreply12.jobs2web.com",
    subject: "New job notification",
  },
  {
    from: "Inbox Wingman <brief@inboxwingman.com>",
    email: "brief@inboxwingman.com",
    subject: "Your inbox brief — 4 to respond",
  },
];

function predicted(from: string, email: string, subject: string) {
  return preClassify({ from, fromEmail: email, subject });
}

describe("R-1 LinkedIn job alerts are never Security", () => {
  it("keeps the Vercel sign-in as Security", () => {
    const r = predicted(
      "Vercel <noreply@ct.vercel.com>",
      "noreply@ct.vercel.com",
      "New sign-in detected on your Vercel account",
    );
    expect(r.category).toBe("security");
  });

  it("labels the seven LinkedIn alerts as notification", () => {
    for (const subject of LINKEDIN_ALERTS) {
      const r = predicted(
        "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
        "jobalerts-noreply@linkedin.com",
        subject,
      );
      expect(r.category, subject).toBe("notification");
      expect(r.neverToRespond, subject).toBe(true);
    }
  });
});

describe("R-4 To Respond polarity (precision and recall)", () => {
  it("does not block known-positive human mail", () => {
    const blocked = POSITIVES.filter((m) => {
      const r = predicted(m.from, m.email, m.subject);
      return r.neverToRespond || r.skipIngest || (r.category !== null && r.category !== "to_respond");
    });
    expect(blocked, blocked.map((m) => m.subject).join(", ")).toEqual([]);
  });

  it("forces Captapi support replies to To Respond", () => {
    const r = predicted(
      "Captapi Support <support@captapi.com>",
      "support@captapi.com",
      "Re: tiktok-transcript timed out…",
    );
    expect(r.category).toBe("to_respond");
    expect(r.neverToRespond).toBe(false);
  });

  it("reports precision and recall of 1 on the labelled set", () => {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (const m of POSITIVES) {
      const r = predicted(m.from, m.email, m.subject);
      const isPositive = !r.neverToRespond && !r.skipIngest && (r.category === null || r.category === "to_respond");
      if (isPositive) tp += 1;
      else fn += 1;
    }
    for (const m of NEGATIVES) {
      const r = predicted(m.from, m.email, m.subject);
      const calledToRespond = r.category === "to_respond" && !r.neverToRespond;
      if (calledToRespond) fp += 1;
    }
    const precision = tp / (tp + fp);
    const recall = tp / (tp + fn);
    expect({ precision, recall, tp, fp, fn }).toEqual({
      precision: 1,
      recall: 1,
      tp: POSITIVES.length,
      fp: 0,
      fn: 0,
    });
  });
});

describe("R-1 sender cache", () => {
  it("does not apply a label from a single observation", () => {
    const afterOne = nextCacheState(null, "notification");
    expect(shouldApplyCachedCategory(afterOne)).toBeNull();
    const afterTwo = nextCacheState(afterOne, "notification");
    expect(shouldApplyCachedCategory(afterTwo)).toBeNull();
    const afterThree = nextCacheState(afterTwo, "notification");
    expect(shouldApplyCachedCategory(afterThree)).toBe("notification");
  });

  it("never caches Money or Security", () => {
    expect(nextCacheState(null, "security")).toBeNull();
    expect(nextCacheState(null, "money")).toBeNull();
    expect(
      shouldApplyCachedCategory({ category: "security", sampleCount: 99, userOverride: false }),
    ).toBeNull();
  });

  it("resets the streak when the label changes", () => {
    const a = nextCacheState(null, "notification");
    const b = nextCacheState(a, "notification");
    const flipped = nextCacheState(b, "marketing");
    expect(flipped?.sampleCount).toBe(1);
    expect(shouldApplyCachedCategory(flipped)).toBeNull();
  });
});

describe("R-3 summarizer failure", () => {
  it("does not contain the action-needed fallback string", () => {
    expect(CLASSIFY_SYSTEM.includes("Action / signature needed:")).toBe(false);
  });

  it("stores a null summary, logs the error, and cannot be To Respond", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = handleClassifyFailure({
      messageId: "gmail-abc",
      from: "Isak at Polar <isak@polar.sh>",
      subject: "Re: Ongoing organization review",
      bodyEmpty: false,
      error: new Error("timeout"),
    });
    expect(result.summary).toBeNull();
    expect(result.category).toBe("fyi");
    expect(result.needs_reply).toBe(false);
    expect(spy).toHaveBeenCalled();
    const logged = spy.mock.calls[0]?.[1] as { messageId?: string; error?: string };
    expect(logged.messageId).toBe("gmail-abc");
    expect(logged.error).toMatch(/timeout/);
    const gate = { skipIngest: false, neverToRespond: false, category: null, reason: "pass" };
    expect(canBeToRespond({ summary: result.summary, gate, category: "to_respond" })).toBe(false);
    spy.mockRestore();
  });
});
