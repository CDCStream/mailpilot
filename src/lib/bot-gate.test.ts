import { describe, expect, it } from "vitest";
import { evaluateBotGate, isBotSender, isOwnAppSender } from "@/lib/bot-gate";
import { clampCategory, preClassify } from "@/lib/pre-classify";
import { filterObligationDeadlines } from "@/lib/deadlines";

/** The six senders from the 2026-08-20 QA pass — none may be To Respond. */
const QA_BOT_SENDERS = [
  { from: '"Udemy Instructor: Ligency" <no-reply@e.udemymail.com>', email: "no-reply@e.udemymail.com" },
  { from: "Ideabrowser <notifications@mail.ideabrowser.com>", email: "notifications@mail.ideabrowser.com" },
  {
    from: "vodafonepr-jobnotification@noreply12.jobs2web.com",
    email: "vodafonepr-jobnotification@noreply12.jobs2web.com",
  },
  { from: "AlphaSignal <news@alphasignal.ai>", email: "news@alphasignal.ai" },
  { from: "Fyxer Privacy <privacy@fyxer.com>", email: "privacy@fyxer.com" },
  { from: "Inbox Wingman <brief@inboxwingman.com>", email: "brief@inboxwingman.com" },
] as const;

const UDEMY_PROMOS = [
  {
    from: "Udemy Instructor: Start-Tech Academy <no-reply@e.udemymail.com>",
    email: "no-reply@e.udemymail.com",
    subject: "[BUNDLE OFFER] ... on SALE",
  },
  {
    from: "Udemy Instructor: OAK Academy Team <no-reply@e.udemymail.com>",
    email: "no-reply@e.udemymail.com",
    subject: "5 Days Only: Lowest Prices on Web Development Courses",
  },
  {
    from: "Udemy Instructor: Ligency <no-reply@e.udemymail.com>",
    email: "no-reply@e.udemymail.com",
    subject: "Ready to build your first AI agent?",
  },
  {
    from: "Udemy Instructor: Kasım Adalan <no-reply@e.udemymail.com>",
    email: "no-reply@e.udemymail.com",
    subject: "AĞUSTOS AYI SON KUPONLARI ...",
  },
  {
    from: "Udemy Instructor: Shubham Sarda <no-reply@e.udemymail.com>",
    email: "no-reply@e.udemymail.com",
    subject: "Claude Code Masterclass on SALEEE",
  },
] as const;

type Fixture = {
  from: string;
  email: string;
  subject: string;
  body?: string;
  headers?: { listUnsubscribe?: string; listId?: string; autoSubmitted?: string; precedence?: string };
  expect: "marketing" | "newsletter" | "notification" | "money" | "security" | "skip";
};

