-- Migration: Add missing indexes on site_tags and client_tags
-- Phase 96: Database schema consistency fix (DBS-002, DBS-003)
--
-- These indexes improve query performance for tag-based filtering:
-- - idx_site_tags_site_id: Fast lookup of tags by site
-- - idx_client_tags_client_id: Fast lookup of tags by client
--
-- Using CONCURRENTLY to avoid table locks during index creation.
-- Note: CONCURRENTLY cannot be run inside a transaction, so this migration
-- should be run with drizzle-kit's non-transactional mode or manually.

-- Step 1: Add index on site_tags.site_id for efficient site-based tag queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_site_tags_site_id
  ON site_tags (site_id);

-- Step 2: Add index on client_tags.client_id for efficient client-based tag queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_tags_client_id
  ON client_tags (client_id);

-- Rollback instructions (manual):
-- DROP INDEX idx_site_tags_site_id;
-- DROP INDEX idx_client_tags_client_id;
