-- Analysis Sessions Table
-- Phase 82: Chat Integration
-- Stores keyword analysis sessions for conversation memory

CREATE TABLE IF NOT EXISTS "analysis_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL,
  "workspace_id" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "conversation" text NOT NULL,
  "constraints_hash" text NOT NULL,
  "keyword_count" integer NOT NULL,
  "selected_count" integer NOT NULL,
  "excluded_count" integer NOT NULL,
  "breakdown" jsonb NOT NULL,
  "result" jsonb
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS "analysis_sessions_client_id_idx"
  ON "analysis_sessions" ("client_id");

CREATE INDEX IF NOT EXISTS "analysis_sessions_workspace_id_idx"
  ON "analysis_sessions" ("workspace_id");

CREATE INDEX IF NOT EXISTS "analysis_sessions_created_at_idx"
  ON "analysis_sessions" ("created_at");

CREATE INDEX IF NOT EXISTS "analysis_sessions_constraints_hash_idx"
  ON "analysis_sessions" ("constraints_hash");
