-- Migration: 0005_content_intelligence.sql
-- Phase 96-04: Content Groups, Topic Clusters, Index Coverage
--
-- Tables created:
-- - content_groups: folder-based, regex, and manual content grouping
-- - content_group_pages: pages belonging to content groups
-- - analytics_topic_clusters: hub + spoke cluster relationships
-- - analytics_topic_cluster_pages: pages within clusters
-- - page_index_status: URL Inspection API results
-- - indexing_requests: batch indexing request tracking

-- ===== Content Groups =====

CREATE TABLE IF NOT EXISTS "content_groups" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "site_id" text NOT NULL REFERENCES "site_connections"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "description" text,
    "match_type" text NOT NULL,
    "match_pattern" text,
    "color" text,
    "is_auto_generated" boolean DEFAULT false,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_content_groups_site_name" ON "content_groups" ("site_id", "name");
CREATE INDEX IF NOT EXISTS "idx_content_groups_site" ON "content_groups" ("site_id");

CREATE TABLE IF NOT EXISTS "content_group_pages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "group_id" uuid NOT NULL REFERENCES "content_groups"("id") ON DELETE CASCADE,
    "page_url" text NOT NULL,
    "manually_added" boolean DEFAULT false,
    "created_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_content_group_pages" ON "content_group_pages" ("group_id", "page_url");
CREATE INDEX IF NOT EXISTS "idx_content_group_pages_group" ON "content_group_pages" ("group_id");
CREATE INDEX IF NOT EXISTS "idx_content_group_pages_url" ON "content_group_pages" ("page_url");

-- ===== Analytics Topic Clusters (Hub + Spoke) =====

CREATE TABLE IF NOT EXISTS "analytics_topic_clusters" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "site_id" text NOT NULL REFERENCES "site_connections"("id") ON DELETE CASCADE,
    "name" text NOT NULL,
    "hub_page_url" text NOT NULL,
    "hub_topic" text NOT NULL,
    "coverage" real DEFAULT 0,
    "total_clicks" integer DEFAULT 0,
    "total_impressions" integer DEFAULT 0,
    "avg_position" real,
    "gaps" jsonb DEFAULT '[]'::jsonb,
    "last_analyzed_at" timestamptz,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_analytics_topic_clusters_site_hub" ON "analytics_topic_clusters" ("site_id", "hub_page_url");
CREATE INDEX IF NOT EXISTS "idx_analytics_topic_clusters_site" ON "analytics_topic_clusters" ("site_id");

CREATE TABLE IF NOT EXISTS "analytics_topic_cluster_pages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "cluster_id" uuid NOT NULL REFERENCES "analytics_topic_clusters"("id") ON DELETE CASCADE,
    "page_url" text NOT NULL,
    "page_topic" text,
    "is_hub" boolean DEFAULT false,
    "links_to_hub" boolean DEFAULT false,
    "internal_link_count" integer DEFAULT 0,
    "clicks" integer DEFAULT 0,
    "impressions" integer DEFAULT 0,
    "position" real,
    "created_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_analytics_topic_cluster_pages" ON "analytics_topic_cluster_pages" ("cluster_id", "page_url");
CREATE INDEX IF NOT EXISTS "idx_analytics_topic_cluster_pages_cluster" ON "analytics_topic_cluster_pages" ("cluster_id");

-- ===== Index Coverage =====

CREATE TABLE IF NOT EXISTS "page_index_status" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "site_id" text NOT NULL REFERENCES "site_connections"("id") ON DELETE CASCADE,
    "page_url" text NOT NULL,
    "coverage_state" text,
    "indexing_state" text,
    "last_crawl_time" timestamptz,
    "crawled_as" text,
    "robots_txt_state" text,
    "canonical_url" text,
    "is_canonical" boolean,
    "mobile_usability" text,
    "rich_results" jsonb,
    "user_declared_canonical" text,
    "google_selected_canonical" text,
    "page_fetch_state" text,
    "referring_urls" jsonb,
    "inspection_time" timestamptz NOT NULL,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uq_page_index_status" ON "page_index_status" ("site_id", "page_url");
CREATE INDEX IF NOT EXISTS "idx_page_index_coverage_state" ON "page_index_status" ("site_id", "coverage_state");
CREATE INDEX IF NOT EXISTS "idx_page_index_indexing_state" ON "page_index_status" ("site_id", "indexing_state");
CREATE INDEX IF NOT EXISTS "idx_page_index_crawl_time" ON "page_index_status" ("site_id", "last_crawl_time");

-- ===== Indexing Requests =====

CREATE TABLE IF NOT EXISTS "indexing_requests" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "site_id" text NOT NULL REFERENCES "site_connections"("id") ON DELETE CASCADE,
    "page_url" text NOT NULL,
    "request_type" text NOT NULL,
    "status" text NOT NULL DEFAULT 'pending',
    "priority" integer DEFAULT 0,
    "priority_reason" text,
    "submitted_at" timestamptz,
    "response" jsonb,
    "error_message" text,
    "retry_count" integer DEFAULT 0,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_indexing_requests_site_status" ON "indexing_requests" ("site_id", "status");
CREATE INDEX IF NOT EXISTS "idx_indexing_requests_priority" ON "indexing_requests" ("priority");
CREATE INDEX IF NOT EXISTS "idx_indexing_requests_submitted" ON "indexing_requests" ("submitted_at");
