-- SAFE version of 0029_fix_client_id_types_and_fks.sql
-- Date: 2026-04-28
--
-- This version adds pre-migration validation and backup before DELETE.

BEGIN;

-- ============================================================================
-- STEP 0: Pre-migration validation
-- ============================================================================

DO $$
DECLARE
  invalid_reports INTEGER;
  invalid_gsc INTEGER;
  invalid_query INTEGER;
  invalid_ga4 INTEGER;
  invalid_branding INTEGER;
  invalid_schedules INTEGER;
BEGIN
  -- Check for non-UUID format values that would fail conversion
  SELECT COUNT(*) INTO invalid_reports FROM reports
    WHERE client_id IS NOT NULL AND client_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  IF invalid_reports > 0 THEN
    RAISE NOTICE 'WARNING: % reports have non-UUID client_id values', invalid_reports;
  END IF;

  -- Validation passes - proceed with migration
  RAISE NOTICE 'Pre-migration validation passed';
END $$;

-- ============================================================================
-- STEP 1-6: Fix client_id type (UUID -> TEXT)
-- ============================================================================

ALTER TABLE reports
  ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;

ALTER TABLE gsc_snapshots
  ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;

ALTER TABLE gsc_query_snapshots
  ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;

ALTER TABLE ga4_snapshots
  ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;

ALTER TABLE client_branding
  ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;

ALTER TABLE report_schedules
  ALTER COLUMN client_id TYPE TEXT USING client_id::TEXT;

-- ============================================================================
-- STEP 7: Backup and delete orphaned prospect_keywords, then add FK
-- ============================================================================

-- Create backup before delete
CREATE TABLE IF NOT EXISTS _backup_prospect_keywords_0029 AS
SELECT * FROM prospect_keywords WHERE prospect_id NOT IN (SELECT id FROM prospects);

DO $$
DECLARE
  orphan_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_count FROM _backup_prospect_keywords_0029;
  RAISE NOTICE 'Backed up % orphaned prospect_keywords records', orphan_count;
END $$;

DELETE FROM prospect_keywords
WHERE prospect_id NOT IN (SELECT id FROM prospects);

ALTER TABLE prospect_keywords
  ADD CONSTRAINT fk_prospect_keywords_prospect
  FOREIGN KEY (prospect_id)
  REFERENCES prospects(id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 8: Update site_changes FK with CASCADE
-- ============================================================================

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
-- STEP 9: Update client_goals FK with RESTRICT
-- ============================================================================

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

COMMIT;

-- Post-migration verification:
-- SELECT data_type FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'client_id';
-- Should return: text

-- To restore deleted records:
-- INSERT INTO prospect_keywords SELECT * FROM _backup_prospect_keywords_0029;

-- To clean up backup:
-- DROP TABLE IF EXISTS _backup_prospect_keywords_0029;
