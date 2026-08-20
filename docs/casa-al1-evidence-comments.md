# CASA AL1 — Evidence comments (paste into TAC OTQ)

App: Inbox Wingman · https://www.inboxwingman.com  
Stack: Next.js on Vercel, NextAuth (Google OAuth only), PostgreSQL (Supabase), AES-256-GCM token encryption.

**Upload column:** only where noted. Most rows = comment only.

---

## 1 – Authentication

**1.1.1** Authentication is resistant to brute force attacks  
`N/A for local passwords. Authentication is exclusively Google OAuth via NextAuth. There is no username/password form. Brute-force resistance for credentials is provided by Google's account protection.`  
📷 Upload: login page screenshot (Google-only CTA, no password fields)

**1.1.2** System generated initial passwords or activation codes  
`N/A. The application does not generate, email, or manage local passwords or activation codes. Account creation occurs only after successful Google OAuth.`

**1.1.3** Passwords shall be stored resistant to offline attacks  
`N/A. No application-managed passwords are stored. User authentication secrets remain with Google. Google refresh tokens stored server-side are encrypted at rest with AES-256-GCM (not password hashes).`  
📷 Upload: privacy/security page stating tokens encrypted AES-256-GCM (optional)

**1.2.1** Default credentials shall not present on publicly exposed interfaces  
`Compliant. No default admin/user credentials exist. Access requires Google OAuth for a provisioned user. No shared default accounts on public interfaces.`  
📷 Upload: login page screenshot

**1.3.1** Out of band verifier shall expire in a reasonable timeframe  
`N/A. The application does not implement its own out-of-band verifiers (OTP/email codes). Any OOB verification is handled by Google during OAuth/sign-in.`

**1.3.2** Out of band verifier shall only be used once  
`N/A. Same as 1.3.1 — no app-issued OOB verifiers.`

**1.3.3** Out of band verifier shall be securely random  
`N/A. Same as 1.3.1 — no app-issued OOB verifiers.`

**1.3.4** Out of band verifier shall be resistant to brute force attacks  
`N/A. Same as 1.3.1 — no app-issued OOB verifiers.`

---

## 2 – Session Management

**2.1.1** Passwords/session tokens not in URL parameters  
`Compliant. Session is maintained via HTTP-only cookies (NextAuth JWT strategy). Access tokens and API keys are never placed in URL query strings. OAuth uses standard redirect flows without embedding secrets in query strings beyond the short-lived authorization code exchanged server-side.`

**2.2.1** Users can logout; logout invalidates session  
`Compliant. Users can sign out via the dashboard (NextAuth signOut). Logout clears the application session cookie. Google account refresh tokens can be revoked on disconnect/account deletion.`  
📷 Upload: dashboard Sign out control (you take while logged in)

**2.2.2** Terminate other sessions after password change  
`N/A for app-managed passwords. Password changes occur only in the user's Google Account. Application sessions are JWT cookies bound to AUTH_SECRET; users can sign out of the app. No local password-reset flow exists.`

**2.2.3** Non-revocable stateless tokens expire within 24 hours  
`Compliant. The NextAuth session JWT is configured with maxAge of 24 hours (session: { strategy: "jwt", maxAge: 86400 }); tokens expire within 24 hours of issuance. Active sessions are transparently rotated; idle sessions expire and require re-login. Google API access uses short-lived OAuth access tokens obtained server-side from AES-256-GCM encrypted refresh tokens; access tokens are never exposed to the browser.`

**2.3.1** Cookie Secure attribute  
`Compliant. Production is served only over HTTPS (Vercel). NextAuth session cookies are issued with the Secure attribute; cookies additionally use the __Host- and __Secure- name prefixes, which browsers only accept over HTTPS with the Secure attribute set. Verified server-side: Set-Cookie returns "HttpOnly; Secure; SameSite=Lax" on all auth cookies.`  
📷 Upload: cookie panel PNG (zoomed, Value redacted) + `casa-2.3.1-set-cookie-headers.txt`

**2.3.2** Cookie HttpOnly attribute  
`Compliant. NextAuth session cookies are HttpOnly and not accessible to client-side JavaScript.`  
📷 Upload: same cookie panel showing HttpOnly ✓

**2.3.3** Session tokens rather than static API secrets  
`Compliant. Browser clients authenticate with session cookies. Server-side Google API access uses per-user OAuth tokens. Static API secrets (OpenAI, DB, encryption keys) remain in server environment variables only and are never sent to the browser.`

