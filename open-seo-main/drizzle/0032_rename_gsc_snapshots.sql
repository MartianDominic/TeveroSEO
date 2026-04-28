-- Migration: 0032_rename_gsc_snapshots
-- Description: Rename gsc_snapshots to seo_gsc_snapshots to avoid conflict
--              with AI-Writer's gsc_snapshots table (CRITICAL-DB-002)
--
-- This migration renames the table and all associated constraints/indexes.
-- The data is preserved - this is a rename, not a recreation.

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

-- Add a comment documenting the rename reason
COMMENT ON TABLE "seo_gsc_snapshots" IS
  'SEO GSC daily aggregate snapshots. Renamed from gsc_snapshots (2026-04-28) to avoid collision with AI-Writer gsc_snapshots table.';