const REGRESSION: Fixture[] = [
  ...UDEMY_PROMOS.map((u) => ({ ...u, expect: "marketing" as const })),
  {
    from: "Netflix <info@mailer.netflix.com>",
    email: "info@mailer.netflix.com",
    subject: "New shows this week",
    expect: "marketing",
  },
  {
    from: "Adobe <mail@mail.adobe.com>",
    email: "mail@mail.adobe.com",
    subject: "50% off Creative Cloud",
    expect: "marketing",
  },
  {
    from: "O'Reilly <news@oreilly.com>",
    email: "news@oreilly.com",
    subject: "This week at O'Reilly",
    expect: "newsletter",
  },
  {
    from: "Cambly <no-reply@cambly.com>",
    email: "no-reply@cambly.com",
    subject: "Your weekly lesson reminder — book now and save",
    expect: "marketing",
  },
  {
    from: "AlphaSignal <news@alphasignal.ai>",
    email: "news@alphasignal.ai",
    subject: "Today's AI briefing",
    expect: "newsletter",
  },
  {
    from: "Ideabrowser <notifications@mail.ideabrowser.com>",
    email: "notifications@mail.ideabrowser.com",
    subject: "Your weekly ideas digest",
    headers: { listId: "<ideas.ideabrowser.com>" },
    expect: "marketing",
  },
  {
    from: "Cursor <noreply@cursor.com>",
    email: "noreply@cursor.com",
    subject: "$100.36 payment to Cursor was unsuccessful",
    expect: "money",
  },
  {
    from: "Cursor <noreply@cursor.com>",
    email: "noreply@cursor.com",
    subject: "Couldn't process payment",
    expect: "money",
  },
  {
    from: "Ahrefs <billing@ahrefs.com>",
    email: "billing@ahrefs.com",
    subject: "Your Ahrefs subscription will auto-renew on Aug 26",
    expect: "money",
  },
  {
    from: "Stripe <invoice@stripe.com>",
    email: "invoice@stripe.com",
    subject: "Receipt for Invoice #1234",
    expect: "money",
  },
  {
    from: "Eleven Labs Inc. <billing@elevenlabs.io>",
    email: "billing@elevenlabs.io",
    subject: "Your receipt #2800-2448-2367",
    expect: "money",
  },
  {
    from: "npm <noreply@npmjs.com>",
    email: "noreply@npmjs.com",
    subject: "[npm] Two-factor authentication disabled",
    expect: "security",
  },
  {
    from: "npm <noreply@npmjs.com>",
    email: "noreply@npmjs.com",
    subject: "[npm] Granular access tokens expiring in 7 days",
    expect: "security",
  },
  {
    from: "npm <noreply@npmjs.com>",
    email: "noreply@npmjs.com",
    subject: "[npm] A security key was added to your account",
    expect: "security",
  },
  {
    from: "Google <no-reply@accounts.google.com>",
    email: "no-reply@accounts.google.com",
    subject: "Güvenlik uyarısı",
    expect: "security",
  },
  {
    from: "Inbox Wingman <brief@inboxwingman.com>",
    email: "brief@inboxwingman.com",
    subject: "Your inbox brief — 4 to respond",
    expect: "skip",
  },
  {
    from: "Zapier <no-reply@zapier.com>",
    email: "no-reply@zapier.com",
    subject: "Register for the TikTok CAPI workshop",
    expect: "marketing",
  },
  {
    from: "Dataquest <hello@dataquest.io>",
    email: "hello@dataquest.io",
    subject: "Free access ends Aug 23",
    expect: "marketing",
  },
  {
    from: "Semrush <mail@semrush.com>",
    email: "mail@semrush.com",
    subject: "Claim your BOGO ticket code",
    expect: "marketing",
  },
  {
    from: "Fyxer Privacy <privacy@fyxer.com>",
    email: "privacy@fyxer.com",
    subject: "Privacy notice update",
    expect: "notification",
  },
  {
    from: "Udemy <no-reply@e.udemymail.com>",
    email: "no-reply@e.udemymail.com",
    subject: "Fuat, still interested in Search Engine Optimization (SEO) prep?",
    expect: "marketing",
  },
  {
    from: "Netflix <info@mailer.netflix.com>",
    email: "info@mailer.netflix.com",
    subject: "Important: How to update your Netflix Household",
    expect: "notification",
  },
  {
    from: "Fyxer Privacy <privacy@fyxer.com>",
    email: "privacy@fyxer.com",
    subject: "An update on Fyxer's sub-processors",
    expect: "notification",
  },
  {
    from: "Filip at Tally <hello@tally.so>",
    email: "hello@tally.so",
    subject: "Notice of a data breach affecting your Tally account",
    expect: "security",
  },
  {
    from: "Link <noreply@link.com>",
    email: "noreply@link.com",
    subject: "New login from iOS (Mobile Safari)",
    expect: "security",
  },
  {
    from: "Similarweb <no-reply@similarweb.com>",
    email: "no-reply@similarweb.com",
    subject: "SimilarWeb Hesabı Giriş Doğrulaması",
    expect: "security",
  },
  {
    from: "Vercel <noreply@ct.vercel.com>",
    email: "noreply@ct.vercel.com",
    subject: "Deployment failed",
    expect: "notification",
  },
  {
    from: "List mail <updates@example.com>",
    email: "updates@example.com",
    subject: "This week's recap",
    headers: { listId: "<weekly.example.com>", listUnsubscribe: "<mailto:unsub@example.com>" },
    expect: "notification",
  },
  {
    from: "Bulk <hello@shop.example>",
    email: "hello@shop.example",
    subject: "Order update",
    headers: { precedence: "bulk", autoSubmitted: "auto-generated" },
    expect: "notification",
  },
];

