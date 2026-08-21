import { describe, expect, it, vi } from "vitest";
import { CLASSIFY_SYSTEM, handleClassifyFailure } from "@/lib/ai";
import { canBeToRespond, headerFlagsFromMeta, isLinkedInSender } from "@/lib/bot-gate";
import { retriageSince } from "@/lib/classifier-version";
import { preClassify, resolveTriageCategory } from "@/lib/pre-classify";
import { applyTriageGate, isLegacyActionSummary, sanitizeSummary } from "@/lib/triage";
import {
  isUncacheableDomain,
  nextCacheState,
  shouldApplyCachedCategory,
} from "@/lib/sender-cache-logic";
import { isSummaryUnavailable, SUMMARY_UNAVAILABLE_LABEL } from "@/lib/summary-display";

/** Round-3 labelled Security negatives — every linkedin.com sender from the 2026-08-20 QA pass. */
const LINKEDIN_SECURITY_NEGATIVES: { from: string; email: string; subject: string }[] = [
  {
    from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
    email: "jobalerts-noreply@linkedin.com",
    subject: "Security Architecture Professionals at Trendyol Group",
  },
  {
    from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
    email: "jobalerts-noreply@linkedin.com",
    subject: "Government Relations Senior Manager at Pfizer",
  },
  {
    from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
    email: "jobalerts-noreply@linkedin.com",
    subject: "SQL Developer at Jobgether",
  },
  {
    from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
    email: "jobalerts-noreply@linkedin.com",
    subject: "Data Scientist at Rollic",
  },
  {
    from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
    email: "jobalerts-noreply@linkedin.com",
    subject: "Field Support Responsible (İzmir) at Bosch Türkiye",
  },
  {
    from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
    email: "jobalerts-noreply@linkedin.com",
    subject: "AI & Data Science Long-Term Intern at EczaneRapor",
  },
  {
    from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
    email: "jobalerts-noreply@linkedin.com",
    subject: "Kıdemli Yapay Zeka Uzmanı at Eksim Holding",
  },
  {
    from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
    email: "jobalerts-noreply@linkedin.com",
    subject: "Senior Data Engineer – Data Quality at Jobgether",
  },
  {
    from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
    email: "jobalerts-noreply@linkedin.com",
    subject: "Pricing Operations Coordinator MESA at MAHLE",
  },
  {
    from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
    email: "jobalerts-noreply@linkedin.com",
    subject: "Mobile Engineer (Turkey, All Levels) at Sezzle",
  },
  {
    from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
    email: "jobalerts-noreply@linkedin.com",
    subject: "Data Scientist - Python (Remote) at Hire Feed",
  },
  {
    from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
    email: "jobalerts-noreply@linkedin.com",
    subject: "Data Engineer I (Remote) at Hire Feed",
  },
  {
    from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
    email: "jobalerts-noreply@linkedin.com",
    subject: "Elementer Finansal İş… Takım Üyesi at Allianz",
  },
  {
    from: "LinkedIn <newsletters-noreply@linkedin.com>",
    email: "newsletters-noreply@linkedin.com",
    subject: "Don't miss conversations in Deep Learning, AI, ML…",
  },
  {
    from: "LinkedIn <jobs-listings@linkedin.com>",
    email: "jobs-listings@linkedin.com",
    subject: "New jobs similar to IT System Analyst at Gates Corp",
  },
  {
    from: "Gabriela Silva via LinkedIn <invitations@linkedin.com>",
    email: "invitations@linkedin.com",
    subject: "Gabriela accepted your invitation, explore their network",
  },
  {
    from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
    email: "jobalerts-noreply@linkedin.com",
    subject: "Alpaca is hiring for a Remote role",
  },
];

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
    subject: "Re: tiktok-transcript timed out after 15000ms",
  },
  {
    from: "Helpdesk <hello@acme.dev>",
    email: "hello@acme.dev",
    subject: "Re: API key rotation",
  },
  {
    from: "Acme Team <team@acme.dev>",
    email: "team@acme.dev",
    subject: "Re: outage follow-up",
  },
];

