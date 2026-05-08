-- Migration 0081: Standardize soft delete pattern (DBS-005/006/007)
--
-- Standardizes all analytics tables to use: soft_deleted_at TIMESTAMPTZ DEFAULT NULL
--
-- Phase 1: Add soft_deleted_at columns where missing (backwards compatible)
-- Phase 2: Migrate data from is_deleted/deleted_at to soft_deleted_at
-- Phase 3: Add indexes on soft_deleted_at
-- Phase 4: Drop deprecated columns (separate migration 0082)
--
-- Tables affected:
-- - seo_gsc_snapshots (has is_deleted, deleted_at)
-- - seo_ga4_snapshots (has is_deleted, deleted_at)
-- - clients (has is_deleted, deleted_at)
-- - projects (has is_deleted, deleted_at)
-- - reports (has is_deleted, deleted_at)
-- - content_briefs (has is_deleted, deleted_at)
-- - site_changes (has is_deleted, deleted_at)
-- - proposals (has is_deleted, deleted_at)

BEGIN;

-- ============================================================================
-- PHASE 1: Add soft_deleted_at columns where missing
-- ============================================================================

-- seo_gsc_snapshots: Add soft_deleted_at
ALTER TABLE seo_gsc_snapshots
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ;

-- seo_ga4_snapshots: Add soft_deleted_at
ALTER TABLE seo_ga4_snapshots
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ;

-- clients: Add soft_deleted_at
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ;

-- projects: Add soft_deleted_at
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ;

-- reports: Add soft_deleted_at
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ;

-- content_briefs: Add soft_deleted_at
ALTER TABLE content_briefs
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ;

-- site_changes: Add soft_deleted_at
ALTER TABLE site_changes
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ;

-- proposals: Add soft_deleted_at
ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS soft_deleted_at TIMESTAMPTZ;

-- ============================================================================
-- PHASE 2: Migrate data from is_deleted/deleted_at to soft_deleted_at
-- Logic: If is_deleted = true, set soft_deleted_at = COALESCE(deleted_at, NOW())
-- ============================================================================

-- seo_gsc_snapshots
UPDATE seo_gsc_snapshots
SET soft_deleted_at = COALESCE(deleted_at, NOW())
WHERE is_deleted = true AND soft_deleted_at IS NULL;

-- seo_ga4_snapshots
UPDATE seo_ga4_snapshots
SET soft_deleted_at = COALESCE(deleted_at, NOW())
WHERE is_deleted = true AND soft_deleted_at IS NULL;

-- clients
UPDATE clients
SET soft_deleted_at = COALESCE(deleted_at, NOW())
WHERE is_deleted = true AND soft_deleted_at IS NULL;

-- projects
UPDATE projects
SET soft_deleted_at = COALESCE(deleted_at, NOW())
WHERE is_deleted = true AND soft_deleted_at IS NULL;

-- reports
UPDATE reports
SET soft_deleted_at = COALESCE(deleted_at, NOW())
WHERE is_deleted = true AND soft_deleted_at IS NULL;

-- content_briefs
UPDATE content_briefs
SET soft_deleted_at = COALESCE(deleted_at, NOW())
WHERE is_deleted = true AND soft_deleted_at IS NULL;

-- site_changes
UPDATE site_changes
SET soft_deleted_at = COALESCE(deleted_at, NOW())
WHERE is_deleted = true AND soft_deleted_at IS NULL;

-- proposals
UPDATE proposals
SET soft_deleted_at = COALESCE(deleted_at, NOW())
WHERE is_deleted = true AND soft_deleted_at IS NULL;

-- ============================================================================
-- PHASE 3: Add indexes on soft_deleted_at for efficient filtering
-- Using partial index on active records (soft_deleted_at IS NULL) for optimal performance
-- ============================================================================

-- seo_gsc_snapshots: Index for soft delete filtering
CREATE INDEX IF NOT EXISTS ix_seo_gsc_snapshots_soft_deleted
  ON seo_gsc_snapshots (soft_deleted_at);
CREATE INDEX IF NOT EXISTS ix_seo_gsc_snapshots_active
  ON seo_gsc_snapshots (client_id, date)
  WHERE soft_deleted_at IS NULL;

-- seo_ga4_snapshots: Index for soft delete filtering
CREATE INDEX IF NOT EXISTS ix_seo_ga4_snapshots_soft_deleted
  ON seo_ga4_snapshots (soft_deleted_at);