describe("P0-1 bot / no-reply gate", () => {
  it("never classifies the six QA senders as To Respond", () => {
    for (const s of QA_BOT_SENDERS) {
      const gate = evaluateBotGate({ from: s.from, fromEmail: s.email, subject: "Hello" });
      expect(gate.neverToRespond, s.email).toBe(true);
      expect(isBotSender(s.email, s.from) || isOwnAppSender(s.email), s.email).toBe(true);
    }
  });

  it("excludes the app's own brief from ingestion", () => {
    const gate = evaluateBotGate({
      from: "Inbox Wingman <brief@inboxwingman.com>",
      fromEmail: "brief@inboxwingman.com",
      subject: "Your inbox brief",
    });
    expect(gate.skipIngest).toBe(true);
    expect(isOwnAppSender("brief@inboxwingman.com")).toBe(true);
  });

  it("treats List-Unsubscribe / List-Id / Auto-Submitted / Precedence as never-reply", () => {
    const cases = [
      { listUnsubscribe: "<mailto:unsub@x.com>" },
      { listId: "<list.example.com>" },
      { autoSubmitted: "auto-generated" },
      { precedence: "bulk" },
    ];
    for (const headers of cases) {
      const gate = evaluateBotGate({
        from: "Human Name <person@company.com>",
        fromEmail: "person@company.com",
        subject: "Can you reply?",
        headers,
      });
      expect(gate.neverToRespond).toBe(true);
    }
  });
});

describe("P0-2 summary fallback", () => {
  it("does not assert action when summary is missing", () => {
    const gate = evaluateBotGate({
      from: "A <a@b.com>",
      fromEmail: "a@b.com",
    });
    expect(clampCategory({ category: "to_respond", summary: null, gate })).not.toBe("to_respond");
    expect(clampCategory({ category: "to_respond", summary: "", gate })).not.toBe("to_respond");
  });
});

describe("P0-3 Udemy promos classify as Marketing", () => {
  it("is deterministic across three consecutive runs", () => {
    for (let run = 0; run < 3; run++) {
      for (const msg of UDEMY_PROMOS) {
        const result = preClassify({
          from: msg.from,
          fromEmail: msg.email,
          subject: msg.subject,
        });
        expect(result.category, `${msg.from} run ${run}`).toBe("marketing");
        expect(result.neverToRespond).toBe(true);
      }
    }
  });
});

describe("classification regression fixtures", () => {
  it("labels ~30 real-world messages", () => {
    expect(REGRESSION.length).toBeGreaterThanOrEqual(25);
    for (const row of REGRESSION) {
      const result = preClassify({
        from: row.from,
        fromEmail: row.email,
        subject: row.subject,
        bodyExcerpt: row.body,
        headers: row.headers,
      });
      if (row.expect === "skip") {
        expect(result.skipIngest, row.subject).toBe(true);
        continue;
      }
      if (row.expect === "notification" && !result.category) {
        expect(result.neverToRespond, row.subject).toBe(true);
        continue;
      }
      expect(result.category, `${row.from} — ${row.subject}`).toBe(row.expect);
    }
  });
});

describe("P0-4 obligation vs promotional deadlines", () => {
  it("keeps money/security obligations and drops promo countdowns", () => {
    const kept = filterObligationDeadlines([
      "Register or attend Zapier TikTok CAPI workshop on Aug 20 at 12:00 PM CT",
      "Finish Dataquest lessons — free access ends Aug 23 at 11:59 PM PT",
      "Complete NVIDIA 5-minute quantum survey by Aug 25",
      "Claim Semrush BOGO ticket code before 5:00 PM CET on Aug 20",
      "Update payment details or cancel Ahrefs subscription before renewal on Aug 26",
      "Cursor payment of $100.36 was unsuccessful",
      "npm granular access tokens expiring in 7 days",
    ]);
    expect(kept.some((l) => /Ahrefs/i.test(l))).toBe(true);
    expect(kept.some((l) => /Cursor/i.test(l))).toBe(true);
    expect(kept.some((l) => /npm/i.test(l))).toBe(true);
    expect(kept.some((l) => /Zapier|Dataquest|NVIDIA|Semrush/i.test(l))).toBe(false);
  });
});
