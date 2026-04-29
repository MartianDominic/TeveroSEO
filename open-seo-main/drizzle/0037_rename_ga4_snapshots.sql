-- Migration: Rename ga4_snapshots to seo_ga4_snapshots
-- Issue: CRIT-05 - Duplicate table name between services
--
-- AI-Writer uses ga4_snapshots for its GA4 data.
-- open-seo-main should use seo_ga4_snapshots to avoid conflicts.
-- This matches the pattern already used for seo_gsc_snapshots.

-- Rename the table
ALTER TABLE IF EXISTS "ga4_snapshots" RENAME TO "seo_ga4_snapshots";

-- Rename constraints to match new table name
ALTER INDEX IF EXISTS "uq_ga4_snapshots_client_date" RENAME TO "uq_seo_ga4_snapshots_client_date";
ALTER INDEX IF EXISTS "ix_ga4_snapshots_client_date" RENAME TO "ix_seo_ga4_snapshots_client_date";

-- Create a view for backwards compatibility (optional - can be removed after code migration)
CREATE OR REPLACE VIEW "ga4_snapshots" AS SELECT * FROM "seo_ga4_snapshots";

-- Add comment for documentation
COMMENT ON TABLE "seo_ga4_snapshots" IS 'SEO GA4 daily aggregate snapshots. Renamed from ga4_snapshots to avoid conflict with AI-Writer table.';
