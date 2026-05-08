-- Migration: Add FK constraint on annotations.workspace_id
-- Phase 96: Database schema consistency fix (DB-02)
--
-- This migration adds a foreign key constraint from analytics_annotations.workspace_id
-- to organization.id with CASCADE delete behavior.
--
-- Safety: First clean any orphan annotations that reference non-existent workspaces,
-- then add the FK constraint.

-- Step 1: Clean up orphan annotations (workspace_id references that don't exist in organization)
DELETE FROM analytics_annotations
WHERE workspace_id NOT IN (SELECT id FROM organization);

-- Step 2: Add the FK constraint with CASCADE delete
-- When a workspace (organization) is deleted, all its annotations are deleted too
ALTER TABLE analytics_annotations
  ADD CONSTRAINT fk_annotations_workspace
  FOREIGN KEY (workspace_id)
  REFERENCES organization(id)
  ON DELETE CASCADE;

-- Step 3: Add a partial index for active annotations queries (optimization)
-- This helps queries that filter WHERE soft_deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_annotations_workspace_active
  ON analytics_annotations (workspace_id)
  WHERE soft_deleted_at IS NULL;
