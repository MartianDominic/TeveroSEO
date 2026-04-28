-- 0032_rename_gsc_snapshots_with_view.sql
-- Date: 2026-04-28
--
-- This version includes a backward compatibility view to support
-- rolling deployments and code that still references the old table name.

BEGIN;

-- Step 1: Drop existing indexes (will recreate with new names)
DROP INDEX IF EXISTS "ix_gsc_snapshots_client_date";

-- Step 2: Drop existing constraints
ALTER TABLE "gsc_snapshots" DROP CONSTRAINT IF EXISTS "uq_gsc_snapshots_client_date";

-- Step 3: Rename the table
ALTER TABLE "gsc_snapshots" RENAME TO "seo_gsc_snapshots";

-- Step 4: Recreate the unique constraint with new name
ALTER TABLE "seo_gsc_snapshots"
  ADD CONSTRAINT "uq_seo_gsc_snapshots_client_date" UNIQUE("client_id", "date");

-- Step 5: Recreate the index with new name
CREATE INDEX "ix_seo_gsc_snapshots_client_date"
  ON "seo_gsc_snapshots" USING btree ("client_id", "date");

-- Step 6: Create backward compatibility view for old table name
-- This allows code referencing gsc_snapshots to continue working
CREATE OR REPLACE VIEW gsc_snapshots AS
SELECT * FROM seo_gsc_snapshots;

-- Add comment documenting the view
COMMENT ON VIEW gsc_snapshots IS
  'DEPRECATED: Backward compatibility view for gsc_snapshots -> seo_gsc_snapshots rename.
   Use seo_gsc_snapshots directly. View will be removed after all code is updated.';

-- Add comment documenting the rename reason
COMMENT ON TABLE "seo_gsc_snapshots" IS
  'SEO GSC daily aggregate snapshots. Renamed from gsc_snapshots (2026-04-28) to avoid collision with AI-Writer gsc_snapshots table.';

COMMIT;

-- ============================================================================
-- NOTES:
-- ============================================================================
-- The gsc_snapshots VIEW supports:
--   - SELECT queries (read-only)
--   - INSERT/UPDATE/DELETE through the view (PostgreSQL simple view rules)
--
-- After updating all code to use seo_gsc_snapshots:
--   DROP VIEW IF EXISTS gsc_snapshots;
--
-- To check for remaining references:
--   grep -r "gsc_snapshots" --include="*.ts" --include="*.tsx" | grep -v seo_gsc_snapshots