const NEGATIVES: { from: string; email: string; subject: string }[] = [
  ...LINKEDIN_SECURITY_NEGATIVES,
  {
    from: "Udemy Instructor: Ligency <no-reply@e.udemymail.com>",
    email: "no-reply@e.udemymail.com",
    subject: "Ready to build your first AI agent?",
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

function snapshotFixtures() {
  return [
    ...LINKEDIN_SECURITY_NEGATIVES.map((m) => ({
      key: `${m.email} :: ${m.subject}`,
      category: predicted(m.from, m.email, m.subject).category,
    })),
    {
      key: "vercel-signin",
      category: predicted(
        "Vercel <noreply@ct.vercel.com>",
        "noreply@ct.vercel.com",
        "New sign-in detected on your Vercel account",
      ).category,
    },
  ];
}

describe("B-3 gate degrades when headers are missing", () => {
  it("does not throw on undefined headers or empty sender fields", () => {
    expect(() =>
      applyTriageGate({ from: "", fromEmail: "", subject: "", headers: undefined }),
    ).not.toThrow();
    const r = applyTriageGate({
      from: "Human <a@b.com>",
      fromEmail: "a@b.com",
      subject: "Hello",
    });
    expect(r.reason).toBe("pass");
  });

  it("uses persisted header flags when raw headers are absent", () => {
    const flags = headerFlagsFromMeta({
      listUnsubscribe: "<mailto:unsub@x.com>",
      listId: "",
      autoSubmitted: null,
      precedence: "bulk",
    });
    expect(flags.hasListUnsubscribe).toBe(true);
    expect(flags.isBulkPrecedence).toBe(true);
    const r = applyTriageGate({
      from: "Human <person@company.com>",
      fromEmail: "person@company.com",
      subject: "Can you reply?",
      headers: flags,
    });
    expect(r.neverToRespond).toBe(true);
  });
});

describe("B-1 shared triage gate", () => {
  it("blocks the remaining To Respond bots on stored From/subject alone", () => {
    const blocked = [
      {
        from: "Udemy Instructor: Ligency <no-reply@e.udemymail.com>",
        email: "no-reply@e.udemymail.com",
        subject: "🔧 6 AI Agents … $9.99 Till Friday.",
        expect: "marketing",
      },
      {
        from: "Inbox Wingman <brief@inboxwingman.com>",
        email: "brief@inboxwingman.com",
        subject: "Your inbox brief — 6 to respond, 6 deadlines",
        expect: "skip",
      },
      {
        from: "jobs <vodafonepr-jobnotification@noreply12.jobs2web.com>",
        email: "vodafonepr-jobnotification@noreply12.jobs2web.com",
        subject: "New job notification",
      },
      {
        from: "AlphaSignal <news@alphasignal.ai>",
        email: "news@alphasignal.ai",
        subject: "Claude Opus 5 hits 2x drug binder success rate",
        expect: "newsletter",
      },
      {
        from: "Ideabrowser <notifications@mail.ideabrowser.com>",
        email: "notifications@mail.ideabrowser.com",
        subject: "Simulated secret shopper for online stores",
        expect: "marketing",
      },
      {
        from: "LinkedIn <newsletters-noreply@linkedin.com>",
        email: "newsletters-noreply@linkedin.com",
        subject: "Don't miss conversations in AI, GenAI, LLMs…",
        expect: "notification",
      },
    ] as const;

    for (const m of blocked) {
      const r = applyTriageGate({ from: m.from, fromEmail: m.email, subject: m.subject });
      expect(r.neverToRespond || r.skipIngest, m.subject).toBe(true);
      expect(r.category === "to_respond", m.subject).toBe(false);
      if ("expect" in m && m.expect === "skip") expect(r.skipIngest).toBe(true);
      if ("expect" in m && m.expect && m.expect !== "skip") expect(r.category).toBe(m.expect);
    }
  });

  it("strips the Action / signature needed placeholder", () => {
    expect(isLegacyActionSummary("Action / signature needed: Re: Veri sırası")).toBe(true);
    expect(sanitizeSummary("Action / signature needed: Re: Veri sırası")).toBeNull();
  });
});

describe("B-1 re-triage scope cutoff", () => {
  it("uses received-at days, never an invalid Date", () => {
    const now = new Date("2026-08-20T12:00:00.000Z");
    const since7 = retriageSince("7", now);
    expect(since7?.toISOString()).toBe("2026-08-13T12:00:00.000Z");
    expect(retriageSince("all", now)).toBeNull();
    expect(Number.isNaN(since7?.getTime())).toBe(false);
  });
});

describe("R-1 LinkedIn is never Security", () => {
  it("treats lnkd.in and via-LinkedIn display names as LinkedIn", () => {
    expect(isLinkedInSender("alerts@lnkd.in", "LinkedIn")).toBe(true);
    expect(isLinkedInSender("gabriela@mail.com", "Gabriela via LinkedIn")).toBe(true);
  });

  it("keeps the Vercel sign-in as Security", () => {
    const r = predicted(
      "Vercel <noreply@ct.vercel.com>",
      "noreply@ct.vercel.com",
      "New sign-in detected on your Vercel account",
    );
    expect(r.category).toBe("security");
  });

  it("labels every round-3 LinkedIn row as notification", () => {
    for (const m of LINKEDIN_SECURITY_NEGATIVES) {
      const r = predicted(m.from, m.email, m.subject);
      expect(r.category, m.subject).toBe("notification");
      expect(r.neverToRespond, m.subject).toBe(true);
    }
  });

  it("keeps Alpaca hiring out of Security even when the body mentions 2FA", () => {
    const r = preClassify({
      from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
      fromEmail: "jobalerts-noreply@linkedin.com",
      subject: "Alpaca is hiring for a Remote role",
      bodyExcerpt: "Alpaca is hiring. Experience with MFA and 2FA required. Sign in to apply.",
    });
    expect(r.category).toBe("notification");
    expect(
      resolveTriageCategory({
        from: "LinkedIn Job Alerts <jobalerts-noreply@linkedin.com>",
        fromEmail: "jobalerts-noreply@linkedin.com",
        subject: "Alpaca is hiring for a Remote role",
        bodyExcerpt: "Experience with MFA and 2FA required.",
        pre: r,
        llmOrDefault: "security",
        cached: "security",
      }),
    ).toBe("notification");
    expect(CLASSIFY_SYSTEM).toContain("Alpaca is hiring for a Remote role");
  });

  it("ignores a poisoned Security cache hit for linkedin.com", () => {
    for (const m of LINKEDIN_SECURITY_NEGATIVES) {
      const pre = predicted(m.from, m.email, m.subject);
      expect(
        resolveTriageCategory({
          from: m.from,
          fromEmail: m.email,
          subject: m.subject,
          pre,
          llmOrDefault: "security",
          cached: "security",
        }),
        m.subject,
      ).toBe("notification");
    }
  });

  it("produces identical output across three fixture runs", () => {
    const a = snapshotFixtures();
    const b = snapshotFixtures();
    const c = snapshotFixtures();
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(a.every((row) => row.key === "vercel-signin" || row.category === "notification")).toBe(
      true,
    );
    expect(a.find((row) => row.key === "vercel-signin")?.category).toBe("security");
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

  it("forces Captapi and other role-inbox Re: replies to To Respond", () => {
    const r = predicted(
      "Captapi Support <support@captapi.com>",
      "support@captapi.com",
      "Re: tiktok-transcript timed out after 15000ms",
    );
    expect(r.category).toBe("to_respond");
    expect(r.neverToRespond).toBe(false);
    expect(
      resolveTriageCategory({
        from: r.reason === "support-reply" ? "Captapi Support <support@captapi.com>" : "",
        fromEmail: "support@captapi.com",
        subject: "Re: tiktok-transcript timed out after 15000ms",
        pre: r,
        llmOrDefault: "fyi",
        cached: "fyi",
      }),
    ).toBe("to_respond");
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

  it("never caches LinkedIn or other mixed-intent networks", () => {
    expect(isUncacheableDomain("linkedin.com")).toBe(true);
    expect(isUncacheableDomain("e.linkedin.com")).toBe(true);
    expect(isUncacheableDomain("facebook.com")).toBe(true);
    expect(isUncacheableDomain("cursor.com")).toBe(false);
  });

  it("resets the streak when the label changes", () => {
    const a = nextCacheState(null, "notification");
    const b = nextCacheState(a, "notification");
    const flipped = nextCacheState(b, "marketing");
    expect(flipped?.sampleCount).toBe(1);
    expect(shouldApplyCachedCategory(flipped)).toBeNull();
  });
});

describe("C-3 Security is an account event", () => {
  const negatives = [
    {
      from: "Udemy <no-reply@e.udemymail.com>",
      email: "no-reply@e.udemymail.com",
      subject: "Fuat, still interested in Search Engine Optimization (SEO) prep?",
      expect: "marketing" as const,
    },
    {
      from: "Netflix <info@mailer.netflix.com>",
      email: "info@mailer.netflix.com",
      subject: "Important: How to update your Netflix Household",
      expect: "notification" as const,
    },
    {
      from: "Fyxer Privacy <privacy@fyxer.com>",
      email: "privacy@fyxer.com",
      subject: "An update on Fyxer's sub-processors",
      expect: "notification" as const,
    },
  ];

  it("keeps Udemy / Netflix Household / Fyxer sub-processors out of Security", () => {
    for (const m of negatives) {
      const pre = predicted(m.from, m.email, m.subject);
      expect(pre.category, m.subject).toBe(m.expect);
      expect(
        resolveTriageCategory({
          from: m.from,
          fromEmail: m.email,
          subject: m.subject,
          pre,
          llmOrDefault: "security",
          cached: "security",
        }),
        m.subject,
      ).toBe(m.expect);
    }
    expect(CLASSIFY_SYSTEM).toContain("still interested in Search Engine Optimization");
    expect(CLASSIFY_SYSTEM).toContain("Netflix Household");
    expect(CLASSIFY_SYSTEM).toContain("sub-processors");
  });

  it("still labels real account events as Security", () => {
    const kept = [
      ["Filip at Tally <hello@tally.so>", "hello@tally.so", "Notice of a data breach affecting your Tally account"],
      ["Link <noreply@link.com>", "noreply@link.com", "New login from iOS (Mobile Safari)"],
      ["Similarweb <no-reply@similarweb.com>", "no-reply@similarweb.com", "SimilarWeb Hesabı Giriş Doğrulaması"],
      ["npm <noreply@npmjs.com>", "noreply@npmjs.com", "[npm] Two-factor authentication disabled"],
    ] as const;
    for (const [from, email, subject] of kept) {
      expect(predicted(from, email, subject).category, subject).toBe("security");
    }
  });
});

describe("R-3 summarizer failure", () => {
  it("does not contain the action-needed fallback string", () => {
    expect(CLASSIFY_SYSTEM.includes("Action / signature needed:")).toBe(false);
  });

  it("stores a null summary, logs sender+id, shows Summary unavailable, and cannot draft", () => {
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
    expect(isSummaryUnavailable(result.summary)).toBe(true);
    expect(SUMMARY_UNAVAILABLE_LABEL).toBe("Summary unavailable");
    expect(spy).toHaveBeenCalled();
    const logged = spy.mock.calls[0]?.[1] as { messageId?: string; from?: string; error?: string };
    expect(logged.messageId).toBe("gmail-abc");
    expect(logged.from).toBe("Isak at Polar <isak@polar.sh>");
    expect(logged.error).toMatch(/timeout/);
    const gate = { skipIngest: false, neverToRespond: false, category: null, reason: "pass" };
    expect(canBeToRespond({ summary: result.summary, gate, category: "to_respond" })).toBe(false);
    spy.mockRestore();
  });
});
