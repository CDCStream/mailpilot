import { describe, expect, it } from "vitest";
import {
  RETRIAGE_BATCH_SIZE,
  isRetriageStale,
  nextRetriageSlice,
  parseRetriageChanged,
  retriageWorkList,
  snapshotRetriageTotal,
} from "@/lib/retriage-job";

describe("retriage batching", () => {
  it("commits in 25-message slices from the last offset", () => {
    const listed = Array.from({ length: 295 }, (_, i) => i);
    expect(nextRetriageSlice(listed, 0)).toEqual(listed.slice(0, 25));
    expect(nextRetriageSlice(listed, 25)).toEqual(listed.slice(25, 50));
    expect(nextRetriageSlice(listed, 275)).toHaveLength(20);
    expect(nextRetriageSlice(listed, 295)).toEqual([]);
    expect(RETRIAGE_BATCH_SIZE).toBe(25);
  });

  it("treats a job with no commit for 2 minutes as stale", () => {
    const now = new Date("2026-08-20T12:00:00.000Z");
    expect(isRetriageStale(new Date("2026-08-20T11:57:59.000Z"), now)).toBe(true);
    expect(isRetriageStale(new Date("2026-08-20T11:58:01.000Z"), now)).toBe(false);
  });

  it("reads the changed counter without treating failed errors as a count", () => {
    expect(parseRetriageChanged("changed:12")).toBe(12);
    expect(parseRetriageChanged("stale-timeout")).toBeNull();
    expect(parseRetriageChanged("batch-error")).toBeNull();
  });

  it("freezes the job total at enqueue so new mail cannot grow the denominator", () => {
    expect(snapshotRetriageTotal(295, 296)).toBe(295);
    expect(snapshotRetriageTotal(0, 296)).toBe(296);
    expect(retriageWorkList([1, 2, 3, 4], 3)).toEqual([1, 2, 3]);
  });
});
