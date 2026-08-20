ALTER TABLE "sender_category_cache" ADD COLUMN IF NOT EXISTS "sample_count" integer DEFAULT 0 NOT NULL;

DELETE FROM "sender_category_cache"
WHERE "category" IN ('money', 'security');

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "classifier_version" text;

CREATE TABLE IF NOT EXISTS "retriage_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "scope" text NOT NULL,
  "status" text DEFAULT 'queued' NOT NULL,
  "processed" integer DEFAULT 0 NOT NULL,
  "total" integer DEFAULT 0 NOT NULL,
  "last_gmail_message_id" text,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
