-- Rollback for migration 0030_race_condition_constraints.sql
-- Date: 2026-04-28
--
-- This rollback removes the unique constraint added to prevent duplicate projects.

BEGIN;

-- Step 1: Drop the unique index
DROP INDEX IF EXISTS uq_projects_org_name;

-- Step 2: Remove migration record
DELETE FROM drizzle.__drizzle_migrations WHERE hash = '0030_race_condition_constraints';

COMMIT;
