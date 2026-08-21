import { describe, expect, it } from "vitest";
import { draftedThreadIds, pickLatestPerThread, uniqueDraftsByThread } from "@/lib/thread-draft";

describe("C-1 thread-keyed drafts", () => {
  const rows = [
    { id: "1", threadId: "veri", receivedAt: new Date("2026-08-17T10:00:00Z"), draftId: "d1" },
    { id: "2", threadId: "veri", receivedAt: new Date("2026-08-17T11:00:00Z"), draftId: "d2" },
    { id: "3", threadId: "veri", receivedAt: new Date("2026-08-17T12:00:00Z"), draftId: "d3" },
    { id: "4", threadId: "packplan", receivedAt: new Date("2026-08-18T09:00:00Z"), draftId: "d4" },
  ];

  it("picks the latest message per thread", () => {
    const latest = pickLatestPerThread(rows);
    expect(latest).toHaveLength(2);
    expect(latest.find((r) => r.threadId === "veri")?.id).toBe("3");
    expect(latest.find((r) => r.threadId === "packplan")?.id).toBe("4");
  });

  it("lists a drafted thread once", () => {
    const written = uniqueDraftsByThread(rows);
    expect(written).toHaveLength(2);
    expect(written.map((r) => r.threadId).sort()).toEqual(["packplan", "veri"]);
  });

  it("marks a thread as already drafted when any sibling has a draft", () => {
    expect(draftedThreadIds(rows).has("veri")).toBe(true);
    expect(draftedThreadIds(rows.filter((r) => r.id === "4")).has("veri")).toBe(false);
  });
});
