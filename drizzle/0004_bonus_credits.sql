ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bonus_credits" integer DEFAULT 0 NOT NULL;
CREATE TABLE IF NOT EXISTS "credit_topups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "stripe_session_id" text NOT NULL UNIQUE,
  "pack_id" text NOT NULL,
  "credits" integer NOT NULL,
  "amount_cents" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "credit_topups_session_idx" ON "credit_topups" ("stripe_session_id");
