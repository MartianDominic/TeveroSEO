-- Migration: Data Integrity Constraints - Round 2 Audit Fixes
-- Date: 2026-04-28
-- Source: AUDIT-ROUND2-DATA-INTEGRITY.md
--
-- Issues Addressed:
--   C-02: Add upper bound to keyword_rankings.position (0-100)
--   C-07: Add UNIQUE constraint on client_goals(clientId, templateId)
--   H-01/H-02: Add CHECK constraints for status text fields using enum values
--   H-04: Add CHECK constraint for voice_blend_weight (0-1)
--   H-13: Update keyword_density_tolerance range to 1-20 (from 1-10 in 0032)
--   H-14: Already covered by seo_vs_voice_priority_range in 0032
--   M-18: Add CHECK constraint for target_word_count (100-50000)
--   M-19: Add CHECK constraint for voice_mode against VOICE_MODES values

-- ============================================================================
-- STEP 1: FIX KEYWORD POSITION RANGE CONSTRAINT (C-02)
-- Migration 0032 only enforced >= 0, add upper bound of 100
-- ============================================================================

-- Drop existing constraint to replace with correct range
ALTER TABLE keyword_rankings
  DROP CONSTRAINT IF EXISTS chk_position_positive;

-- Add corrected constraint with upper bound
ALTER TABLE keyword_rankings
  ADD CONSTRAINT chk_position_range
  CHECK (position >= 0 AND position <= 100);

COMMENT ON COLUMN keyword_rankings.position IS 'Ranking position 1-100, or 0 if not ranking in top 100';


-- ============================================================================
-- STEP 2: ADD UNIQUE CONSTRAINT ON CLIENT GOALS (C-07)
-- Prevent duplicate goal types per client
-- ============================================================================

-- Create unique index for (clientId, templateId) combination
-- Using CREATE INDEX IF NOT EXISTS with UNIQUE for idempotent migration
DO $$ BEGIN
  CREATE UNIQUE INDEX uq_client_goals_client_template
  ON client_goals (client_id, template_id);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON INDEX uq_client_goals_client_template IS 'Ensures one goal per template per client';


-- ============================================================================
-- STEP 3: ADD CHECK CONSTRAINTS FOR TEXT STATUS FIELDS (H-01, H-02)
-- These ensure status fields only accept valid enum-like values
-- Note: Enum types were created in 0032 but not applied to all columns
-- ============================================================================

-- Client status validation (H-01)
ALTER TABLE clients
  ADD CONSTRAINT chk_client_status_valid
  CHECK (status IN ('onboarding', 'active', 'paused', 'churned'));

-- Site changes status validation (H-02)
ALTER TABLE site_changes
  ADD CONSTRAINT chk_site_change_status_valid
  CHECK (status IN ('pending', 'applied', 'verified', 'reverted', 'failed'));

-- Prospect status validation
ALTER TABLE prospects
  ADD CONSTRAINT chk_prospect_status_valid
  CHECK (status IN ('new', 'analyzing', 'analyzed', 'converted', 'archived'));

-- Prospect pipeline stage validation
ALTER TABLE prospects
  ADD CONSTRAINT chk_pipeline_stage_valid
  CHECK (pipeline_stage IN ('new', 'analyzing', 'scored', 'qualified', 'contacted', 'negotiating', 'converted', 'archived'));

-- Prospect analysis status validation
ALTER TABLE prospect_analyses
  ADD CONSTRAINT chk_analysis_status_valid
  CHECK (status IN ('pending', 'running', 'completed', 'failed'));

-- Prospect analysis type validation
ALTER TABLE prospect_analyses
  ADD CONSTRAINT chk_analysis_type_valid
  CHECK (analysis_type IN ('quick_scan', 'deep_dive', 'opportunity_discovery'));

-- Content brief status validation (M-19 related)
ALTER TABLE content_briefs
  ADD CONSTRAINT chk_brief_status_valid
  CHECK (status IN ('draft', 'ready', 'generating', 'published'));


-- ============================================================================
-- STEP 4: ADD VOICE BLEND WEIGHT CONSTRAINT (H-04)
-- Ensure voice_blend_weight is between 0.0 and 1.0
-- ============================================================================

ALTER TABLE voice_profiles
  ADD CONSTRAINT chk_voice_blend_weight_range
  CHECK (voice_blend_weight IS NULL OR (voice_blend_weight >= 0 AND voice_blend_weight <= 1));

COMMENT ON COLUMN voice_profiles.voice_blend_weight IS 'Blend weight 0.0-1.0 where 0=full template, 1=full custom';


-- ============================================================================
-- STEP 5: UPDATE KEYWORD DENSITY TOLERANCE CONSTRAINT (H-13)
-- Audit specified 1-20 range for percentage tolerance, 0032 had 1-10
-- ============================================================================

-- Drop the constraint from 0032 (chk_keyword_density_range)
ALTER TABLE voice_profiles
  DROP CONSTRAINT IF EXISTS chk_keyword_density_range;

-- Add updated constraint with 1-20 range
ALTER TABLE voice_profiles
  ADD CONSTRAINT chk_keyword_density_tolerance_range
  CHECK (keyword_density_tolerance IS NULL OR (keyword_density_tolerance >= 1 AND keyword_density_tolerance <= 20));

COMMENT ON COLUMN voice_profiles.keyword_density_tolerance IS 'Acceptable keyword density tolerance 1-20 percent';


-- ============================================================================
-- STEP 6: ADD CONTENT BRIEF CONSTRAINTS (M-18, M-19)
-- ============================================================================

-- Target word count range (M-18)
ALTER TABLE content_briefs
  ADD CONSTRAINT chk_target_word_count_range
  CHECK (target_word_count >= 100 AND target_word_count <= 50000);

-- Voice mode validation (M-19)
ALTER TABLE content_briefs
  ADD CONSTRAINT chk_voice_mode_valid
  CHECK (voice_mode IN ('preservation', 'application', 'best_practices'));

COMMENT ON COLUMN content_briefs.target_word_count IS 'Target word count 100-50000';
COMMENT ON COLUMN content_briefs.voice_mode IS 'Voice generation mode: preservation, application, or best_practices';


-- ============================================================================
-- STEP 7: ADD ADDITIONAL INDEX FOR COMMON QUERY PATTERN (M-01)
-- Change type is frequently filtered
-- ============================================================================

-- drizzle-kit:disable-transaction
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ix_site_changes_change_type"
ON "site_changes" ("change_type");


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON SCHEMA public IS 'TeveroSEO database - Data integrity constraints from Round 2 audit. Migration 0033.';
