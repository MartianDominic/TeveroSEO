-- Migration: keyword_rankings table and tracking_enabled column
-- Phase 17-01: Rank Tracking History Schema

-- Add tracking_enabled column to saved_keywords
ALTER TABLE "saved_keywords" ADD COLUMN "tracking_enabled" boolean DEFAULT true;

-- Create keyword_rankings table for daily position snapshots
CREATE TABLE IF NOT EXISTS "keyword_rankings" (
	"id" text PRIMARY KEY NOT NULL,
	"keyword_id" text NOT NULL,
	"position" integer NOT NULL,
	"previous_position" integer,
	"url" text,
	"date" timestamp with time zone NOT NULL,
	"serp_features" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key constraint (cascade delete)
ALTER TABLE "keyword_rankings" ADD CONSTRAINT "keyword_rankings_keyword_id_saved_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."saved_keywords"("id") ON DELETE cascade ON UPDATE no action;

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS "uq_rankings_keyword_date" ON "keyword_rankings" USING btree ("keyword_id","date");
CREATE INDEX IF NOT EXISTS "ix_rankings_date" ON "keyword_rankings" USING btree ("date");
CREATE INDEX IF NOT EXISTS "ix_rankings_keyword_id" ON "keyword_rankings" USING btree ("keyword_id");
