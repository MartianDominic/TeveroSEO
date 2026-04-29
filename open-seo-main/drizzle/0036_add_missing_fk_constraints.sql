-- Migration: Add missing FK constraints to prevent orphaned records
-- Date: 2026-04-28
-- Agent: Fix Agent 10: FK Constraints Part 1
--
-- This migration adds FK constraints to:
-- 1. audits.client_id -> clients.id (SET NULL on delete)
-- 2. report_schedules.client_id -> clients.id (CASCADE on delete)
-- 3. prospects.converted_client_id -> clients.id (SET NULL on delete)
--
-- Strategy:
-- - For nullable columns (audits.client_id, prospects.converted_client_id): SET NULL
-- - For required columns (report_schedules.client_id): CASCADE
-- - Handle existing orphaned records before adding constraints

BEGIN;

-- ============================================================================
-- STEP 0: Create backup tables for records that will be modified
-- ============================================================================

-- Backup orphaned audits (client_id references non-existent client)
CREATE TABLE IF NOT EXISTS _backup_audits_orphaned_client_0036 AS
SELECT * FROM audits
WHERE client_id IS NOT NULL
  AND client_id NOT IN (SELECT id FROM clients);

-- Backup orphaned report_schedules
CREATE TABLE IF NOT EXISTS _backup_report_schedules_0036 AS
SELECT * FROM report_schedules
WHERE client_id NOT IN (SELECT id FROM clients);

-- Backup orphaned prospects (converted_client_id references non-existent client)
CREATE TABLE IF NOT EXISTS _backup_prospects_orphaned_converted_0036 AS
SELECT * FROM prospects
WHERE converted_client_id IS NOT NULL
  AND converted_client_id NOT IN (SELECT id FROM clients);

-- ============================================================================
-- STEP 1: Log counts and verify before proceeding
-- ============================================================================

DO $$
DECLARE
  audits_orphans INTEGER;
  schedules_orphans INTEGER;
  prospects_orphans INTEGER;
  total_orphans INTEGER;
  max_threshold INTEGER := 500;
BEGIN
  SELECT COUNT(*) INTO audits_orphans FROM _backup_audits_orphaned_client_0036;
  SELECT COUNT(*) INTO schedules_orphans FROM _backup_report_schedules_0036;
  SELECT COUNT(*) INTO prospects_orphans FROM _backup_prospects_orphaned_converted_0036;

  total_orphans := audits_orphans + schedules_orphans + prospects_orphans;

  RAISE NOTICE 'Orphaned records found: audits=%, report_schedules=%, prospects=%',
    audits_orphans, schedules_orphans, prospects_orphans;

  IF total_orphans > max_threshold THEN
    RAISE EXCEPTION 'Too many orphaned records (%). Review backups before proceeding.', total_orphans;
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Clean up orphaned records
-- ============================================================================

-- For audits: SET NULL for orphaned client references (preserves audit data)
UPDATE audits
SET client_id = NULL
WHERE client_id IS NOT NULL
  AND client_id NOT IN (SELECT id FROM clients);

-- For report_schedules: DELETE orphaned records (CASCADE behavior)
DELETE FROM report_schedules
WHERE client_id NOT IN (SELECT id FROM clients);

-- For prospects: SET NULL for orphaned converted_client_id (preserves prospect data)
UPDATE prospects
SET converted_client_id = NULL
WHERE converted_client_id IS NOT NULL
  AND converted_client_id NOT IN (SELECT id FROM clients);

-- ============================================================================
-- STEP 3: Add FK constraints
-- ============================================================================

-- FK-01: audits.client_id -> clients.id (SET NULL on delete)
-- Preserves audit history when client is removed
ALTER TABLE audits
  ADD CONSTRAINT fk_audits_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- FK-02: report_schedules.client_id -> clients.id (CASCADE on delete)
-- Removes schedules when client is deleted (no orphan schedules)
ALTER TABLE report_schedules
  ADD CONSTRAINT fk_report_schedules_client
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- FK-03: prospects.converted_client_id -> clients.id (SET NULL on delete)
-- Preserves prospect history when client is removed
ALTER TABLE prospects
  ADD CONSTRAINT fk_prospects_converted_client
  FOREIGN KEY (converted_client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- ============================================================================
-- STEP 4: Create indexes for FK columns (if not already indexed)
-- ============================================================================

-- Index on audits.client_id for FK lookups (may already exist from 0035)
CREATE INDEX IF NOT EXISTS ix_audits_client_id ON audits(client_id);

-- Index on report_schedules.client_id (already exists as ix_schedules_client_id)
-- No action needed

-- Index on prospects.converted_client_id for FK lookups
CREATE INDEX IF NOT EXISTS ix_prospects_converted_client_id ON prospects(converted_client_id);

COMMIT;

-- ============================================================================
-- POST-MIGRATION: Clean up backup tables after verifying migration success
-- ============================================================================

-- Run these manually after confirming migration is successful:
-- DROP TABLE IF EXISTS _backup_audits_orphaned_client_0036;
-- DROP TABLE IF EXISTS _backup_report_schedules_0036;
-- DROP TABLE IF EXISTS _backup_prospects_orphaned_converted_0036;
