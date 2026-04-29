-- Migration: Schema Integrity Fixes
-- Date: 2026-04-28
-- Source: Database audit issues H-08, H-11, M-06, M-07
--
-- Issues Addressed:
--   H-08: prospects.converted_client_id is TEXT but should be UUID (references clients.id)
--   H-11: report_schedules.client_id has no FK - document as intentional (cross-db design)
--   M-06: audits.started_by_user_id has no FK - document as intentional
--   M-07: Migration 0033 CHECK constraints may fail on existing invalid data
--
-- This migration:
-- 1. Converts prospects.converted_client_id from TEXT to UUID
-- 2. Adds comments documenting intentional cross-db FKs
-- 3. Cleans up any invalid data that might violate CHECK constraints from 0033

-- ============================================================================
-- STEP 0: DATA CLEANUP FOR EXISTING CHECK CONSTRAINTS (M-07 fix)
-- Clean up any invalid data BEFORE migration 0033's constraints would fail
-- These are idempotent - safe to run even if constraints already exist
-- ============================================================================

-- Cleanup: clients.status - set invalid statuses to 'active'
UPDATE clients
SET status = 'active'
WHERE status IS NOT NULL
  AND status NOT IN ('onboarding', 'active', 'paused', 'churned');

-- Cleanup: site_changes.status - set invalid statuses to 'pending'
UPDATE site_changes
SET status = 'pending'
WHERE status IS NOT NULL
  AND status NOT IN ('pending', 'applied', 'verified', 'reverted', 'failed');

-- Cleanup: prospects.status - set invalid statuses to 'new'
UPDATE prospects
SET status = 'new'
WHERE status NOT IN ('new', 'analyzing', 'analyzed', 'converted', 'archived');

-- Cleanup: prospects.pipeline_stage - set invalid stages to 'new'
UPDATE prospects
SET pipeline_stage = 'new'
WHERE pipeline_stage NOT IN ('new', 'analyzing', 'scored', 'qualified', 'contacted', 'negotiating', 'converted', 'archived');

-- Cleanup: prospect_analyses.status - set invalid statuses to 'failed'
UPDATE prospect_analyses
SET status = 'failed'
WHERE status NOT IN ('pending', 'running', 'completed', 'failed');

-- Cleanup: prospect_analyses.analysis_type - set invalid types to 'quick_scan'
UPDATE prospect_analyses
SET analysis_type = 'quick_scan'
WHERE analysis_type NOT IN ('quick_scan', 'deep_dive', 'opportunity_discovery');

-- Cleanup: content_briefs.status - set invalid statuses to 'draft'
UPDATE content_briefs
SET status = 'draft'
WHERE status IS NOT NULL
  AND status NOT IN ('draft', 'ready', 'generating', 'published');

-- Cleanup: content_briefs.voice_mode - set invalid modes to 'best_practices'
UPDATE content_briefs
SET voice_mode = 'best_practices'
WHERE voice_mode IS NOT NULL
  AND voice_mode NOT IN ('preservation', 'application', 'best_practices');

-- Cleanup: voice_profiles.voice_blend_weight - clamp to valid range 0-1
UPDATE voice_profiles
SET voice_blend_weight = GREATEST(0, LEAST(1, voice_blend_weight))
WHERE voice_blend_weight IS NOT NULL
  AND (voice_blend_weight < 0 OR voice_blend_weight > 1);

-- Cleanup: voice_profiles.keyword_density_tolerance - clamp to valid range 1-20
UPDATE voice_profiles
SET keyword_density_tolerance = GREATEST(1, LEAST(20, keyword_density_tolerance))
WHERE keyword_density_tolerance IS NOT NULL
  AND (keyword_density_tolerance < 1 OR keyword_density_tolerance > 20);

-- Cleanup: content_briefs.target_word_count - clamp to valid range 100-50000
UPDATE content_briefs
SET target_word_count = GREATEST(100, LEAST(50000, target_word_count))
WHERE target_word_count IS NOT NULL
  AND (target_word_count < 100 OR target_word_count > 50000);

-- Cleanup: keyword_rankings.position - clamp to valid range 0-100
UPDATE keyword_rankings
SET position = GREATEST(0, LEAST(100, position))
WHERE position IS NOT NULL
  AND (position < 0 OR position > 100);


-- ============================================================================
-- STEP 1: FIX PROSPECTS.CONVERTED_CLIENT_ID TYPE MISMATCH (H-08)
-- Convert from TEXT to UUID to match clients.id type
-- ============================================================================

-- First, clean up any invalid UUID strings in converted_client_id
-- Set to NULL if not a valid UUID format (will fail ::uuid cast otherwise)
UPDATE prospects
SET converted_client_id = NULL
WHERE converted_client_id IS NOT NULL
  AND converted_client_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Now convert the column type from TEXT to UUID
ALTER TABLE prospects
  ALTER COLUMN converted_client_id TYPE uuid USING converted_client_id::uuid;

-- Add comment documenting the column's purpose
COMMENT ON COLUMN prospects.converted_client_id IS
  'UUID reference to clients.id when prospect is converted to client. '
  'No FK constraint due to cross-database design (clients may live in AI-Writer DB). '
  'Application-level validation performed in ProspectService.markConverted().';


-- ============================================================================
-- STEP 2: DOCUMENT CROSS-DB FK DESIGN DECISIONS (H-11, M-06)
-- Add comments explaining why certain columns lack FK constraints
-- ============================================================================

-- H-11: report_schedules.client_id - cross-database reference
COMMENT ON COLUMN report_schedules.client_id IS
  'UUID reference to clients.id (canonical source in AI-Writer DB). '
  'No FK constraint due to cross-database design. '
  'Application-level validation in schedule routes verifies client exists via resolveClientId(). '
  'Orphaned schedules cleaned by maintenance job (phase 16 backlog).';

-- M-06: audits.started_by_user_id - cross-system reference to Clerk users
COMMENT ON COLUMN audits.started_by_user_id IS
  'User ID from Clerk authentication system. '
  'No FK constraint as Clerk users are external to PostgreSQL. '
  'Validated during request via requireAuth middleware. '
  'Format: Clerk user_* ID string.';

-- M-06 related: audits.client_id - nullable, cross-database reference
COMMENT ON COLUMN audits.client_id IS
  'UUID reference to clients.id for client-scoped audits. '
  'Nullable for legacy audits created before Phase 6 client scoping. '
  'No FK constraint due to cross-database design. '
  'NULL means "unscoped" not "all clients" - queries must handle explicitly.';


-- ============================================================================
-- STEP 3: ADD INDEX ON PROSPECTS.CONVERTED_CLIENT_ID FOR QUERY PERFORMANCE
-- Supports lookup of prospects that converted to a specific client
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_prospects_converted_client
ON prospects (converted_client_id)
WHERE converted_client_id IS NOT NULL;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON SCHEMA public IS
  'TeveroSEO database - Schema integrity fixes for H-08, H-11, M-06, M-07. Migration 0035.';
