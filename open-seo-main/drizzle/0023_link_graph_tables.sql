-- Phase 35-01: Link Graph Schema
-- Tables for internal link analysis: link_graph, page_links, orphan_pages

-- link_graph: stores every internal link with detailed attributes
CREATE TABLE IF NOT EXISTS "link_graph" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "audit_id" text NOT NULL REFERENCES "audits"("id") ON DELETE CASCADE,
  "source_url" text NOT NULL,
  "source_page_id" text REFERENCES "audit_pages"("id") ON DELETE SET NULL,
  "target_url" text NOT NULL,
  "target_page_id" text REFERENCES "audit_pages"("id") ON DELETE SET NULL,
  "anchor_text" text NOT NULL DEFAULT '',
  "anchor_text_lower" text NOT NULL DEFAULT '',
  "anchor_context" text,
  "position" text NOT NULL DEFAULT 'body',
  "paragraph_index" integer,
  "is_first_paragraph" boolean NOT NULL DEFAULT false,
  "is_second_paragraph" boolean NOT NULL DEFAULT false,
  "is_do_follow" boolean NOT NULL DEFAULT true,
  "has_no_opener" boolean NOT NULL DEFAULT false,
  "has_title" boolean NOT NULL DEFAULT false,
  "link_text" text,
  "link_type" text NOT NULL DEFAULT 'contextual',
  "is_exact_match" boolean NOT NULL DEFAULT false,
  "is_branded" boolean NOT NULL DEFAULT false,
  "is_url" boolean NOT NULL DEFAULT false,
  "discovered_at" timestamp with time zone NOT NULL DEFAULT now(),
  "verified_at" timestamp with time zone
);

-- page_links: aggregated link metrics per page
CREATE TABLE IF NOT EXISTS "page_links" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "audit_id" text NOT NULL REFERENCES "audits"("id") ON DELETE CASCADE,
  "page_id" text NOT NULL REFERENCES "audit_pages"("id") ON DELETE CASCADE,
  "page_url" text NOT NULL,
  "inbound_total" integer NOT NULL DEFAULT 0,
  "inbound_body" integer NOT NULL DEFAULT 0,
  "inbound_nav" integer NOT NULL DEFAULT 0,
  "inbound_footer" integer NOT NULL DEFAULT 0,
  "inbound_sidebar" integer NOT NULL DEFAULT 0,
  "inbound_first_paragraph" integer NOT NULL DEFAULT 0,
  "inbound_exact_match" integer NOT NULL DEFAULT 0,
  "inbound_branded" integer NOT NULL DEFAULT 0,
  "inbound_do_follow" integer NOT NULL DEFAULT 0,
  "outbound_total" integer NOT NULL DEFAULT 0,
  "outbound_body" integer NOT NULL DEFAULT 0,
  "outbound_internal" integer NOT NULL DEFAULT 0,
  "outbound_external" integer NOT NULL DEFAULT 0,
  "unique_anchors" integer NOT NULL DEFAULT 0,
  "anchor_distribution" jsonb,
  "top_anchors" jsonb,
  "click_depth_from_home" integer,
  "link_score" real,
  "opportunity_score" real,
  "computed_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- orphan_pages: pages with zero inbound internal links
CREATE TABLE IF NOT EXISTS "orphan_pages" (
  "id" text PRIMARY KEY NOT NULL,
  "client_id" text NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "audit_id" text NOT NULL REFERENCES "audits"("id") ON DELETE CASCADE,
  "page_id" text REFERENCES "audit_pages"("id") ON DELETE SET NULL,
  "page_url" text NOT NULL,
  "page_title" text,
  "discovery_source" text NOT NULL,
  "search_volume" integer,
  "monthly_traffic" integer,
  "target_keyword" text,
  "status" text NOT NULL DEFAULT 'detected',
  "fixed_at" timestamp with time zone,
  "fixed_by_change_id" text,
  "detected_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for link_graph
CREATE INDEX IF NOT EXISTS "ix_link_graph_client_audit" ON "link_graph" ("client_id", "audit_id");
CREATE INDEX IF NOT EXISTS "ix_link_graph_source_url" ON "link_graph" ("source_url");
CREATE INDEX IF NOT EXISTS "ix_link_graph_target_url" ON "link_graph" ("target_url");
CREATE INDEX IF NOT EXISTS "ix_link_graph_target_page" ON "link_graph" ("target_page_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ix_link_graph_unique_link" ON "link_graph" ("audit_id", "source_url", "target_url", "anchor_text_lower");

-- Indexes for page_links
CREATE INDEX IF NOT EXISTS "ix_page_links_client_audit" ON "page_links" ("client_id", "audit_id");
CREATE INDEX IF NOT EXISTS "ix_page_links_page_url" ON "page_links" ("page_url");
CREATE INDEX IF NOT EXISTS "ix_page_links_opportunity" ON "page_links" ("opportunity_score");
CREATE INDEX IF NOT EXISTS "ix_page_links_click_depth" ON "page_links" ("click_depth_from_home");

-- Indexes for orphan_pages
CREATE INDEX IF NOT EXISTS "ix_orphan_pages_client_audit" ON "orphan_pages" ("client_id", "audit_id");
CREATE INDEX IF NOT EXISTS "ix_orphan_pages_status" ON "orphan_pages" ("status");
