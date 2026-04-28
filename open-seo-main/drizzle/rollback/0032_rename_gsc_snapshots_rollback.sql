-- Rollback for migration 0032_rename_gsc_snapshots.sql
-- Date: 2026-04-28
--
-- This rollback renames seo_gsc_snapshots back to gsc_snapshots
-- and restores original constraint/index names.

BEGIN;

-- Step 1: Drop new index
DROP INDEX IF EXISTS "ix_seo_gsc_snapshots_client_date";

-- Step 2: Drop new constraint
ALTER TABLE "seo_gsc_snapshots" DROP CONSTRAINT IF EXISTS "uq_seo_gsc_snapshots_client_date";

-- Step 3: Rename table back to original
ALTER TABLE "seo_gsc_snapshots" RENAME TO "gsc_snapshots";

-- Step 4: Recreate original constraint
ALTER TABLE "gsc_snapshots"
  ADD CONSTRAINT "uq_gsc_snapshots_client_date" UNIQUE("client_id", "date");

-- Step 5: Recreate original index
CREATE INDEX "ix_gsc_snapshots_client_date"
  ON "gsc_snapshots" USING btree ("client_id", "date");

-- Step 6: Remove comment (optional)
COMMENT ON TABLE "gsc_snapshots" IS NULL;

-- Step 7: Remove migration record
DELETE FROM drizzle.__drizzle_migrations WHERE hash = '0032_rename_gsc_snapshots';

COMMIT;

-- NOTE: After running this rollback, you may also want to create a compatibility
-- view for any code that still references seo_gsc_snapshots:
-- CREATE VIEW seo_gsc_snapshots AS SELECT * FROM gsc_snapshots;
