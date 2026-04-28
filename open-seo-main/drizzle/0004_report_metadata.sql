-- Migration: 0004_report_metadata
-- Description: Create reports table for PDF report metadata
--
-- Tables created:
--   - reports: Report metadata with generation status and PDF path
--
-- Note: client_id is a UUID reference to AI-Writer's clients table.
-- No FK constraint since tables are in different databases.

-- Report metadata table
CREATE TABLE IF NOT EXISTS "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"report_type" text NOT NULL,
	"date_range_start" text NOT NULL,
	"date_range_end" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"content_hash" text NOT NULL,
	"pdf_path" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Index on client_id for listing client reports
CREATE INDEX IF NOT EXISTS "ix_reports_client_id" ON "reports" USING btree ("client_id");

-- Unique constraint on (client_id, content_hash) for cache deduplication
CREATE UNIQUE INDEX IF NOT EXISTS "uq_reports_client_content_hash" ON "reports" USING btree ("client_id", "content_hash");

-- Index on status for filtering by generation status
CREATE INDEX IF NOT EXISTS "ix_reports_status" ON "reports" USING btree ("status");
