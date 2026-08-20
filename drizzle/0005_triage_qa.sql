ALTER TABLE "briefs" ADD COLUMN IF NOT EXISTS "brief_date" text;

UPDATE "briefs"
SET "brief_date" = to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
WHERE "brief_date" IS NULL;

DELETE FROM "briefs" a
USING "briefs" b
WHERE a.user_id = b.user_id
  AND a.brief_date IS NOT NULL
  AND a.brief_date = b.brief_date
  AND (
    a.created_at < b.created_at
    OR (a.created_at = b.created_at AND a.id < b.id)
  );

CREATE UNIQUE INDEX IF NOT EXISTS "briefs_user_date_idx" ON "briefs" ("user_id", "brief_date");

CREATE TABLE IF NOT EXISTS "sender_category_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "sender_domain" text NOT NULL,
  "category" text NOT NULL,
  "user_override" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "sender_category_cache_user_domain_idx"
  ON "sender_category_cache" ("user_id", "sender_domain");
