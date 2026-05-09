-- Migration: Add tenant isolation to HTML cache tables
-- Phase 97: Multi-tenant cache security
-- Severity: HIGH - Prevents cross-tenant cache pollution

-- =============================================================================
-- 1. Add clientId column to html_cache table
-- =============================================================================

-- Add the column as nullable first (for existing data)
ALTER TABLE html_cache
ADD COLUMN IF NOT EXISTS client_id UUID;

-- Add foreign key constraint
ALTER TABLE html_cache
ADD CONSTRAINT fk_html_cache_client_id
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- =============================================================================
-- 2. Add clientId column to html_cache_aliases table
-- =============================================================================

ALTER TABLE html_cache_aliases
ADD COLUMN IF NOT EXISTS client_id UUID;

ALTER TABLE html_cache_aliases
ADD CONSTRAINT fk_html_cache_aliases_client_id
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- =============================================================================
-- 3. Add clientId column to cache_stats table (optional for aggregate stats)
-- =============================================================================

ALTER TABLE cache_stats
ADD COLUMN IF NOT EXISTS client_id UUID;

ALTER TABLE cache_stats
ADD CONSTRAINT fk_cache_stats_client_id
FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- =============================================================================
-- 4. Create indexes for tenant-scoped queries
-- =============================================================================

-- Composite index for tenant-scoped lookups (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_html_cache_client_url_hash
ON html_cache (client_id, url_hash);

-- Index for client-scoped cache cleanup/maintenance
CREATE INDEX IF NOT EXISTS idx_html_cache_client_id
ON html_cache (client_id);

-- Index for client-scoped alias lookups
CREATE INDEX IF NOT EXISTS idx_html_cache_aliases_client
ON html_cache_aliases (client_id);

-- =============================================================================
-- 5. Clean up orphaned cache entries (entries without valid client)
-- =============================================================================

-- Delete any existing cache entries that don't have a client
-- This should be empty for new deployments, but handles edge cases
DELETE FROM html_cache_aliases WHERE client_id IS NULL;
DELETE FROM html_cache WHERE client_id IS NULL;

-- =============================================================================
-- 6. Make clientId NOT NULL after cleanup
-- =============================================================================

ALTER TABLE html_cache
ALTER COLUMN client_id SET NOT NULL;

ALTER TABLE html_cache_aliases
ALTER COLUMN client_id SET NOT NULL;

-- =============================================================================
-- 7. Add comment for documentation
-- =============================================================================

COMMENT ON COLUMN html_cache.client_id IS 'Tenant isolation - required for all cache entries to prevent cross-tenant cache pollution';
COMMENT ON COLUMN html_cache_aliases.client_id IS 'Tenant isolation - must match canonical entry client_id';
COMMENT ON COLUMN cache_stats.client_id IS 'Optional tenant scope - NULL for aggregate stats, set for client-specific metrics';
