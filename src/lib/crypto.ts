import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

export type SecretKind = "google_refresh_token";
export type SecretAccessPurpose =
  | "gmail.persist"
  | "gmail.api"
  | "gmail.revoke"
  | "unknown";

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be a 32-byte hex string (64 chars). " +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * CASA 6.7.1 — access to stored secrets is logged. Never include ciphertext,
 * plaintext, IVs, or the encryption key.
 */
export function auditSecretAccess(entry: {
  event: "secret.encrypt" | "secret.decrypt";
  kind: SecretKind;
  purpose: SecretAccessPurpose;
  ok: boolean;
}): void {
  console.info(entry.event, {
    kind: entry.kind,
    purpose: entry.purpose,
    ok: entry.ok,
    at: new Date().toISOString(),
  });
}

/** Encrypts a secret for storage. Output format: iv.ciphertext.authTag (base64 parts). */
export function encryptSecret(plaintext: string, purpose: SecretAccessPurpose = "gmail.persist"): string {
  try {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    auditSecretAccess({ event: "secret.encrypt", kind: "google_refresh_token", purpose, ok: true });
    return [iv.toString("base64"), encrypted.toString("base64"), tag.toString("base64")].join(".");
  } catch (err) {
    auditSecretAccess({ event: "secret.encrypt", kind: "google_refresh_token", purpose, ok: false });
    throw err;
  }
}

export function decryptSecret(payload: string, purpose: SecretAccessPurpose = "gmail.api"): string {
  try {
    const [ivB64, dataB64, tagB64] = payload.split(".");
    if (!ivB64 || !dataB64 || !tagB64) throw new Error("Malformed encrypted payload");
    const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]).toString("utf8");
    auditSecretAccess({ event: "secret.decrypt", kind: "google_refresh_token", purpose, ok: true });
    return plaintext;
  } catch (err) {
    auditSecretAccess({ event: "secret.decrypt", kind: "google_refresh_token", purpose, ok: false });
    throw err;
  }
}
