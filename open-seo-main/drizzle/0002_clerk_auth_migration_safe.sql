-- SAFE version of 0002_clerk_auth_migration.sql
-- Date: 2026-04-28
--
-- This version creates backups before DROP TABLE operations.
-- Use this instead of the original 0002 when data preservation is needed.

BEGIN;

-- Step 1: Create backup tables BEFORE dropping
CREATE TABLE IF NOT EXISTS _backup_session_0002 AS SELECT * FROM "session";
CREATE TABLE IF NOT EXISTS _backup_account_0002 AS SELECT * FROM "account";
CREATE TABLE IF NOT EXISTS _backup_verification_0002 AS SELECT * FROM "verification";

-- Log row counts for verification
DO $$
DECLARE
  session_count INTEGER;
  account_count INTEGER;
  verification_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO session_count FROM _backup_session_0002;
  SELECT COUNT(*) INTO account_count FROM _backup_account_0002;
  SELECT COUNT(*) INTO verification_count FROM _backup_verification_0002;

  RAISE NOTICE 'Backed up % sessions, % accounts, % verifications',
    session_count, account_count, verification_count;
END $$;

-- Step 2: Add clerk_user_id to user table
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "clerk_user_id" TEXT UNIQUE;

-- Step 3: Create index for clerk_user_id lookups
CREATE INDEX IF NOT EXISTS "user_clerk_user_id_idx" ON "user" ("clerk_user_id");

-- Step 4: Drop better-auth session management tables
-- Data preserved in _backup_* tables
DROP TABLE IF EXISTS "session" CASCADE;
DROP TABLE IF EXISTS "account" CASCADE;
DROP TABLE IF EXISTS "verification" CASCADE;

COMMIT;

-- Note: user, organization, member, invitation tables are preserved
-- clerk_user_id will be populated on first login via Clerk
--
-- To restore data after rollback:
--   INSERT INTO session SELECT * FROM _backup_session_0002;
--   INSERT INTO account SELECT * FROM _backup_account_0002;
--   INSERT INTO verification SELECT * FROM _backup_verification_0002;
--
-- To clean up backup tables after successful migration:
--   DROP TABLE IF EXISTS _backup_session_0002;
--   DROP TABLE IF EXISTS _backup_account_0002;
--   DROP TABLE IF EXISTS _backup_verification_0002;
