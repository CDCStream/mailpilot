# CASA 6.7.1 — assessor reply (paste)

Compliant. Secrets-management policy is published at https://www.inboxwingman.com/security/secrets.

**Access control.** AUTH_SECRET, TOKEN_ENCRYPTION_KEY, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY, DATABASE_URL, RESEND_API_KEY, Inngest keys, and billing secrets are Vercel project environment variables for this project only, marked Sensitive, scoped to Production/Preview. They are not NEXT_PUBLIC_ and are never shipped to the browser or committed to git. Only Vercel project members with environment-variable permission can view or edit them. The application has no admin UI that displays secret values. Per-user Google refresh tokens can be decrypted only by the server process that holds TOKEN_ENCRYPTION_KEY, and only to call the Gmail API or to revoke the token on disconnect/delete.

**Cryptography.** Platform secrets are not duplicated into the application database; they exist only in the Vercel runtime (Vercel stores environment variables encrypted at rest). Application-persisted secrets — Google refresh tokens — are encrypted with AES-256-GCM in `src/lib/crypto.ts` before Postgres write: 32-byte key, random 12-byte IV, stored as `iv.ciphertext.authTag`; auth-tag failure throws (fail closed). Google OAuth access tokens are minted in memory and never stored. Session cookies are encrypted JWEs bound to AUTH_SECRET (24-hour maxAge).

**Monitoring.** Vercel records Added/Updated timestamps and the actor on each environment variable and retains deployment and env-change activity. The application emits structured `secret.encrypt` / `secret.decrypt` events (`kind`, `purpose`, `ok`, `at`) to Vercel Runtime Logs. Ciphertext, plaintext, IVs, and keys are never logged.

**Evidence.** Live page `/security/secrets` (inventory + policy); Vercel Environment Variables screenshot (names only, Sensitive); `src/lib/crypto.ts` (AES-256-GCM + `auditSecretAccess`).
