-- Rollback for migration 0021_change_tracking_tables.sql
-- Date: 2026-04-28
--
-- This rollback removes the change tracking tables.
-- WARNING: All change tracking data will be lost.

BEGIN;

-- Step 1: Drop indexes
DROP INDEX IF EXISTS "ix_site_changes_client";
DROP INDEX IF EXISTS "ix_site_changes_connection";
DROP INDEX IF EXISTS "ix_site_changes_category";
DROP INDEX IF EXISTS "ix_site_changes_status";
DROP INDEX IF EXISTS "ix_site_changes_resource";
DROP INDEX IF EXISTS "ix_site_changes_batch";
DROP INDEX IF EXISTS "ix_site_changes_created";
DROP INDEX IF EXISTS "ix_site_changes_reverted";
DROP INDEX IF EXISTS "ix_change_backups_client";
DROP INDEX IF EXISTS "ix_change_backups_expires";
DROP INDEX IF EXISTS "ix_change_backups_scope";
DROP INDEX IF EXISTS "ix_rollback_triggers_client";
DROP INDEX IF EXISTS "ix_rollback_triggers_type";
DROP INDEX IF EXISTS "ix_rollback_triggers_enabled";

-- Step 2: Drop FK constraints
ALTER TABLE "site_changes" DROP CONSTRAINT IF EXISTS "site_changes_client_id_clients_id_fk";
ALTER TABLE "site_changes" DROP CONSTRAINT IF EXISTS "site_changes_connection_id_site_connections_id_fk";
ALTER TABLE "change_backups" DROP CONSTRAINT IF EXISTS "change_backups_client_id_clients_id_fk";
ALTER TABLE "rollback_triggers" DROP CONSTRAINT IF EXISTS "rollback_triggers_client_id_clients_id_fk";

-- Step 3: Backup tables before dropping (optional - comment out if not needed)
-- CREATE TABLE IF NOT EXISTS _backup_site_changes_0021 AS SELECT * FROM site_changes;
-- CREATE TABLE IF NOT EXISTS _backup_change_backups_0021 AS SELECT * FROM change_backups;
-- CREATE TABLE IF NOT EXISTS _backup_rollback_triggers_0021 AS SELECT * FROM rollback_triggers;

-- Step 4: Drop tables
DROP TABLE IF EXISTS "site_changes";
DROP TABLE IF EXISTS "change_backups";
DROP TABLE IF EXISTS "rollback_triggers";

-- Step 5: Remove migration record
DELETE FROM drizzle.__drizzle_migrations WHERE hash = '0021_change_tracking_tables';

COMMIT;
