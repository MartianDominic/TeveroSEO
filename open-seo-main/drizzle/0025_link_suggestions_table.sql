-- Phase 35-03: Link Suggestions Schema
-- Table for AI-generated internal link recommendations

-- link_suggestions: AI-generated internal link recommendations with scoring
CREATE TABLE IF NOT EXISTS "link_suggestions" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "audit_id" text NOT NULL REFERENCES "audits"("id") ON DELETE CASCADE,
  "source_url" text NOT NULL,
  "source_page_id" text REFERENCES "audit_pages"("id") ON DELETE SET NULL,
  "target_url" text NOT NULL,
  "target_page_id" text REFERENCES "audit_pages"("id") ON DELETE SET NULL,
  "anchor_text" text NOT NULL,
  "anchor_type" text NOT NULL DEFAULT 'misc',
  "anchor_confidence" real NOT NULL DEFAULT 0.6,
  "score" real NOT NULL DEFAULT 0,
  "link_deficit_score" real NOT NULL DEFAULT 0,
  "exact_match_score" real NOT NULL DEFAULT 0,
  "orphan_score" real NOT NULL DEFAULT 0,
  "depth_score" real NOT NULL DEFAULT 0,
  "relevance_score" real NOT NULL DEFAULT 0,
  "reasons" jsonb NOT NULL DEFAULT '[]',
  "existing_text_match" text,
  "insertion_context" text,
  "status" text NOT NULL DEFAULT 'pending',
  "accepted_at" timestamp with time zone,
  "rejected_at" timestamp with time zone,
  "applied_at" timestamp with time zone,
  "applied_change_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for link_suggestions
CREATE INDEX IF NOT EXISTS "ix_link_suggestions_client_audit" ON "link_suggestions" ("client_id", "audit_id");
CREATE INDEX IF NOT EXISTS "ix_link_suggestions_source_url" ON "link_suggestions" ("source_url");
CREATE INDEX IF NOT EXISTS "ix_link_suggestions_target_url" ON "link_suggestions" ("target_url");
CREATE INDEX IF NOT EXISTS "ix_link_suggestions_status" ON "link_suggestions" ("status");
CREATE INDEX IF NOT EXISTS "ix_link_suggestions_score" ON "link_suggestions" ("score");
CREATE UNIQUE INDEX IF NOT EXISTS "ix_link_suggestions_unique_pair" ON "link_suggestions" ("audit_id", "source_url", "target_url");
