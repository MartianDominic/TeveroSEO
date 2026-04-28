-- Migration: Create detected_patterns table for cross-client pattern detection
-- Phase 25: Team & Intelligence

CREATE TABLE IF NOT EXISTS "detected_patterns" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "pattern_type" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "affected_client_ids" jsonb,
  "affected_count" integer DEFAULT 0,
  "magnitude" numeric,
  "direction" text,
  "confidence" numeric,
  "start_date" timestamp with time zone,
  "end_date" timestamp with time zone,
  "status" text DEFAULT 'active',
  "resolved_at" timestamp with time zone,
  "detected_at" timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_detected_patterns_workspace" ON "detected_patterns" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_detected_patterns_type" ON "detected_patterns" ("pattern_type");
CREATE INDEX IF NOT EXISTS "idx_detected_patterns_status" ON "detected_patterns" ("status");
