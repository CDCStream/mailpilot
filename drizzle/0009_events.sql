CREATE TABLE IF NOT EXISTS "events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid,
  "anon_id" text NOT NULL,
  "event" text NOT NULL,
  "path" text,
  "referrer" text,
  "properties" jsonb,
  "user_agent" text,
  "country" text,
  "region" text,
  "city" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "events" ADD CONSTRAINT "events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_created_idx" ON "events" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_event_idx" ON "events" USING btree ("event");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_user_idx" ON "events" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_anon_idx" ON "events" USING btree ("anon_id");
