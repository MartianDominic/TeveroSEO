-- Migration: 0072_schema_integrity_medium.sql
-- Date: 2026-05-04
-- Phase: FIX-19 Database Schema & Migration Fixes
-- Purpose: Fix medium-priority schema issues
--
-- This migration addresses:
--   M-SCHEMA-02: SET NULL cascade orphans related records
--   M-SCHEMA-03: Missing composite index for common query
--   M-SCHEMA-04: Inconsistent soft delete patterns
--
-- Note: M-SCHEMA-01 (naming inconsistency) is a code-level documentation item,
--       not a runtime fix. See comments below.

BEGIN;

-- ============================================================================
-- M-SCHEMA-01: Table naming inconsistency (DOCUMENTATION ONLY)
-- ============================================================================
-- The codebase uses snake_case consistently at the database level.
-- Some schema definitions use camelCase in TypeScript (e.g., siteConnections)
-- but map to snake_case table names (site_connections).
--
-- This is INTENTIONAL and follows Drizzle ORM conventions:
-- - TypeScript: camelCase for variables (siteConnections)
-- - Database: snake_case for tables (site_connections)
--
-- No migration needed - naming is consistent where it matters (DB level).


-- ============================================================================
-- M-SCHEMA-02: Review SET NULL cascades
-- ============================================================================
-- SET NULL is intentionally used in several places for audit trail preservation:
--
-- 1. audits.clientId -> clients.id: SET NULL
--    Rationale: Preserve audit history when client is deleted
--    This is CORRECT - audits should be kept even if client is removed
--
-- 2. monitored_changes.clientId -> clients.id: SET NULL
--    Rationale: Preserve change history for reporting
--    This is CORRECT - change history is valuable even without client
--
-- 3. report_schedules.clientId -> clients.id: SET NULL
--    Rationale: Preserve schedule configuration
--    This is CORRECT - allows restoring schedule when client is re-created
--
-- 4. voice_profiles.clientId -> clients.id: SET NULL
--    Rationale: Allow reuse of voice profiles
--    REVIEW: Consider RESTRICT to prevent orphan profiles
--
-- 5. link_suggestions.clientId -> clients.id: SET NULL
--    Rationale: Preserve link opportunity data
--    This is CORRECT - link suggestions may be valuable for analysis
--
-- After review: Most SET NULL usages are intentional for audit/history.
-- No changes needed - document the pattern instead.

COMMENT ON TABLE audits IS
  'Site audit records. Uses SET NULL cascade on clientId to preserve audit history '
  'when clients are deleted. This is intentional - audits are valuable audit trail.';

COMMENT ON TABLE monitored_changes IS
  'Change detection records. Uses SET NULL cascade on clientId to preserve '
  'change history for reporting and analysis.';


-- ============================================================================
-- M-SCHEMA-03: Add missing composite indexes for common queries
-- ============================================================================

-- Index for client-scoped audits by date (common dashboard query)
CREATE INDEX IF NOT EXISTS idx_audits_client_started_at
ON audits (client_id, started_at DESC);

-- Index for client-scoped prospects by status (pipeline queries)
CREATE INDEX IF NOT EXISTS idx_prospects_client_status
ON prospects (client_id, status);

-- Index for organization-scoped projects by name (lookup queries)
CREATE INDEX IF NOT EXISTS idx_projects_org_created
ON projects (organization_id, created_at DESC);

-- Index for keyword rankings by date (trend queries)
CREATE INDEX IF NOT EXISTS idx_keyword_rankings_keyword_date
ON keyword_rankings (keyword_id, recorded_at DESC);

-- Index for proposals by client and status (CRM queries)
CREATE INDEX IF NOT EXISTS idx_proposals_client_status
ON proposals (client_id, status);

-- Index for invoices by client and status (billing queries)
CREATE INDEX IF NOT EXISTS idx_invoices_client_status
ON invoices (client_id, status);

-- Index for content briefs by client and status (content workflow)
CREATE INDEX IF NOT EXISTS idx_content_briefs_client_status
ON content_briefs (client_id, status);

-- Index for tasks by client and due date (task management)
CREATE INDEX IF NOT EXISTS idx_tasks_client_due_date
ON tasks (client_id, due_date);


-- ============================================================================
-- M-SCHEMA-04: Standardize soft delete patterns
-- ============================================================================
-- Current pattern analysis:
--
-- Pattern A (is_deleted + deleted_at):
--   - projects: is_deleted, deleted_at
--   - audits: is_archived, archived_at (uses "archived" terminology)
--   - organization: is_archived, archived_at
--   - clients: is_archived, archived_at
--
-- Pattern B (deleted_at only):
--   - None found
--
-- DECISION: Standardize on "is_archived + archived_at" pattern
-- Rationale:
--   1. "Archived" is more user-friendly than "deleted"
--   2. Allows restoration (soft delete) vs permanent delete
--   3. Consistent with existing tables (organization, clients, audits)
--
-- The projects table uses is_deleted/deleted_at - we'll add is_archived/archived_at
-- for consistency but keep is_deleted for backward compatibility

-- Add archived columns to projects (if not exists)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE projects
    ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;

    ALTER TABLE projects
    ADD COLUMN archived_at TIMESTAMPTZ;

    -- Migrate existing soft-deleted records
    UPDATE projects
    SET is_archived = is_deleted,
        archived_at = deleted_at
    WHERE is_deleted = true;

    RAISE NOTICE 'Added is_archived and archived_at columns to projects table';
  ELSE
    RAISE NOTICE 'projects.is_archived already exists, skipping';
  END IF;
END $$;

-- Add index for archived filtering
CREATE INDEX IF NOT EXISTS idx_projects_is_archived
ON projects (is_archived);


-- ============================================================================
-- Document the soft delete pattern
-- ============================================================================

COMMENT ON COLUMN projects.is_archived IS
  'Soft delete flag. When true, the project is archived (not deleted). '
  'Use archived_at for timestamp. is_deleted is deprecated - use is_archived.';

COMMENT ON COLUMN projects.archived_at IS
  'Timestamp when the project was archived. NULL if active.';


COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (run manually if needed)
-- ============================================================================
-- BEGIN;
-- DROP INDEX IF EXISTS idx_audits_client_started_at;
-- DROP INDEX IF EXISTS idx_prospects_client_status;
-- DROP INDEX IF EXISTS idx_projects_org_created;
-- DROP INDEX IF EXISTS idx_keyword_rankings_keyword_date;
-- DROP INDEX IF EXISTS idx_proposals_client_status;
-- DROP INDEX IF EXISTS idx_invoices_client_status;
-- DROP INDEX IF EXISTS idx_content_briefs_client_status;
-- DROP INDEX IF EXISTS idx_tasks_client_due_date;
-- DROP INDEX IF EXISTS idx_projects_is_archived;
-- ALTER TABLE projects DROP COLUMN IF EXISTS is_archived;
-- ALTER TABLE projects DROP COLUMN IF EXISTS archived_at;
-- COMMIT;
