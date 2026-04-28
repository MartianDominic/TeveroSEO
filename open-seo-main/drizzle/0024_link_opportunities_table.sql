-- Phase 35-02: Link Opportunities Schema
-- Table for storing detected internal linking opportunities

-- link_opportunities: actionable internal linking opportunities
CREATE TABLE IF NOT EXISTS "link_opportunities" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "audit_id" text NOT NULL REFERENCES "audits"("id") ON DELETE CASCADE,
  "page_id" text REFERENCES "audit_pages"("id") ON DELETE SET NULL,
  "page_url" text NOT NULL,
  "opportunity_type" text NOT NULL,
  "urgency" real NOT NULL DEFAULT 0.5,
  "current_depth" integer,
  "target_depth" integer,
  "current_inbound_count" integer,
  "current_exact_match_count" integer,
  "suggested_source_pages" jsonb,
  "suggested_anchor_text" text,
  "reason" text NOT NULL,
  "status" text NOT NULL DEFAULT 'pending',
  "implemented_at" timestamp with time zone,
  "implemented_by_change_id" text,
  "detected_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for link_opportunities
CREATE INDEX IF NOT EXISTS "ix_link_opportunities_client_audit" ON "link_opportunities" ("client_id", "audit_id");
CREATE INDEX IF NOT EXISTS "ix_link_opportunities_type" ON "link_opportunities" ("opportunity_type");
CREATE INDEX IF NOT EXISTS "ix_link_opportunities_urgency" ON "link_opportunities" ("urgency");
CREATE INDEX IF NOT EXISTS "ix_link_opportunities_status" ON "link_opportunities" ("status");
CREATE INDEX IF NOT EXISTS "ix_link_opportunities_page_url" ON "link_opportunities" ("page_url");