**2.3.4** Stateless tokens protected against tampering  
`Compliant. Session tokens are encrypted JWEs (alg=dir, enc=A128CBC-HS256) using a key derived from AUTH_SECRET, providing both confidentiality and integrity via authenticated encryption. Tokens failing decryption or integrity verification are rejected; alg=none is not accepted.`

**2.4.1** Full login / re-auth before sensitive transactions  
`Compliant. Account and data mutations (preferences, disconnect Gmail, delete account, billing when enabled) require an authenticated server session. Account deletion requires typing the account email to confirm. Unauthenticated users are redirected to login.`

---

## 3 – Access Control

**3.1.1** Least privilege on trusted service layer  
`Compliant. Authorization is enforced in server actions and API routes after session validation. Gmail data access is scoped to the authenticated user's linked accounts. Google OAuth requests only required scopes (openid, email, profile, gmail.modify).`

**3.1.2** Access-control attributes not user-manipulable  
`Compliant. User id and account ownership come from the server session and database, not from client-supplied trust fields. Clients cannot elevate privileges by editing request bodies.`

**3.1.3** Access controls fail securely  
`Compliant. Missing/invalid session results in Unauthorized / redirect to login. Failed DB lookups do not grant access. Errors do not fall open to other users' data.`

**3.1.4** Protect against IDOR  
`Compliant. Queries filter by the authenticated userId / owned accountIds (e.g. messages, drafts, chat threads). Users cannot read or mutate another user's records by guessing IDs.`

**3.1.5** Anti-CSRF  
`Compliant. Mutations use Next.js Server Actions / same-site cookie sessions. Cross-site form posts are mitigated by SameSite cookie behavior and framework CSRF protections for server actions.`

**3.1.6** Directory browsing disabled  
`Compliant. Deployed on Vercel as a Next.js application; no open directory listing of filesystem paths. Static assets are only those intentionally published under /public.`

**3.2.1** Secure OAuth 2.0 flows  
`Compliant. Google OAuth Authorization Code flow via NextAuth Google provider. No Implicit flow and no Resource Owner Password Credentials flow.`  
📷 Upload: login → Google OAuth consent screen flow (optional)

**3.2.2** Validate redirect_uri and state  
`Compliant. OAuth redirect URIs are fixed allowlisted URLs registered in Google Cloud Console for the production domain. NextAuth validates the OAuth state parameter to prevent CSRF during login.`  
📷 Upload: GCP OAuth client Authorized redirect URIs (you take from Cloud Console)

**3.3.1** Admin interfaces MFA  
`N/A / inherited. There is no separate privileged admin console. Application access uses Google accounts; users may enable MFA on their Google Account. No password-only admin panel exists.`

---

## 4 – Communications

**4.1.1** TLS 1.2+ enforced  
`Compliant. Production traffic terminates TLS on Vercel. HTTP clients are redirected to HTTPS. Modern TLS (1.2+) and secure cipher suites are provided by the platform.`  
📷 Upload: browser padlock / certificate viewer for www.inboxwingman.com

