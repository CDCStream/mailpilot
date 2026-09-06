# CASA 6.7.1 — assessor reply (paste)

Portal limit: 1500 characters. Paste only the block below (~1280).

---

Compliant. Policy https://www.inboxwingman.com/security/secrets (OWASP Secrets Management).

Access. AUTH_SECRET, TOKEN_ENCRYPTION_KEY, GOOGLE_CLIENT_SECRET, OPENAI_API_KEY, DATABASE_URL, RESEND_API_KEY, Inngest, billing = Vercel Sensitive env (Production/Preview). Not NEXT_PUBLIC_, not in git, not in the browser. Only project members with env permission can view/edit. No admin UI shows values. Refresh tokens decrypt only on the server holding TOKEN_ENCRYPTION_KEY, only for Gmail API or revoke.

Crypto. Platform secrets stay in Vercel (encrypted at rest); TLS certs are Vercel-managed. Only persisted secret = Google refresh token: AES-256-GCM in src/lib/crypto.ts (32-byte key, 12-byte IV, iv.ciphertext.authTag; fail closed). Access tokens memory-only. Sessions = JWEs on AUTH_SECRET (24h).

Rotate. Replace Sensitive env + redeploy + revoke old provider key. Disconnect/delete revokes Gmail and deletes refresh_token_enc. AUTH_SECRET rotation kills sessions. Exposed secrets replaced immediately.

Monitor. Vercel logs env Added/Updated actor+time. App emits secret.encrypt/decrypt (kind, purpose, ok, at) to Runtime Logs; no ciphertext or keys.

Evidence: /security/secrets OWASP table; Vercel env names (Sensitive); Activity actor; crypto.ts; Runtime Log secret.decrypt.

---

## Screenshot pack (upload these, not Privacy Policy)

1. Full `https://www.inboxwingman.com/security/secrets` — scroll so the **OWASP mapping** table and **Rotation** section are visible (two shots if needed).
2. Vercel → Project → Settings → Environment Variables: names + Sensitive + Production/Preview. **Never show values.**
3. Vercel → Activity: an environment-variable Added/Updated row with the **actor** and timestamp.
4. `src/lib/crypto.ts` in the repo: `encryptSecret` / `decryptSecret` / `auditSecretAccess`.
5. Vercel → Logs: one `secret.encrypt` or `secret.decrypt` line (`kind`, `purpose`, `ok`, `at` only).

Do **not** re-upload Privacy Policy as the only 6.7.1 file. That is why the first reject kept coming back.
