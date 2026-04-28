-- SAFE version of 0031_add_missing_fk_constraints.sql
-- Date: 2026-04-28
--
-- This version creates backups before DELETE operations and adds
-- transaction boundaries with row count verification.

BEGIN;

-- ============================================================================
-- STEP 0: Create backup tables for all records that will be deleted
-- ============================================================================

-- Backup orphaned client_goals
CREATE TABLE IF NOT EXISTS _backup_client_goals_0031 AS
SELECT * FROM client_goals WHERE client_id NOT IN (SELECT id FROM clients);

-- Backup orphaned alert_rules
CREATE TABLE IF NOT EXISTS _backup_alert_rules_0031 AS
SELECT * FROM alert_rules WHERE client_id NOT IN (SELECT id FROM clients);

-- Backup orphaned alerts
CREATE TABLE IF NOT EXISTS _backup_alerts_0031 AS
SELECT * FROM alerts WHERE client_id NOT IN (SELECT id FROM clients);

-- Backup orphaned client_dashboard_metrics
CREATE TABLE IF NOT EXISTS _backup_client_dashboard_metrics_0031 AS
SELECT * FROM client_dashboard_metrics WHERE client_id NOT IN (SELECT id FROM clients);

-- Backup orphaned portfolio_activity
CREATE TABLE IF NOT EXISTS _backup_portfolio_activity_0031 AS
SELECT * FROM portfolio_activity WHERE client_id IS NOT NULL AND client_id NOT IN (SELECT id FROM clients);

-- Backup orphaned audit_findings (audit_id)
CREATE TABLE IF NOT EXISTS _backup_audit_findings_audit_0031 AS
SELECT * FROM audit_findings WHERE audit_id NOT IN (SELECT id FROM audits);

-- Backup orphaned audit_findings (page_id)
CREATE TABLE IF NOT EXISTS _backup_audit_findings_page_0031 AS
SELECT * FROM audit_findings WHERE page_id NOT IN (SELECT id FROM audit_pages);

-- Backup orphaned gsc_snapshots
CREATE TABLE IF NOT EXISTS _backup_gsc_snapshots_0031 AS
SELECT * FROM gsc_snapshots WHERE client_id NOT IN (SELECT id FROM clients);

-- Backup orphaned gsc_query_snapshots
CREATE TABLE IF NOT EXISTS _backup_gsc_query_snapshots_0031 AS
SELECT * FROM gsc_query_snapshots WHERE client_id NOT IN (SELECT id FROM clients);

-- Backup orphaned ga4_snapshots
CREATE TABLE IF NOT EXISTS _backup_ga4_snapshots_0031 AS
SELECT * FROM ga4_snapshots WHERE client_id NOT IN (SELECT id FROM clients);

-- Backup orphaned client_branding
CREATE TABLE IF NOT EXISTS _backup_client_branding_0031 AS
SELECT * FROM client_branding WHERE client_id NOT IN (SELECT id FROM clients);

-- Backup orphaned reports
CREATE TABLE IF NOT EXISTS _backup_reports_0031 AS
SELECT * FROM reports WHERE client_id NOT IN (SELECT id FROM clients);

-- ============================================================================
-- STEP 0.5: Log backup counts and verify before proceeding
-- ============================================================================

DO $$
DECLARE
  total_backups INTEGER := 0;
  max_threshold INTEGER := 1000; -- Abort if more than 1000 total orphans
  client_goals_count INTEGER;
  alert_rules_count INTEGER;
  alerts_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO client_goals_count FROM _backup_client_goals_0031;
  SELECT COUNT(*) INTO alert_rules_count FROM _backup_alert_rules_0031;
  SELECT COUNT(*) INTO alerts_count FROM _backup_alerts_0031;

  total_backups := client_goals_count + alert_rules_count + alerts_count;

  RAISE NOTICE 'Orphaned records backed up: client_goals=%, alert_rules=%, alerts=%',
    client_goals_count, alert_rules_count, alerts_count;

  IF total_backups > max_threshold THEN
    RAISE EXCEPTION 'Too many orphaned records (%). Review before proceeding.', total_backups;
  END IF;
END $$;

