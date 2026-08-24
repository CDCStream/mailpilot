import { afterEach, describe, expect, it, vi } from "vitest";
import { auditSecretAccess, decryptSecret, encryptSecret } from "@/lib/crypto";

const KEY = "a".repeat(64);

describe("CASA 6.7.1 token encryption", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("round-trips with AES-256-GCM and never logs the secret", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", KEY);
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    const secret = "1//refresh-token-value";
    const stored = encryptSecret(secret, "gmail.persist");
    expect(stored).not.toContain(secret);
    expect(stored.split(".")).toHaveLength(3);
    expect(decryptSecret(stored, "gmail.api")).toBe(secret);
    const dumped = JSON.stringify(spy.mock.calls);
    expect(dumped).not.toContain(secret);
    expect(dumped).toContain("secret.encrypt");
    expect(dumped).toContain("secret.decrypt");
    expect(dumped).toContain("google_refresh_token");
  });

  it("fails closed on a tampered payload", () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", KEY);
    vi.spyOn(console, "info").mockImplementation(() => {});
    const stored = encryptSecret("token", "gmail.persist");
    const [iv, data, tag] = stored.split(".");
    expect(() => decryptSecret(`${iv}.${data}.${tag!.slice(1)}a`, "gmail.api")).toThrow();
  });

  it("audit records omit ciphertext and key material", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    auditSecretAccess({
      event: "secret.decrypt",
      kind: "google_refresh_token",
      purpose: "gmail.api",
      ok: true,
    });
    const payload = spy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload).toEqual(
      expect.objectContaining({ kind: "google_refresh_token", purpose: "gmail.api", ok: true }),
    );
    expect(payload).not.toHaveProperty("token");
    expect(payload).not.toHaveProperty("ciphertext");
    expect(payload).not.toHaveProperty("key");
  });
});
