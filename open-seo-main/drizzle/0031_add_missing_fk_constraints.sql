-- Migration: Add missing FK constraints for data integrity
-- Date: 2026-04-27
--
-- This migration adds FK constraints with CASCADE delete to prevent orphaned records
-- when clients are deleted. All tables reference clients.id (TEXT type).
--
-- Tables affected:
-- - client_goals.client_id -> clients.id (CASCADE)
-- - alert_rules.client_id -> clients.id (CASCADE)
-- - alerts.client_id -> clients.id (CASCADE)
-- - client_dashboard_metrics.client_id -> clients.id (CASCADE)
-- - portfolio_activity.client_id -> clients.id (CASCADE, nullable)
-- - audit_findings.audit_id -> audits.id (CASCADE)
-- - audit_findings.page_id -> audit_pages.id (CASCADE)
-- - gsc_snapshots.client_id -> clients.id (CASCADE)
-- - gsc_query_snapshots.client_id -> clients.id (CASCADE)
-- - ga4_snapshots.client_id -> clients.id (CASCADE)
-- - client_branding.client_id -> clients.id (CASCADE)
-- - reports.client_id -> clients.id (CASCADE)
--
-- Also fixes:
-- - client_goals.created_at NOT NULL
-- - client_goals.updated_at NOT NULL

-- ============================================================================
-- STEP 1: Clean up orphaned records before adding FK constraints
-- ============================================================================

-- Delete orphaned client_goals
DELETE FROM client_goals
WHERE client_id NOT IN (SELECT id FROM clients);

-- Delete orphaned alert_rules
DELETE FROM alert_rules
WHERE client_id NOT IN (SELECT id FROM clients);

-- Delete orphaned alerts
DELETE FROM alerts
WHERE client_id NOT IN (SELECT id FROM clients);

-- Delete orphaned client_dashboard_metrics
DELETE FROM client_dashboard_metrics
WHERE client_id NOT IN (SELECT id FROM clients);

-- Delete orphaned portfolio_activity (only non-null client_ids)
DELETE FROM portfolio_activity
WHERE client_id IS NOT NULL AND client_id NOT IN (SELECT id FROM clients);

-- Delete orphaned audit_findings
DELETE FROM audit_findings
WHERE audit_id NOT IN (SELECT id FROM audits);

DELETE FROM audit_findings
WHERE page_id NOT IN (SELECT id FROM audit_pages);

-- Delete orphaned gsc_snapshots
DELETE FROM gsc_snapshots
WHERE client_id NOT IN (SELECT id FROM clients);

-- Delete orphaned gsc_query_snapshots
DELETE FROM gsc_query_snapshots
WHERE client_id NOT IN (SELECT id FROM clients);

-- Delete orphaned ga4_snapshots
DELETE FROM ga4_snapshots
WHERE client_id NOT IN (SELECT id FROM clients);

-- Delete orphaned client_branding
DELETE FROM client_branding
WHERE client_id NOT IN (SELECT id FROM clients);

-- Delete orphaned reports
DELETE FROM reports
WHERE client_id NOT IN (SELECT id FROM clients);

-- ============================================================================
-- STEP 2: Add FK constraint to client_goals.client_id
-- ============================================================================
ALTER TABLE client_goals
  ADD CONSTRAINT fk_client_goals_client
  FOREIGN KEY (client_id)
  REFERENCES clients(id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 3: Add FK constraint to alert_rules.client_id
-- ============================================================================
ALTER TABLE alert_rules
  ADD CONSTRAINT fk_alert_rules_client
  FOREIGN KEY (client_id)
  REFERENCES clients(id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 4: Add FK constraint to alerts.client_id
-- ============================================================================
ALTER TABLE alerts
  ADD CONSTRAINT fk_alerts_client
  FOREIGN KEY (client_id)
  REFERENCES clients(id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 5: Add FK constraint to client_dashboard_metrics.client_id
-- ============================================================================
ALTER TABLE client_dashboard_metrics
  ADD CONSTRAINT fk_client_dashboard_metrics_client
  FOREIGN KEY (client_id)
  REFERENCES clients(id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 6: Add FK constraint to portfolio_activity.client_id (nullable)
-- ============================================================================
ALTER TABLE portfolio_activity
  ADD CONSTRAINT fk_portfolio_activity_client
  FOREIGN KEY (client_id)
  REFERENCES clients(id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 7: Add FK constraint to audit_findings.audit_id
-- ============================================================================
ALTER TABLE audit_findings
  ADD CONSTRAINT fk_audit_findings_audit
  FOREIGN KEY (audit_id)
  REFERENCES audits(id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 8: Add FK constraint to audit_findings.page_id
-- ============================================================================
ALTER TABLE audit_findings
  ADD CONSTRAINT fk_audit_findings_page
  FOREIGN KEY (page_id)
  REFERENCES audit_pages(id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 9: Add FK constraint to gsc_snapshots.client_id
-- ============================================================================
ALTER TABLE gsc_snapshots
  ADD CONSTRAINT fk_gsc_snapshots_client
  FOREIGN KEY (client_id)
  REFERENCES clients(id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 10: Add FK constraint to gsc_query_snapshots.client_id
-- ============================================================================
ALTER TABLE gsc_query_snapshots
  ADD CONSTRAINT fk_gsc_query_snapshots_client
  FOREIGN KEY (client_id)
  REFERENCES clients(id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 11: Add FK constraint to ga4_snapshots.client_id
-- ============================================================================
ALTER TABLE ga4_snapshots
  ADD CONSTRAINT fk_ga4_snapshots_client
  FOREIGN KEY (client_id)
  REFERENCES clients(id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 12: Add FK constraint to client_branding.client_id
-- ============================================================================
ALTER TABLE client_branding
  ADD CONSTRAINT fk_client_branding_client
  FOREIGN KEY (client_id)
  REFERENCES clients(id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 13: Add FK constraint to reports.client_id
-- ============================================================================
ALTER TABLE reports
  ADD CONSTRAINT fk_reports_client
  FOREIGN KEY (client_id)
  REFERENCES clients(id)
  ON DELETE CASCADE;

-- ============================================================================
-- STEP 14: Fix NOT NULL on timestamp fields in client_goals
-- ============================================================================
-- First set any NULL values to current timestamp
UPDATE client_goals
SET created_at = NOW()
WHERE created_at IS NULL;

UPDATE client_goals
SET updated_at = NOW()
WHERE updated_at IS NULL;

-- Then add NOT NULL constraint
ALTER TABLE client_goals
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE client_goals
  ALTER COLUMN updated_at SET NOT NULL;