-- ============================================================================
-- STEP 1: Clean up orphaned records (now safe with backups)
-- ============================================================================

DELETE FROM client_goals WHERE client_id NOT IN (SELECT id FROM clients);
DELETE FROM alert_rules WHERE client_id NOT IN (SELECT id FROM clients);
DELETE FROM alerts WHERE client_id NOT IN (SELECT id FROM clients);
DELETE FROM client_dashboard_metrics WHERE client_id NOT IN (SELECT id FROM clients);
DELETE FROM portfolio_activity WHERE client_id IS NOT NULL AND client_id NOT IN (SELECT id FROM clients);
DELETE FROM audit_findings WHERE audit_id NOT IN (SELECT id FROM audits);
DELETE FROM audit_findings WHERE page_id NOT IN (SELECT id FROM audit_pages);
DELETE FROM gsc_snapshots WHERE client_id NOT IN (SELECT id FROM clients);
DELETE FROM gsc_query_snapshots WHERE client_id NOT IN (SELECT id FROM clients);
DELETE FROM ga4_snapshots WHERE client_id NOT IN (SELECT id FROM clients);
DELETE FROM client_branding WHERE client_id NOT IN (SELECT id FROM clients);
DELETE FROM reports WHERE client_id NOT IN (SELECT id FROM clients);

-- ============================================================================
-- STEP 2-13: Add FK constraints (same as original)
-- ============================================================================

ALTER TABLE client_goals
  ADD CONSTRAINT fk_client_goals_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE alert_rules
  ADD CONSTRAINT fk_alert_rules_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE alerts
  ADD CONSTRAINT fk_alerts_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE client_dashboard_metrics
  ADD CONSTRAINT fk_client_dashboard_metrics_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE portfolio_activity
  ADD CONSTRAINT fk_portfolio_activity_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE audit_findings
  ADD CONSTRAINT fk_audit_findings_audit
  FOREIGN KEY (audit_id) REFERENCES audits(id) ON DELETE CASCADE;

ALTER TABLE audit_findings
  ADD CONSTRAINT fk_audit_findings_page
  FOREIGN KEY (page_id) REFERENCES audit_pages(id) ON DELETE CASCADE;

ALTER TABLE gsc_snapshots
  ADD CONSTRAINT fk_gsc_snapshots_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE gsc_query_snapshots
  ADD CONSTRAINT fk_gsc_query_snapshots_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE ga4_snapshots
  ADD CONSTRAINT fk_ga4_snapshots_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE client_branding
  ADD CONSTRAINT fk_client_branding_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

ALTER TABLE reports
  ADD CONSTRAINT fk_reports_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- ============================================================================
-- STEP 14: Fix NOT NULL on timestamp fields
-- ============================================================================

UPDATE client_goals SET created_at = NOW() WHERE created_at IS NULL;
UPDATE client_goals SET updated_at = NOW() WHERE updated_at IS NULL;

ALTER TABLE client_goals ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE client_goals ALTER COLUMN updated_at SET NOT NULL;

COMMIT;

-- ============================================================================
-- POST-MIGRATION: Clean up backup tables after verifying migration success
-- ============================================================================

-- Run these manually after confirming migration is successful:
-- DROP TABLE IF EXISTS _backup_client_goals_0031;
-- DROP TABLE IF EXISTS _backup_alert_rules_0031;
-- DROP TABLE IF EXISTS _backup_alerts_0031;
-- DROP TABLE IF EXISTS _backup_client_dashboard_metrics_0031;
-- DROP TABLE IF EXISTS _backup_portfolio_activity_0031;
-- DROP TABLE IF EXISTS _backup_audit_findings_audit_0031;
-- DROP TABLE IF EXISTS _backup_audit_findings_page_0031;
-- DROP TABLE IF EXISTS _backup_gsc_snapshots_0031;
-- DROP TABLE IF EXISTS _backup_gsc_query_snapshots_0031;
-- DROP TABLE IF EXISTS _backup_ga4_snapshots_0031;
-- DROP TABLE IF EXISTS _backup_client_branding_0031;
-- DROP TABLE IF EXISTS _backup_reports_0031;
