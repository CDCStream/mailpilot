import { describe, expect, it } from "vitest";
import { normalizePromoKeyName, promoClaimId, promoCreditsForKeyName } from "@/lib/promo-key";

describe("promo API key credits", () => {
  it("grants 1000 for FuatSezer_1000 regardless of case", () => {
    expect(promoCreditsForKeyName("FuatSezer_1000")).toBe(1000);
    expect(promoCreditsForKeyName("  fuatsezer_1000  ")).toBe(1000);
  });

  it("does not treat other names as a promo", () => {
    expect(promoCreditsForKeyName("production")).toBeNull();
    expect(promoCreditsForKeyName("FuatSezer_2000")).toBeNull();
  });

  it("uses a per-user claim id so a second create cannot grant again", () => {
    const a = promoClaimId("user-1", "FuatSezer_1000");
    const b = promoClaimId("user-1", "fuatsezer_1000");
    const other = promoClaimId("user-2", "FuatSezer_1000");
    expect(a).toBe(b);
    expect(a).not.toBe(other);
    expect(normalizePromoKeyName("FuatSezer_1000")).toBe("fuatsezer_1000");
  });
});
