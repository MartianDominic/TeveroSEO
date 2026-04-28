-- Rollback for migration 0033_data_integrity_constraints.sql
-- Date: 2026-04-28
--
-- This rollback removes all data integrity constraints added in 0033.

BEGIN;

-- ============================================================================
-- STEP 1: Remove CHECK constraints from various tables
-- ============================================================================

-- Keyword rankings - restore original constraint from 0032
ALTER TABLE keyword_rankings
  DROP CONSTRAINT IF EXISTS chk_position_range;

ALTER TABLE keyword_rankings
  ADD CONSTRAINT chk_position_positive
  CHECK (position >= 0);

-- Client status
ALTER TABLE clients
  DROP CONSTRAINT IF EXISTS chk_client_status_valid;

-- Site changes status
ALTER TABLE site_changes
  DROP CONSTRAINT IF EXISTS chk_site_change_status_valid;

-- Prospect constraints
ALTER TABLE prospects
  DROP CONSTRAINT IF EXISTS chk_prospect_status_valid;

ALTER TABLE prospects
  DROP CONSTRAINT IF EXISTS chk_pipeline_stage_valid;

-- Prospect analyses
ALTER TABLE prospect_analyses
  DROP CONSTRAINT IF EXISTS chk_analysis_status_valid;

ALTER TABLE prospect_analyses
  DROP CONSTRAINT IF EXISTS chk_analysis_type_valid;

-- Content briefs
ALTER TABLE content_briefs
  DROP CONSTRAINT IF EXISTS chk_brief_status_valid;

ALTER TABLE content_briefs
  DROP CONSTRAINT IF EXISTS chk_target_word_count_range;

ALTER TABLE content_briefs
  DROP CONSTRAINT IF EXISTS chk_voice_mode_valid;

-- Voice profiles
ALTER TABLE voice_profiles
  DROP CONSTRAINT IF EXISTS chk_voice_blend_weight_range;

ALTER TABLE voice_profiles
  DROP CONSTRAINT IF EXISTS chk_keyword_density_tolerance_range;

-- Restore original 0032 constraint
ALTER TABLE voice_profiles
  ADD CONSTRAINT chk_keyword_density_range
  CHECK (keyword_density_tolerance IS NULL OR (keyword_density_tolerance >= 1 AND keyword_density_tolerance <= 10));

-- ============================================================================
-- STEP 2: Drop unique index on client_goals
-- ============================================================================

DROP INDEX IF EXISTS uq_client_goals_client_template;

-- ============================================================================
-- STEP 3: Drop index on site_changes change_type
-- ============================================================================

COMMIT;

-- Must be outside transaction for CONCURRENTLY
DROP INDEX CONCURRENTLY IF EXISTS "ix_site_changes_change_type";

BEGIN;

-- ============================================================================
-- STEP 4: Remove comments (optional)
-- ============================================================================

COMMENT ON COLUMN keyword_rankings.position IS NULL;
COMMENT ON COLUMN voice_profiles.voice_blend_weight IS NULL;
COMMENT ON COLUMN voice_profiles.keyword_density_tolerance IS NULL;
COMMENT ON COLUMN content_briefs.target_word_count IS NULL;
COMMENT ON COLUMN content_briefs.voice_mode IS NULL;

-- ============================================================================
-- STEP 5: Remove migration record
-- ============================================================================

DELETE FROM drizzle.__drizzle_migrations WHERE hash = '0033_data_integrity_constraints';

COMMIT;
