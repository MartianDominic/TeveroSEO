-- Migration: rank_drop_events table and drop_alert_threshold column
-- Phase 17-04: Rank Drop Alerts Integration

-- Add drop_alert_threshold column to saved_keywords
ALTER TABLE "saved_keywords" ADD COLUMN "drop_alert_threshold" integer DEFAULT 5;

-- Create rank_drop_events table for alert system
CREATE TABLE IF NOT EXISTS "rank_drop_events" (
	"id" text PRIMARY KEY NOT NULL,
	"keyword_id" text NOT NULL,
	"project_id" text NOT NULL,
	"client_id" text,
	"keyword" text NOT NULL,
	"previous_position" integer NOT NULL,
	"current_position" integer NOT NULL,
	"drop_amount" integer NOT NULL,
	"threshold" integer NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processed_by" text
);

-- Add foreign key constraint (cascade delete)
ALTER TABLE "rank_drop_events" ADD CONSTRAINT "rank_drop_events_keyword_id_saved_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."saved_keywords"("id") ON DELETE cascade ON UPDATE no action;

-- Create indexes
CREATE INDEX IF NOT EXISTS "ix_rank_drop_events_client_processed" ON "rank_drop_events" USING btree ("client_id","processed_at");
CREATE INDEX IF NOT EXISTS "ix_rank_drop_events_keyword" ON "rank_drop_events" USING btree ("keyword_id");
CREATE INDEX IF NOT EXISTS "ix_rank_drop_events_detected" ON "rank_drop_events" USING btree ("detected_at");
