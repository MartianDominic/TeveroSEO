-- Migration: 0007_analytics_schema_updates.sql
-- Phase 96: Analytics Schema Updates
--
-- This migration adds:
-- 1. analytics_annotations table with category, color, soft_deleted_at
-- 2. google_algorithm_updates table
-- 3. soft_deleted_at columns to existing analytics tables
--
-- All changes use IF NOT EXISTS guards for idempotent execution.

-- ============================================
-- 1. Analytics Annotations Table
-- ============================================
-- Timeline annotations for analytics charts (algorithm updates, site changes, campaigns)

CREATE TABLE IF NOT EXISTS "analytics_annotations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "site_id" text REFERENCES "site_connections"("id") ON DELETE CASCADE,
    "workspace_id" text NOT NULL,
    "annotation_date" text NOT NULL,
    "annotation_type" text NOT NULL,
    "title" text NOT NULL,
    "description" text,
    "category" text,
    "color" text,
    "impact" text,
    "auto_generated" boolean DEFAULT false,
    "source_url" text,
    "created_by" text,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now(),
    "soft_deleted_at" timestamptz
);

-- Unique constraint: one annotation per workspace/date/title combo
CREATE UNIQUE INDEX IF NOT EXISTS "uq_annotations_workspace_date_title"
    ON "analytics_annotations" ("workspace_id", "annotation_date", "title");

-- Indexes for query patterns
CREATE INDEX IF NOT EXISTS "idx_annotations_workspace" ON "analytics_annotations" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_annotations_site" ON "analytics_annotations" ("site_id");
CREATE INDEX IF NOT EXISTS "idx_annotations_date" ON "analytics_annotations" ("annotation_date");
CREATE INDEX IF NOT EXISTS "idx_annotations_type" ON "analytics_annotations" ("annotation_type");
CREATE INDEX IF NOT EXISTS "idx_annotations_soft_deleted" ON "analytics_annotations" ("soft_deleted_at")
    WHERE "soft_deleted_at" IS NULL;

-- ============================================
-- 2. Google Algorithm Updates Table
-- ============================================
-- Auto-imported from DemandSphere API for correlation with traffic changes

CREATE TABLE IF NOT EXISTS "google_algorithm_updates" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" text NOT NULL,
    "update_type" text NOT NULL,
    "started_at" timestamptz NOT NULL,
    "ended_at" timestamptz,
    "severity" text NOT NULL,
    "official_announcement_url" text,
    "notes" text,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now()
);

-- Indexes for algorithm update queries
CREATE INDEX IF NOT EXISTS "idx_algorithm_updates_started_at" ON "google_algorithm_updates" ("started_at");
CREATE INDEX IF NOT EXISTS "idx_algorithm_updates_type" ON "google_algorithm_updates" ("update_type");
CREATE INDEX IF NOT EXISTS "idx_algorithm_updates_severity" ON "google_algorithm_updates" ("severity");

-- ============================================
-- 3. Soft Delete Columns for Analytics Tables
-- ============================================
-- Add soft_deleted_at to tables that need soft delete support

-- 3a. content_groups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'content_groups' AND column_name = 'soft_deleted_at'
    ) THEN
        ALTER TABLE "content_groups" ADD COLUMN "soft_deleted_at" timestamptz;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_content_groups_soft_deleted" ON "content_groups" ("soft_deleted_at")
    WHERE "soft_deleted_at" IS NULL;

-- 3b. analytics_topic_clusters
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'analytics_topic_clusters' AND column_name = 'soft_deleted_at'
    ) THEN
        ALTER TABLE "analytics_topic_clusters" ADD COLUMN "soft_deleted_at" timestamptz;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_analytics_topic_clusters_soft_deleted" ON "analytics_topic_clusters" ("soft_deleted_at")
    WHERE "soft_deleted_at" IS NULL;

-- 3c. page_index_status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'page_index_status' AND column_name = 'soft_deleted_at'
    ) THEN
        ALTER TABLE "page_index_status" ADD COLUMN "soft_deleted_at" timestamptz;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_page_index_soft_deleted" ON "page_index_status" ("soft_deleted_at")
    WHERE "soft_deleted_at" IS NULL;

-- 3d. indexing_requests
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'indexing_requests' AND column_name = 'soft_deleted_at'
    ) THEN
        ALTER TABLE "indexing_requests" ADD COLUMN "soft_deleted_at" timestamptz;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_indexing_requests_soft_deleted" ON "indexing_requests" ("soft_deleted_at")
    WHERE "soft_deleted_at" IS NULL;

-- 3e. site_tags
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'site_tags' AND column_name = 'soft_deleted_at'
    ) THEN
        ALTER TABLE "site_tags" ADD COLUMN "soft_deleted_at" timestamptz;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_site_tags_soft_deleted" ON "site_tags" ("soft_deleted_at")
    WHERE "soft_deleted_at" IS NULL;

-- 3f. client_tags
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'client_tags' AND column_name = 'soft_deleted_at'
    ) THEN
        ALTER TABLE "client_tags" ADD COLUMN "soft_deleted_at" timestamptz;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_client_tags_soft_deleted" ON "client_tags" ("soft_deleted_at")
    WHERE "soft_deleted_at" IS NULL;

-- ============================================
-- 4. Optional: TimescaleDB Hypertable for GSC Snapshots
-- ============================================
-- Only executes if TimescaleDB extension is available and table exists
-- This converts existing snapshot tables to hypertables for time-series optimization

DO $$
BEGIN
    -- Check if TimescaleDB is available
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN

        -- Convert seo_gsc_snapshots to hypertable if not already
        -- Note: Requires 'date' column to be timestamptz for hypertable
        -- Skipping for now as it uses DATE type, not TIMESTAMPTZ
        -- Would need schema migration to change date type first

        RAISE NOTICE 'TimescaleDB detected. seo_gsc_snapshots uses DATE type - convert to TIMESTAMPTZ in a future migration to enable hypertable.';

    ELSE
        RAISE NOTICE 'TimescaleDB not available - skipping hypertable conversions';
    END IF;
END $$;

-- ============================================
-- 5. Update Triggers for updated_at
-- ============================================
-- Create trigger function if not exists

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to new tables

DO $$
BEGIN
    -- analytics_annotations trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_analytics_annotations'
    ) THEN
        CREATE TRIGGER set_updated_at_analytics_annotations
            BEFORE UPDATE ON "analytics_annotations"
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;

    -- google_algorithm_updates trigger
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'set_updated_at_google_algorithm_updates'
    ) THEN
        CREATE TRIGGER set_updated_at_google_algorithm_updates
            BEFORE UPDATE ON "google_algorithm_updates"
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
