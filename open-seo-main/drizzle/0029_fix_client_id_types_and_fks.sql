-- Migration: Fix client_id type mismatches and add missing FK constraints
-- Date: 2026-04-27
--
-- BREAKING CHANGE: This migration changes client_id column types from UUID to TEXT
-- in multiple tables. Ensure no UUID-typed client_id values exist before running.
--
-- Tables affected (UUID -> TEXT):
-- - reports
-- - gsc_snapshots
-- - gsc_query_snapshots
-- - ga4_snapshots
-- - client_branding
-- - report_schedules
--
-- FK constraints added:
-- - prospect_keywords.prospect_id -> prospects.id (CASCADE)
-- - site_changes.connection_id -> site_connections.id (CASCADE)
-- - client_goals.template_id -> goal_templates.id (RESTRICT)

-- ============================================================================
-- STEP 1: Fix client_id type in reports table
-- ============================================================================
ALTER TABLE reports
  ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;

-- ============================================================================
-- STEP 2: Fix client_id type in gsc_snapshots table
-- ============================================================================
ALTER TABLE gsc_snapshots
  ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;

-- ============================================================================
-- STEP 3: Fix client_id type in gsc_query_snapshots table
-- ============================================================================
ALTER TABLE gsc_query_snapshots
  ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;

-- ============================================================================
-- STEP 4: Fix client_id type in ga4_snapshots table
-- ============================================================================
ALTER TABLE ga4_snapshots
  ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;

-- ============================================================================
-- STEP 5: Fix client_id type in client_branding table
-- ============================================================================
ALTER TABLE client_branding
  ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;

-- ============================================================================
-- STEP 6: Fix client_id type in report_schedules table
-- ============================================================================
ALTER TABLE report_schedules
  ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;

-- ============================================================================
-- STEP 7: Add FK constraint to prospect_keywords.prospect_id
-- ============================================================================
-- First, delete any orphaned records that would violate the FK
DELETE FROM prospect_keywords
WHERE prospect_id NOT IN (SELECT id FROM prospects);

ALTER TABLE prospect_keywords
  ADD CONSTRAINT fk_prospect_keywords_prospect
  FOREIGN KEY (prospect_id)
  REFERENCES prospects(id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 8: Add onDelete CASCADE to site_changes.connection_id
-- ============================================================================
-- First drop existing FK (if any), then recreate with CASCADE
-- Check if constraint exists before dropping
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'site_changes_connection_id_site_connections_id_fk'
    AND table_name = 'site_changes'
  ) THEN
    ALTER TABLE site_changes DROP CONSTRAINT site_changes_connection_id_site_connections_id_fk;
  END IF;
END $$;

ALTER TABLE site_changes
  ADD CONSTRAINT site_changes_connection_id_site_connections_id_fk
  FOREIGN KEY (connection_id)
  REFERENCES site_connections(id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 9: Add onDelete RESTRICT to client_goals.template_id
-- ============================================================================
-- First drop existing FK (if any), then recreate with RESTRICT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'client_goals_template_id_goal_templates_id_fk'
    AND table_name = 'client_goals'
  ) THEN
    ALTER TABLE client_goals DROP CONSTRAINT client_goals_template_id_goal_templates_id_fk;
  END IF;
END $$;

ALTER TABLE client_goals
  ADD CONSTRAINT client_goals_template_id_goal_templates_id_fk
  FOREIGN KEY (template_id)
  REFERENCES goal_templates(id)
  ON DELETE RESTRICT;
