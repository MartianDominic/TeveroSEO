-- Migration: 0038_soft_delete_content.sql
-- Description: Add soft delete columns to projects and audits tables
-- Purpose: Prevent accidental data loss by enabling soft delete instead of hard delete
--
-- Tables affected:
--   - projects: Add is_deleted, deleted_at columns
--   - audits: Add is_archived, archived_at columns
--
-- Rollback: See bottom of file

-- ============================================================================
-- PROJECTS: Soft delete columns
-- ============================================================================

-- Add soft delete flag (default false so existing records are not affected)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Add timestamp for when the record was soft-deleted
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for efficient filtering of non-deleted projects
CREATE INDEX IF NOT EXISTS projects_is_deleted_idx ON projects (is_deleted);

-- Composite index for common query pattern: list active projects per org
CREATE INDEX IF NOT EXISTS projects_org_active_idx ON projects (organization_id, is_deleted)
  WHERE is_deleted = FALSE;

-- ============================================================================
-- AUDITS: Archive columns (soft delete variant)
-- ============================================================================

-- Add archive flag (default false so existing records are not affected)
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- Add timestamp for when the audit was archived
ALTER TABLE audits
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Index for efficient filtering of non-archived audits
CREATE INDEX IF NOT EXISTS audits_is_archived_idx ON audits (is_archived);

-- Composite index for common query pattern: list active audits per project
CREATE INDEX IF NOT EXISTS audits_project_active_idx ON audits (project_id, is_archived)
  WHERE is_archived = FALSE;

-- ============================================================================
-- ROLLBACK (if needed, run manually)
-- ============================================================================
-- DROP INDEX IF EXISTS audits_project_active_idx;
-- DROP INDEX IF EXISTS audits_is_archived_idx;
-- ALTER TABLE audits DROP COLUMN IF EXISTS archived_at;
-- ALTER TABLE audits DROP COLUMN IF EXISTS is_archived;
-- DROP INDEX IF EXISTS projects_org_active_idx;
-- DROP INDEX IF EXISTS projects_is_deleted_idx;
-- ALTER TABLE projects DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE projects DROP COLUMN IF EXISTS is_deleted;
