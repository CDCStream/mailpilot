ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "plan" text;
CREATE TABLE IF NOT EXISTS "credit_usage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "period" text NOT NULL,
  "credits_used" integer DEFAULT 0 NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "credit_usage_user_period_idx" ON "credit_usage" ("user_id","period");
