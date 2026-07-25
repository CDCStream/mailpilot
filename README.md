# MailPilot

AI email assistant that works *inside* Gmail: smart triage labels, reply drafts in your
voice, a daily brief, follow-up tracking, and plain-English rules. Built with Next.js,
Drizzle/Postgres, Inngest, OpenAI, Stripe, and Resend.

## How it works

1. User signs in with Google (`gmail.modify` scope). The refresh token is AES-256-GCM
   encrypted and stored.
2. Onboarding (Inngest `account-connected`): creates the `MailPilot/*` labels in Gmail,
   registers a Gmail push watch (INBOX + SENT → Pub/Sub), builds a writing-style profile
   from sent mail, triages the 10 most recent inbox emails, and anchors a Gmail
   `historyId` cursor.
3. **Push-driven sync**: Gmail notifies a Pub/Sub topic on every mailbox change; the push
   subscription POSTs to `/api/gmail/push`, which queues a `sync-account` run (debounced
   per account). The sync does an incremental `history.list`: each new inbox email is
   classified by an LLM, user rules are applied, Gmail labels/archiving happen, and — for
   "To Respond" emails — a reply draft in the user's voice is created directly in the
   thread. Sent emails create follow-up trackers; inbound replies close them.
   A 30-minute polling cron (`schedule-syncs`) acts only as a safety net for missed
   pushes, and `renew-watches` re-registers every watch daily (Google expires them after
   ~7 days).
4. Hourly (`daily-brief`): users whose local brief hour arrived get a summary email via
   Resend.

Only metadata is stored (sender, subject, snippet, category, summary) — never full bodies.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in values

# Generate + apply the database schema
npx drizzle-kit push

# Terminal 1: Next.js
npm run dev

# Terminal 2: Inngest dev server (runs the background jobs locally)
npx inngest-cli@latest dev
```

Set `BILLING_ENABLED=false` locally to skip Stripe checks.

### Required services

| Service  | What for                          | Notes |
| -------- | --------------------------------- | ----- |
| Postgres | app data                          | Railway Postgres plugin or Neon/Supabase |
| Google Cloud | OAuth + Gmail API + Pub/Sub   | enable **Gmail API**, create OAuth Web Client, redirect URI `<APP_URL>/api/auth/callback/google` |
| OpenAI   | classification + drafting         | |
| Stripe   | subscription ($19/mo, 7-day trial)| create a Product + monthly Price, set `STRIPE_PRICE_ID`; webhook endpoint `<APP_URL>/api/stripe/webhook` with `customer.subscription.*` events |
| Resend   | daily brief emails                | verify a sending domain |
| Inngest  | background jobs                   | free tier; register `<APP_URL>/api/inngest` as the app URL |

## Gmail push notifications (Pub/Sub) setup

Real-time sync is push-driven instead of polling. One-time setup in Google Cloud:

1. Enable the **Cloud Pub/Sub API** in the same project as the OAuth client.
2. Create a topic, e.g. `gmail-notifications`, and set `GMAIL_PUBSUB_TOPIC` to its full
   name (`projects/<project>/topics/gmail-notifications`).
3. On that topic, grant the role **Pub/Sub Publisher** to
   `gmail-api-push@system.gserviceaccount.com` (this is Gmail's service account).
4. Create a **push subscription** on the topic with delivery URL
   `https://<app-domain>/api/gmail/push?token=<PUBSUB_VERIFICATION_TOKEN>`
   (generate a long random value for the token and set the env var).
5. Deploy — watches are registered per account during onboarding and renewed daily by
   the `renew-watches` job.

If `GMAIL_PUBSUB_TOPIC` is unset (e.g. local dev), the app still works: the 30-minute
polling safety net handles sync alone.

## Deploying (Railway)

The app runs as a single long-running Next.js service on Railway — no serverless
timeouts, flat pricing, and the Pub/Sub push endpoint is just a route handler.

1. Push the repo to GitHub, create a Railway project, and add the service from the repo
   (`railway.json` configures build/start/healthcheck automatically).
2. Add a **Postgres** database to the project and use its `DATABASE_URL`.
3. Set every variable from `.env.example` in the service settings
   (`BILLING_ENABLED=true`, real `AUTH_URL`/`NEXT_PUBLIC_APP_URL` pointing at your
   Railway domain or custom domain).
4. In the Inngest dashboard, create an app and register `<APP_URL>/api/inngest`; copy
   `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` into Railway.
5. Add the production redirect URI to the Google OAuth client, the webhook URL to
   Stripe, and complete the Pub/Sub setup above with your Railway domain.
6. Run `npx drizzle-kit push` (or apply the SQL in `drizzle/`) against the production
   database once.

## Google OAuth verification (start this early)

`gmail.modify` is a **restricted scope**. Until verified, only 100 test users can connect.

Checklist for the verification submission:

- [ ] OAuth consent screen: app name, logo, support email, domains
- [ ] Public homepage that explains Gmail data usage (landing page covers this)
- [ ] Privacy policy URL (`/privacy`, includes the required Limited Use disclosure)
- [ ] Terms URL (`/terms`)
- [ ] Demo video showing the OAuth flow and how each scope is used
- [ ] Scope justification: labeling (`labels.*`, `messages.modify`), draft creation
      (`drafts.create`), style learning + sync (`messages.list/get`, `history.list`)
- [ ] CASA Tier 2 security assessment (annual, via an approved assessor —
      budget roughly $500–800/yr)

## Cost guards

Per-user daily caps (env-configurable): `MAX_DAILY_CLASSIFICATIONS` (default 300) and
`MAX_DAILY_DRAFTS` (default 50). Sync processes at most 20 messages per run per account.

## Project layout

```
src/
  auth.ts                 Auth.js (Google OAuth + token persistence)
  lib/
    db/schema.ts          Drizzle schema (users, accounts, messages, rules, followups, ...)
    gmail.ts              Gmail API helpers (labels, history sync, drafts, MIME)
    ai.ts                 OpenAI calls (classify, voice profile, drafts, rule parsing)
    pipeline.ts           Per-message triage pipeline
    rules-engine.ts       Structured rule matching
    brief.ts              Daily brief compilation + email
    billing.ts            Stripe helpers + access checks
    usage.ts              Daily LLM budget counters
  inngest/functions.ts    Background jobs (onboarding, sync fan-out, sync, brief)
  app/
    page.tsx              Landing
    login/ onboarding/    Auth + setup flow
    dashboard/            Overview, Rules, Follow-ups, Settings, Billing
    api/                  auth, inngest, stripe, onboarding routes
```
