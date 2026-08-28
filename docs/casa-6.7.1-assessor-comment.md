# CASA 6.7.1 — assessor reply (paste)

Keep this short. Long comments get cut in the portal (last time it stopped at “The application emit”).

---

Compliant. Dedicated secrets store + policy: https://www.inboxwingman.com/security/secrets (OWASP Secrets Management Cheat Sheet).

Access control (least privilege). Platform secrets (AUTH_SECRET, TOKEN_ENCRYPTION_KEY, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY, DATABASE_URL, RESEND_API_KEY, Inngest, billing) live only as Vercel project Environment Variables, marked Sensitive, Production/Preview, not NEXT_PUBLIC_, not in git, not in the browser. Only Vercel project members with env-var permission can view/edit. No in-app admin shows secret values. Per-user Google refresh tokens decrypt only on the server that holds TOKEN_ENCRYPTION_KEY, only for Gmail API or revoke on disconnect/delete.

Cryptography (all secret classes). Platform secrets are not copied into Postgres; Vercel encrypts env vars at rest and injects them at runtime. TLS certs are Vercel-managed, not stored in-app. The only app-persisted secret is the Google refresh token: AES-256-GCM in src/lib/crypto.ts (32-byte key, random 12-byte IV, iv.ciphertext.authTag; auth-tag fail closed). Access tokens are in-memory only. Session cookies are JWEs bound to AUTH_SECRET (24h).

Rotation / revocation / incident. Rotate by replacing the Sensitive env value and redeploying, then revoke the old provider key. Gmail disconnect/delete calls Google revoke and deletes refresh_token_enc. Rotating AUTH_SECRET invalidates sessions; rotating TOKEN_ENCRYPTION_KEY requires users to reconnect Gmail. Exposed secrets are replaced immediately (new value + provider revoke + redeploy).

Monitoring. Vercel records Added/Updated time and actor on each env var and keeps deploy/env-change activity. The app emits secret.encrypt / secret.decrypt (kind, purpose, ok, at) to Vercel Runtime Logs. Ciphertext, plaintext, IVs, and keys are never logged.

Evidence attached: (1) full /security/secrets page including the OWASP mapping table; (2) Vercel env list, names only, Sensitive; (3) Vercel Activity showing an env change + actor; (4) src/lib/crypto.ts AES-256-GCM + auditSecretAccess; (5) Runtime Log lines secret.decrypt with no secret values.

---

## Screenshot pack (upload these, not Privacy Policy)

1. Full `https://www.inboxwingman.com/security/secrets` — scroll so the **OWASP mapping** table and **Rotation** section are visible (two shots if needed).
2. Vercel → Project → Settings → Environment Variables: names + Sensitive + Production/Preview. **Never show values.**
3. Vercel → Activity: an environment-variable Added/Updated row with the **actor** and timestamp.
4. `src/lib/crypto.ts` in the repo: `encryptSecret` / `decryptSecret` / `auditSecretAccess`.
5. Vercel → Logs: one `secret.encrypt` or `secret.decrypt` line (`kind`, `purpose`, `ok`, `at` only).

Do **not** re-upload Privacy Policy as the only 6.7.1 file. That is why the first reject kept coming back.
