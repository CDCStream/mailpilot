import type { Metadata } from "next";
import Link from "next/link";
import { MarketingShell } from "@/components/marketing-shell";

export const metadata: Metadata = {
  title: "Secrets management — Inbox Wingman",
  description:
    "How Inbox Wingman stores, encrypts, access-controls, and monitors server-side secrets (CASA 6.7.1).",
};

const INVENTORY = [
  {
    secret: "AUTH_SECRET",
    class: "Platform secret",
    store: "Vercel env (Sensitive)",
    crypto: "Used to encrypt/sign session JWEs (dir / A128CBC-HS256). Never written to the database or the browser.",
  },
  {
    secret: "TOKEN_ENCRYPTION_KEY",
    class: "Platform secret",
    store: "Vercel env (Sensitive)",
    crypto: "32-byte AES-256 key (hex). Unlocks stored Google refresh tokens only. Never logged.",
  },
  {
    secret: "GOOGLE_CLIENT_SECRET",
    class: "Platform secret",
    store: "Vercel env (Sensitive)",
    crypto: "OAuth client secret. Server runtime only; used to exchange authorization codes and refresh access tokens.",
  },
  {
    secret: "OPENAI_API_KEY",
    class: "Platform secret",
    store: "Vercel env (Sensitive)",
    crypto: "Provider API key. Read from process.env on the server. Never sent to the browser or stored in Postgres.",
  },
  {
    secret: "DATABASE_URL",
    class: "Platform secret",
    store: "Vercel env (Sensitive)",
    crypto: "Postgres connection string (Supabase). Server-only. TLS to the database.",
  },
  {
    secret: "RESEND_API_KEY, Inngest keys, Stripe / Paddle / cron / Pub/Sub secrets",
    class: "Platform secret",
    store: "Vercel env (Sensitive)",
    crypto: "Same control: env-only, not NEXT_PUBLIC_, not in git, not in client bundles.",
  },
  {
    secret: "Google refresh token (per mailbox)",
    class: "Application secret",
    store: "Postgres column refresh_token_enc",
    crypto: "AES-256-GCM before INSERT/UPDATE. Format iv.ciphertext.authTag. Decrypted in memory only for Gmail API or revoke.",
  },
  {
    secret: "Google access token",
    class: "Ephemeral",
    store: "Not stored",
    crypto: "Minted in process memory by the Google client from the refresh token. Never persisted, never sent to the browser.",
  },
  {
    secret: "Session cookie",
    class: "Session secret",
    store: "HttpOnly Secure cookie",
    crypto: "Encrypted JWE bound to AUTH_SECRET. maxAge 24 hours. Cleared on sign-out.",
  },
] as const;

export default function SecretsManagementPage() {
  return (
    <MarketingShell wide>
      <p className="text-sm font-medium uppercase tracking-widest text-teal-700">Security</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight">Secrets management</h1>
      <p className="mt-3 text-zinc-600">
        Control 6.7.1 — The application securely stores access tokens, API keys, and other
        server-side secrets. This page is the public access-control, cryptography, and monitoring
        policy for Inbox Wingman.
      </p>
      <p className="mt-2 text-sm text-zinc-500">Last updated: 24 August 2026</p>

      <div className="mt-10 space-y-10 text-sm leading-relaxed text-zinc-700">
        <section>
          <h2 className="text-lg font-semibold text-zinc-900">1. Access-control policy</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              Server secrets live only as Vercel project environment variables for this project,
              scoped to Production and Preview. They are marked Sensitive. Values are hidden in
              the dashboard after save (lock / Sensitive). They are not <code>NEXT_PUBLIC_</code>{" "}
              and are never bundled to the browser.
            </li>
            <li>
              Only Vercel project members with environment-variable permission can view or edit
              them. There is no in-app admin console that displays secret values.
            </li>
            <li>
              Application source does not contain live secrets. Configuration is injected at
              deploy by the Vercel runtime.
            </li>
            <li>
              Per-user Google refresh tokens are readable only by the server process that holds{" "}
              <code>TOKEN_ENCRYPTION_KEY</code>. End users, browsers, and client JavaScript cannot
              request the ciphertext or the key.
            </li>
            <li>
              Decryption happens only on the server, only to call the Gmail API or to revoke the
              token when a mailbox or account is deleted.
            </li>
            <li>
              Application logs must not record secret values, session tokens, card data, or raw
              refresh tokens (see also 6.5.1).
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">2. Cryptographic protection</h2>
          <p className="mt-3">
            Platform secrets (API keys, <code>AUTH_SECRET</code>, <code>TOKEN_ENCRYPTION_KEY</code>,
            database URL, billing keys) are not copied into the application database. Vercel stores
            project environment variables encrypted at rest and injects them into the serverless
            runtime. That is the storage mechanism for those secrets.
          </p>
          <p className="mt-3">
            Application secrets that must persist (Google refresh tokens) are encrypted in the
            application with AES-256-GCM before they are written to Postgres:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Algorithm: AES-256-GCM (Node.js <code>crypto.createCipheriv</code>)</li>
            <li>Key: 32-byte value from <code>TOKEN_ENCRYPTION_KEY</code> (64 hex chars)</li>
            <li>IV: 12 random bytes per encryption</li>
            <li>Stored form: <code>iv.ciphertext.authTag</code> (base64 parts)</li>
            <li>Tampered ciphertext fails closed (auth-tag verification throws; no plaintext)</li>
          </ul>
          <p className="mt-3">
            Session tokens are encrypted JWEs using a key derived from <code>AUTH_SECRET</code>{" "}
            (<code>alg=dir</code>, <code>enc=A128CBC-HS256</code>). Short-lived Google access
            tokens are never stored.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">3. Secret inventory</h2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Secret</th>
                  <th className="px-4 py-3 font-medium">Class</th>
                  <th className="px-4 py-3 font-medium">Store</th>
                  <th className="px-4 py-3 font-medium">Protection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {INVENTORY.map((row) => (
                  <tr key={row.secret}>
                    <td className="px-4 py-3 font-medium text-zinc-900">{row.secret}</td>
                    <td className="px-4 py-3">{row.class}</td>
                    <td className="px-4 py-3">{row.store}</td>
                    <td className="px-4 py-3 text-zinc-600">{row.crypto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-zinc-900">4. Logging and monitoring</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              <strong>Platform.</strong> Each Vercel environment variable shows Added / Updated
              timestamps and the actor. Deployments and environment changes appear in Vercel
              project activity. Members review that history; values stay hidden.
            </li>
            <li>
              <strong>Application.</strong> Encrypt and decrypt of stored Google refresh tokens
              emit a structured log event <code>secret.encrypt</code> / <code>secret.decrypt</code>{" "}
              with <code>kind</code>, <code>purpose</code> (<code>gmail.persist</code>,{" "}
              <code>gmail.api</code>, <code>gmail.revoke</code>), <code>ok</code>, and{" "}
              <code>at</code>. Ciphertext, plaintext, IVs, and keys are omitted. Events go to
              Vercel Runtime Logs and are retained with the project log stream.
            </li>
            <li>
              Failed decrypts (wrong key or tampered payload) are logged with <code>ok: false</code>{" "}
              and throw; the request fails closed.
            </li>
          </ul>
        </section>

        <p>
          Related:{" "}
          <Link href="/security" className="underline">
            Security
          </Link>
          ,{" "}
          <Link href="/privacy" className="underline">
            Privacy Policy
          </Link>
          ,{" "}
          <Link href="/dpa" className="underline">
            DPA
          </Link>
          .
        </p>
      </div>
    </MarketingShell>
  );
}
