-- Migration: Standardize Soft Delete Pattern (SCHEMA-SOFTDELETE)
-- Phase 96: Agency Analytics - Schema Standardization
--
-- Standardizes all soft delete columns to use: soft_deleted_at TIMESTAMPTZ
-- Pattern 1 (target): soft_deleted_at TIMESTAMPTZ DEFAULT NULL
-- Pattern 2 (legacy): is_deleted BOOLEAN + deleted_at TIMESTAMPTZ
-- Pattern 3 (legacy): deleted_at TIMESTAMPTZ only
--
-- This migration:
-- 1. Adds soft_deleted_at column to tables missing it
-- 2. Copies existing deleted_at values to soft_deleted_at
-- 3. Does NOT remove legacy columns (backward compatibility)
-- 4. Future migration will remove is_deleted/deleted_at after code update
--
-- IMPORTANT: This is a non-breaking migration. Legacy columns remain for
-- backward compatibility with existing queries.

-- ============================================================================
-- Helper function to add soft_deleted_at if missing and sync from deleted_at
-- ============================================================================
CREATE OR REPLACE FUNCTION _add_soft_deleted_at_if_missing(
  p_table_name TEXT
) RETURNS void AS $$
DECLARE
  v_has_soft_deleted_at BOOLEAN;
  v_has_deleted_at BOOLEAN;
  v_has_is_deleted BOOLEAN;
BEGIN
  -- Check column existence
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = p_table_name AND column_name = 'soft_deleted_at'
  ) INTO v_has_soft_deleted_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = p_table_name AND column_name = 'deleted_at'
  ) INTO v_has_deleted_at;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = p_table_name AND column_name = 'is_deleted'
  ) INTO v_has_is_deleted;

  -- Add soft_deleted_at if missing
  IF NOT v_has_soft_deleted_at THEN
    EXECUTE format('ALTER TABLE %I ADD COLUMN soft_deleted_at TIMESTAMPTZ', p_table_name);
    RAISE NOTICE 'Added soft_deleted_at to %', p_table_name;

    -- Copy deleted_at values if column exists
    IF v_has_deleted_at THEN
      EXECUTE format('UPDATE %I SET soft_deleted_at = deleted_at WHERE deleted_at IS NOT NULL', p_table_name);
      RAISE NOTICE 'Synced deleted_at -> soft_deleted_at for %', p_table_name;
    -- If only is_deleted exists, set soft_deleted_at to now() for deleted records
    ELSIF v_has_is_deleted THEN
      EXECUTE format('UPDATE %I SET soft_deleted_at = NOW() WHERE is_deleted = true AND soft_deleted_at IS NULL', p_table_name);
      RAISE NOTICE 'Synced is_deleted -> soft_deleted_at for %', p_table_name;
    END IF;

    -- Add index on soft_deleted_at
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_soft_deleted ON %I (soft_deleted_at)', p_table_name, p_table_name);
    RAISE NOTICE 'Added soft_deleted_at index for %', p_table_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Tables with is_deleted + deleted_at pattern (migrate to soft_deleted_at)
-- These tables already have soft_deleted_at via softDeleteColumns spread
-- Just verify indexes exist
-- ============================================================================

-- projects - already has soft_deleted_at via schema
SELECT _add_soft_deleted_at_if_missing('projects');

-- clients - already has soft_deleted_at via schema
SELECT _add_soft_deleted_at_if_missing('clients');

-- seo_gsc_snapshots - already has soft_deleted_at via schema
SELECT _add_soft_deleted_at_if_missing('seo_gsc_snapshots');

-- seo_ga4_snapshots - already has soft_deleted_at via schema
SELECT _add_soft_deleted_at_if_missing('seo_ga4_snapshots');

-- reports - already has soft_deleted_at via schema
SELECT _add_soft_deleted_at_if_missing('reports');

-- site_changes - already has soft_deleted_at via schema
SELECT _add_soft_deleted_at_if_missing('site_changes');

-- content_briefs - already has soft_deleted_at via schema
SELECT _add_soft_deleted_at_if_missing('content_briefs');

-- proposals - already has soft_deleted_at via schema
SELECT _add_soft_deleted_at_if_missing('proposals');

-- ============================================================================
-- Tables with deleted_at only pattern (add soft_deleted_at, sync values)
-- ============================================================================

-- Check and add for any tables that might have deleted_at without soft_deleted_at
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'deleted_at'
      AND table_name NOT IN (
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'soft_deleted_at'
      )
  LOOP
    PERFORM _add_soft_deleted_at_if_missing(r.table_name);
  END LOOP;
END $$;

-- ============================================================================
-- Tables that should have soft delete but are missing both patterns
-- Add soft_deleted_at column for future soft delete support
-- ============================================================================

-- goal_templates (system-level, soft delete for deprecation)
SELECT _add_soft_deleted_at_if_missing('goal_templates');

-- client_goals (user data, soft delete required)
SELECT _add_soft_deleted_at_if_missing('client_goals');

-- goal_snapshots (historical data, no soft delete needed - but add for consistency)
SELECT _add_soft_deleted_at_if_missing('goal_snapshots');

-- detected_patterns (analytics data)
SELECT _add_soft_deleted_at_if_missing('detected_patterns');

-- client_dashboard_metrics (computed data, no soft delete needed)
-- Skip - these are re-computed

-- portfolio_aggregates (computed data, no soft delete needed)
-- Skip - these are re-computed

-- ============================================================================
-- Clean up helper function
-- ============================================================================
DROP FUNCTION IF EXISTS _add_soft_deleted_at_if_missing(TEXT);

-- ============================================================================
-- Documentation
-- ============================================================================
COMMENT ON COLUMN clients.soft_deleted_at IS
  'Standard soft delete timestamp (DBS-005/006/007). NULL = active, non-NULL = deleted with timestamp.';
COMMENT ON COLUMN clients.is_deleted IS
  'DEPRECATED: Use soft_deleted_at IS NOT NULL instead. Will be removed in future migration.';
COMMENT ON COLUMN clients.deleted_at IS
  'DEPRECATED: Use soft_deleted_at instead. Will be removed in future migration.';