**4.1.2** Trusted TLS certificates  
`Compliant. Public certificates are issued by trusted CAs via Vercel. No self-signed certificates are used for the public production site.`  
📷 Upload: certificate details (Issuer = Let's Encrypt / Google Trust / etc.)

**4.1.3** No weak cryptography impacting confidential data  
`Compliant. TLS for transport; AES-256-GCM for Google refresh tokens at rest; AUTH_SECRET for JWT signing. No MD5/SHA1 password storage (no local passwords).`

**4.1.4** Crypto modules fail securely / no padding oracle  
`Compliant. Token decryption failures reject the operation rather than returning plaintext. Application does not implement custom CBC padding-oracle-prone protocols for user data.`

---

## 5 – Data Validation

**5.1.1** HTTP parameter pollution  
`Compliant. Request parameters are read via typed framework APIs (Next.js searchParams / FormData). Server logic does not trust duplicated conflicting parameters for authz decisions.`

**5.1.2** URL redirects allowlisted  
`Compliant. Post-login redirects stay within the application. OAuth callbacks use registered redirect URIs. External links in email content are rendered for the user but server-side open redirects are not used for auth.`

**5.1.3** Avoid eval() / dynamic code execution  
`Compliant. Application code does not use eval() or Function() on user input. AI outputs are treated as data (text) for display/drafts, not executed as code.`

**5.1.4** Template injection  
`Compliant. React/Next.js escapes output by default. User/AI content is rendered as text/React nodes, not as unsanitized HTML templates with server-side evaluation.`

**5.1.5** SSRF  
`Compliant. Server does not fetch arbitrary user-supplied URLs. Outbound calls go to allowlisted providers (Google APIs, OpenAI, Resend, billing) with fixed endpoints.`

**5.1.6** XPath / XML injection  
`N/A. Application does not process user-controlled XPath/XML queries.`

**5.1.7** XSS protection  
`Compliant. React default output escaping for all UI. Email HTML for reading is constrained (iframe/srcDoc with limited context where used). User-controlled markdown/text is rendered with a minimal sanitizing renderer. Defense in depth: a Content-Security-Policy (frame-ancestors 'none', object-src 'none', restricted script/connect sources) plus X-Content-Type-Options: nosniff and X-Frame-Options: DENY are served on all routes.`  
📷 Upload: securityheaders.com scan screenshot (after deploy)

**5.1.8** Database injection  
`Compliant. Database access uses Drizzle ORM parameterized queries. User input is not concatenated into raw SQL.`

**5.1.9** OS command injection  
`Compliant. Application does not shell out with user input. No OS command execution paths in request handling.`

**5.1.10** LFI / RFI  
`Compliant. No user-controlled file path includes for server filesystem reads. Dynamic imports are not driven by user input.`

**5.2.1** Malicious file uploads  
`N/A / limited. End users do not upload arbitrary executable files to the app. Gmail attachments remain in Google; the app does not host a general file-upload endpoint for executables.`

---

## 6 – Configuration

**6.1.1** Components without known exploitable vulnerabilities  
`npm audit reviewed and fixable advisories patched (see attached output). Remaining advisories are in Next.js-bundled build-time dependencies (postcss/sharp inside next@16.x) with no stable upstream patch available yet; they are build-time/image-processing components with no user-input exposure in this application, tracked for update when Next.js ships a fix. Automated DAST scanning is also in progress via TAC ESOF.`  
📷 Upload: `casa-6.1.1-npm-audit.txt`

**6.2.1** Disable debug modes in production  
`Compliant. Production runs with NODE_ENV=production on Vercel. No debug overlays, verbose stacks, or internal env flags are shown to users. Billing is presented as product “Early access” (not a debug/dev banner); env names such as BILLING_ENABLED are never rendered in the UI.`  
📷 Upload: `casa-6.2.1-no-debug-billing-early-access.png` (Billing page — Early access only)

**6.3.1** Origin header not used for authz  
`Compliant. Authorization is based on session cookies / server session identity, not the Origin header alone.`

**6.4.1** Subdomain takeover  
`Compliant. DNS for inboxwingman.com is managed on Vercel with active deployments for used hostnames (apex/www). Unused dangling DNS records pointing to unclaimed hosts are avoided.`

**6.5.1** Do not log credentials or payment details  
`Compliant. Application logs do not intentionally record passwords, session tokens, card data, or raw refresh tokens. Payment card data is handled by the payment provider when billing is enabled (not stored by the app).`

**6.6.1** Browser storage cleared on logout  
`Compliant. Primary session is an HttpOnly cookie cleared on NextAuth signOut. Application does not persist refresh tokens in localStorage. Client state is ephemeral.`  
📷 Upload: after logout, DevTools Application showing session cookie removed (you take)

**6.7.1** Secure storage of access tokens / API keys / secrets  
`Compliant. Server secrets (AUTH_SECRET, TOKEN_ENCRYPTION_KEY, OPENAI_API_KEY, DB URL) live in Vercel/server environment variables. Google refresh tokens are encrypted at rest with AES-256-GCM before database storage and never sent to the browser.`  
📷 Upload: privacy/security page mentioning AES-256-GCM + env-based secrets (no values shown)

---

## Upload map (48 req → file)

Folder: `docs/casa-evidence-screenshots/` (gitignored). One uniquely named PNG per requirement.

| Req | Upload file |
|-----|-------------|
| 1.1.1 | `casa-1.1.1-login-google-only.png` |
| 1.1.2 | `casa-1.1.2-no-local-passwords-login.png` |
| 1.1.3 | `casa-1.1.3-security-aes-gcm.png` |
| 1.2.1 | `casa-1.2.1-no-default-credentials-login.png` |
| 1.3.1 | `casa-1.3.1-no-app-oob-login.png` |
| 1.3.2 | `casa-1.3.2-no-app-oob-login.png` |
| 1.3.3 | `casa-1.3.3-no-app-oob-login.png` |
| 1.3.4 | `casa-1.3.4-no-app-oob-login.png` |
| 2.1.1 | `casa-2.1.1-session-jwt-cookies-not-url.png` |
| 2.2.1 | `casa-2.2.1-dashboard-sign-out.png` |
| 2.2.2 | `casa-2.2.2-no-local-password-reset-login.png` |
| 2.2.3 | `casa-2.2.3-jwt-maxage-24h.png` |
| 2.3.1 | `casa-2.3.1-cookies-secure-httponly.png` (+ optional `casa-2.3.1-set-cookie-headers.png` / `.txt`) |
| 2.3.2 | `casa-2.3.2-cookies-httponly.png` |
| 2.3.3 | `casa-2.3.3-session-cookie-not-static-api-secret.png` |
| 2.3.4 | `casa-2.3.4-jwe-auth-secret-integrity.png` |
| 2.4.1 | `casa-2.4.1-settings-delete-account-ui.png` (+ code: `casa-2.4.1-delete-account-email-confirm.png`) |
| 3.1.1 | `casa-3.1.1-least-privilege-scopes.png` |
| 3.1.2 | `casa-3.1.2-server-session-identity.png` |
| 3.1.3 | `casa-3.1.3-fail-secure-unauthorized.png` |
| 3.1.4 | `casa-3.1.4-idor-userId-filter.png` |
| 3.1.5 | `casa-3.1.5-server-actions-csrf.png` |
| 3.1.6 | `casa-3.1.6-directory-listing-disabled.png` |
| 3.2.1 | `casa-3.2.1-oauth-auth-code-flow.png` |
| 3.2.2 | `casa-3.2.2-gcp-oauth-redirect-uris.png` |
| 3.3.1 | `casa-3.3.1-no-admin-console-login.png` |
| 4.1.1 | `casa-4.1.1-https-homepage.png` (+ `casa-4.1.1-4.1.2-ssl-labs.png`) |
| 4.1.2 | `casa-4.1.2-tls-certificate.png` (+ SSL Labs / checker) |
| 4.1.3 | `casa-4.1.3-aes-256-gcm.png` |
| 4.1.4 | `casa-4.1.4-aes-gcm-fail-secure.png` |
| 5.1.1 | `casa-5.1.1-typed-params-formdata.png` |
| 5.1.2 | `casa-5.1.2-redirect-allowlisted.png` |
| 5.1.3 | `casa-5.1.3-no-eval-dynamic-code.png` |
| 5.1.4 | `casa-5.1.4-react-default-escaping.png` |
| 5.1.5 | `casa-5.1.5-ssrf-allowlisted-outbound.png` |
| 5.1.6 | `casa-5.1.6-no-xpath-xml-login.png` |
| 5.1.7 | `casa-5.1.7-securityheaders-scan.png` (+ `casa-5.1.7-csp-security-headers-code.png`) |
| 5.1.8 | `casa-5.1.8-drizzle-parameterized.png` |
| 5.1.9 | `casa-5.1.9-no-os-command-injection.png` |
| 5.1.10 | `casa-5.1.10-no-lfi-rfi.png` |
| 5.2.1 | `casa-5.2.1-no-general-file-upload.png` |
| 6.1.1 | `casa-6.1.1-npm-audit.png` (+ `.txt`) |
| 6.2.1 | `casa-6.2.1-no-debug-billing-early-access.png` |
| 6.3.1 | `casa-6.3.1-session-not-origin-authz.png` |
| 6.4.1 | `casa-6.4.1-dns-vercel-active.png` |
| 6.5.1 | `casa-6.5.1-encrypt-refresh-token-no-log.png` |
| 6.6.1 | `casa-6.6.1-after-logout-login-redirect.png` (+ `casa-6.6.1-session-null-after-logout.png`) |
| 6.7.1 | `casa-6.7.1-security-aes-gcm.png` (+ privacy / crypto code PNGs) |

Do **not** upload screenshots that show live secrets, `.env`, or raw tokens.
