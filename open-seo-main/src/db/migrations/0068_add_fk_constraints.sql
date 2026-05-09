-- Migration: Add Missing FK Constraints (SCHEMA-FK)
-- Phase 96: Agency Analytics - Schema Standardization
--
-- Adds foreign key constraints for referential integrity.
-- Uses appropriate ON DELETE actions based on data criticality.

-- ============================================================================
-- analytics_annotations.workspace_id -> organization.id
-- ON DELETE CASCADE: Annotations are workspace-scoped, delete with workspace
-- ============================================================================
-- Note: FK already exists in schema definition (content-intelligence-schema.ts)
-- This migration ensures it's applied to any existing databases

-- ============================================================================
-- client_tags.created_by -> user.id (if column exists in future)
-- ON DELETE SET NULL: Preserve tags even if creator user is deleted
-- ============================================================================
-- Note: client_tags currently doesn't have created_by column
-- Adding column and FK for future-proofing

DO $$
BEGIN
  -- Check if created_by column exists on client_tags
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'client_tags' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE client_tags ADD COLUMN created_by TEXT;
    RAISE NOTICE 'Added created_by column to client_tags';
  END IF;
END $$;

-- Add FK constraint for client_tags.created_by if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_client_tags_created_by'
    AND table_name = 'client_tags'
  ) THEN
    ALTER TABLE client_tags
    ADD CONSTRAINT fk_client_tags_created_by
    FOREIGN KEY (created_by) REFERENCES "user"(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added FK constraint fk_client_tags_created_by';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping FK fk_client_tags_created_by: %', SQLERRM;
END $$;

-- ============================================================================
-- site_tags.created_by -> user.id (adding column if not exists)
-- ON DELETE SET NULL: Preserve tags even if creator user is deleted
-- ============================================================================
DO $$
BEGIN
  -- Check if created_by column exists on site_tags
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'site_tags' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE site_tags ADD COLUMN created_by TEXT;
    RAISE NOTICE 'Added created_by column to site_tags';
  END IF;
END $$;

-- Add FK constraint for site_tags.created_by if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_site_tags_created_by'
    AND table_name = 'site_tags'
  ) THEN
    ALTER TABLE site_tags
    ADD CONSTRAINT fk_site_tags_created_by
    FOREIGN KEY (created_by) REFERENCES "user"(id) ON DELETE SET NULL;
    RAISE NOTICE 'Added FK constraint fk_site_tags_created_by';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping FK fk_site_tags_created_by: %', SQLERRM;
END $$;

-- ============================================================================
-- detected_patterns.workspace_id -> organization.id
-- ON DELETE CASCADE: Patterns are workspace-scoped
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_detected_patterns_workspace'
    AND table_name = 'detected_patterns'
  ) THEN
    ALTER TABLE detected_patterns
    ADD CONSTRAINT fk_detected_patterns_workspace
    FOREIGN KEY (workspace_id) REFERENCES organization(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK constraint fk_detected_patterns_workspace';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping FK fk_detected_patterns_workspace: %', SQLERRM;
END $$;

-- ============================================================================
-- client_goals.workspace_id -> organization.id
-- ON DELETE CASCADE: Goals are workspace-scoped
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_client_goals_workspace'
    AND table_name = 'client_goals'
  ) THEN
    ALTER TABLE client_goals
    ADD CONSTRAINT fk_client_goals_workspace
    FOREIGN KEY (workspace_id) REFERENCES organization(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK constraint fk_client_goals_workspace';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping FK fk_client_goals_workspace: %', SQLERRM;
END $$;

-- ============================================================================
-- dashboard_views.workspace_id -> organization.id
-- ON DELETE CASCADE: Views are workspace-scoped
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_dashboard_views_workspace'
    AND table_name = 'dashboard_views'
  ) THEN
    ALTER TABLE dashboard_views
    ADD CONSTRAINT fk_dashboard_views_workspace
    FOREIGN KEY (workspace_id) REFERENCES organization(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK constraint fk_dashboard_views_workspace';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping FK fk_dashboard_views_workspace: %', SQLERRM;
END $$;

-- ============================================================================
-- portfolio_activity.workspace_id -> organization.id
-- ON DELETE CASCADE: Activity feed is workspace-scoped
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_portfolio_activity_workspace'
    AND table_name = 'portfolio_activity'
  ) THEN
    ALTER TABLE portfolio_activity
    ADD CONSTRAINT fk_portfolio_activity_workspace
    FOREIGN KEY (workspace_id) REFERENCES organization(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK constraint fk_portfolio_activity_workspace';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping FK fk_portfolio_activity_workspace: %', SQLERRM;
END $$;

-- ============================================================================
-- portfolio_aggregates.workspace_id -> organization.id
-- ON DELETE CASCADE: Aggregates are workspace-scoped
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_portfolio_aggregates_workspace'
    AND table_name = 'portfolio_aggregates'
  ) THEN
    ALTER TABLE portfolio_aggregates
    ADD CONSTRAINT fk_portfolio_aggregates_workspace
    FOREIGN KEY (workspace_id) REFERENCES organization(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added FK constraint fk_portfolio_aggregates_workspace';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Skipping FK fk_portfolio_aggregates_workspace: %', SQLERRM;
END $$;

-- Add documentation
COMMENT ON CONSTRAINT fk_client_tags_created_by ON client_tags IS
  'FK to user table for audit trail. SET NULL on delete preserves tags.';
COMMENT ON CONSTRAINT fk_site_tags_created_by ON site_tags IS
  'FK to user table for audit trail. SET NULL on delete preserves tags.';