CREATE INDEX IF NOT EXISTS ix_seo_ga4_snapshots_active
  ON seo_ga4_snapshots (client_id, date)
  WHERE soft_deleted_at IS NULL;

-- clients: Index for soft delete filtering
CREATE INDEX IF NOT EXISTS ix_clients_soft_deleted
  ON clients (soft_deleted_at);
CREATE INDEX IF NOT EXISTS ix_clients_workspace_active
  ON clients (workspace_id)
  WHERE soft_deleted_at IS NULL;

-- projects: Index for soft delete filtering
CREATE INDEX IF NOT EXISTS ix_projects_soft_deleted
  ON projects (soft_deleted_at);
CREATE INDEX IF NOT EXISTS ix_projects_client_active
  ON projects (client_id)
  WHERE soft_deleted_at IS NULL;

-- reports: Index for soft delete filtering
CREATE INDEX IF NOT EXISTS ix_reports_soft_deleted
  ON reports (soft_deleted_at);
CREATE INDEX IF NOT EXISTS ix_reports_client_active
  ON reports (client_id)
  WHERE soft_deleted_at IS NULL;

-- content_briefs: Index for soft delete filtering
CREATE INDEX IF NOT EXISTS ix_content_briefs_soft_deleted
  ON content_briefs (soft_deleted_at);
CREATE INDEX IF NOT EXISTS ix_content_briefs_client_active
  ON content_briefs (client_id)
  WHERE soft_deleted_at IS NULL;

-- site_changes: Index for soft delete filtering
CREATE INDEX IF NOT EXISTS ix_site_changes_soft_deleted
  ON site_changes (soft_deleted_at);
CREATE INDEX IF NOT EXISTS ix_site_changes_site_active
  ON site_changes (site_id)
  WHERE soft_deleted_at IS NULL;

-- proposals: Index for soft delete filtering
CREATE INDEX IF NOT EXISTS ix_proposals_soft_deleted
  ON proposals (soft_deleted_at);
CREATE INDEX IF NOT EXISTS ix_proposals_workspace_active
  ON proposals (workspace_id)
  WHERE soft_deleted_at IS NULL;

-- ============================================================================
-- VERIFICATION: Log migration results
-- ============================================================================
DO $$
DECLARE
  migrated_gsc INTEGER;
  migrated_ga4 INTEGER;
  migrated_clients INTEGER;
  migrated_projects INTEGER;
  migrated_reports INTEGER;
  migrated_briefs INTEGER;
  migrated_changes INTEGER;
  migrated_proposals INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrated_gsc FROM seo_gsc_snapshots WHERE soft_deleted_at IS NOT NULL;
  SELECT COUNT(*) INTO migrated_ga4 FROM seo_ga4_snapshots WHERE soft_deleted_at IS NOT NULL;
  SELECT COUNT(*) INTO migrated_clients FROM clients WHERE soft_deleted_at IS NOT NULL;
  SELECT COUNT(*) INTO migrated_projects FROM projects WHERE soft_deleted_at IS NOT NULL;
  SELECT COUNT(*) INTO migrated_reports FROM reports WHERE soft_deleted_at IS NOT NULL;
  SELECT COUNT(*) INTO migrated_briefs FROM content_briefs WHERE soft_deleted_at IS NOT NULL;
  SELECT COUNT(*) INTO migrated_changes FROM site_changes WHERE soft_deleted_at IS NOT NULL;
  SELECT COUNT(*) INTO migrated_proposals FROM proposals WHERE soft_deleted_at IS NOT NULL;

  RAISE NOTICE 'Migration 0081 complete:';
  RAISE NOTICE '  seo_gsc_snapshots soft deleted: %', migrated_gsc;
  RAISE NOTICE '  seo_ga4_snapshots soft deleted: %', migrated_ga4;
  RAISE NOTICE '  clients soft deleted: %', migrated_clients;
  RAISE NOTICE '  projects soft deleted: %', migrated_projects;
  RAISE NOTICE '  reports soft deleted: %', migrated_reports;
  RAISE NOTICE '  content_briefs soft deleted: %', migrated_briefs;
  RAISE NOTICE '  site_changes soft deleted: %', migrated_changes;
  RAISE NOTICE '  proposals soft deleted: %', migrated_proposals;
END $$;

COMMIT;
