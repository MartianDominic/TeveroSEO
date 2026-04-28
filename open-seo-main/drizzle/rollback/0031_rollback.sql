-- Rollback for migration 0031_add_missing_fk_constraints.sql
-- Date: 2026-04-28
--
-- This rollback removes FK constraints added in 0031.
-- NOTE: Records deleted during orphan cleanup CANNOT be restored without backup.
--
-- To restore deleted records, use the backup tables created by the safe migration:
--   INSERT INTO client_goals SELECT * FROM _backup_client_goals_0031;
--   INSERT INTO alert_rules SELECT * FROM _backup_alert_rules_0031;
--   etc.

BEGIN;

-- ============================================================================
-- STEP 1: Drop all FK constraints added in 0031
-- ============================================================================

ALTER TABLE client_goals DROP CONSTRAINT IF EXISTS fk_client_goals_client;
ALTER TABLE alert_rules DROP CONSTRAINT IF EXISTS fk_alert_rules_client;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS fk_alerts_client;
ALTER TABLE client_dashboard_metrics DROP CONSTRAINT IF EXISTS fk_client_dashboard_metrics_client;
ALTER TABLE portfolio_activity DROP CONSTRAINT IF EXISTS fk_portfolio_activity_client;
ALTER TABLE audit_findings DROP CONSTRAINT IF EXISTS fk_audit_findings_audit;
ALTER TABLE audit_findings DROP CONSTRAINT IF EXISTS fk_audit_findings_page;
ALTER TABLE gsc_snapshots DROP CONSTRAINT IF EXISTS fk_gsc_snapshots_client;
ALTER TABLE gsc_query_snapshots DROP CONSTRAINT IF EXISTS fk_gsc_query_snapshots_client;
ALTER TABLE ga4_snapshots DROP CONSTRAINT IF EXISTS fk_ga4_snapshots_client;
ALTER TABLE client_branding DROP CONSTRAINT IF EXISTS fk_client_branding_client;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS fk_reports_client;

-- ============================================================================
-- STEP 2: Revert NOT NULL constraints on client_goals timestamps
-- ============================================================================

ALTER TABLE client_goals ALTER COLUMN created_at DROP NOT NULL;
ALTER TABLE client_goals ALTER COLUMN updated_at DROP NOT NULL;

-- ============================================================================
-- STEP 3: Remove migration record
-- ============================================================================

DELETE FROM drizzle.__drizzle_migrations WHERE hash = '0031_add_missing_fk_constraints';

COMMIT;

-- Post-rollback verification:
-- SELECT constraint_name FROM information_schema.table_constraints
-- WHERE table_name = 'client_goals' AND constraint_type = 'FOREIGN KEY';
-- Should return empty or not include fk_client_goals_client
