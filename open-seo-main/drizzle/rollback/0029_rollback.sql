-- Rollback for migration 0029_fix_client_id_types_and_fks.sql
-- Date: 2026-04-28
--
-- This rollback reverses UUID->TEXT type changes and removes FK constraints.
-- NOTE: Orphaned records deleted during migration CANNOT be restored without backup.
--
-- To restore deleted records, first restore from backup table:
--   INSERT INTO prospect_keywords SELECT * FROM _backup_prospect_keywords_0029;

BEGIN;

-- ============================================================================
-- STEP 1: Drop FK constraints added in 0029
-- ============================================================================

ALTER TABLE client_goals DROP CONSTRAINT IF EXISTS client_goals_template_id_goal_templates_id_fk;

ALTER TABLE site_changes DROP CONSTRAINT IF EXISTS site_changes_connection_id_site_connections_id_fk;

ALTER TABLE prospect_keywords DROP CONSTRAINT IF EXISTS fk_prospect_keywords_prospect;

-- ============================================================================
-- STEP 2: Reverse client_id type changes (TEXT -> UUID)
-- NOTE: This will fail if any client_id is not a valid UUID format
-- ============================================================================

-- Validate before converting (run manually first):
-- SELECT client_id FROM reports WHERE client_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' LIMIT 10;

ALTER TABLE reports
  ALTER COLUMN client_id TYPE UUID USING client_id::UUID;

ALTER TABLE gsc_snapshots
  ALTER COLUMN client_id TYPE UUID USING client_id::UUID;

ALTER TABLE gsc_query_snapshots
  ALTER COLUMN client_id TYPE UUID USING client_id::UUID;

ALTER TABLE ga4_snapshots
  ALTER COLUMN client_id TYPE UUID USING client_id::UUID;

ALTER TABLE client_branding
  ALTER COLUMN client_id TYPE UUID USING client_id::UUID;

ALTER TABLE report_schedules
  ALTER COLUMN client_id TYPE UUID USING client_id::UUID;

-- ============================================================================
-- STEP 3: Restore original FK constraints (without CASCADE)
-- ============================================================================

-- Original site_changes FK (if it existed)
-- ALTER TABLE site_changes
--   ADD CONSTRAINT site_changes_connection_id_site_connections_id_fk
--   FOREIGN KEY (connection_id) REFERENCES site_connections(id);

-- Original client_goals FK (if it existed)
-- ALTER TABLE client_goals
--   ADD CONSTRAINT client_goals_template_id_goal_templates_id_fk
--   FOREIGN KEY (template_id) REFERENCES goal_templates(id);

-- ============================================================================
-- STEP 4: Remove migration record
-- ============================================================================

DELETE FROM drizzle.__drizzle_migrations WHERE hash = '0029_fix_client_id_types_and_fks';

COMMIT;

-- Post-rollback verification:
-- SELECT data_type FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'client_id';
-- Should return: uuid
