-- Phase 101: Schema fixes for background jobs and tenant isolation
-- SCHEMA-01: Add ix_credits_expires index (already in migration 0105, adding to Drizzle schema sync)
-- SCHEMA-02: Add workspaceId column to block_usage table for tenant isolation

-- SCHEMA-01: Ensure ix_credits_expires index exists
-- This index may already exist from migration 0105, so we use IF NOT EXISTS
CREATE INDEX IF NOT EXISTS ix_credits_expires ON client_credits (expires_at);

-- SCHEMA-02: Add workspaceId column to block_usage table
-- Adding as NOT NULL with a subquery default to populate from related content_blocks
-- Step 1: Add column as nullable first
ALTER TABLE block_usage ADD COLUMN IF NOT EXISTS workspace_id TEXT;

-- Step 2: Populate existing rows from content_blocks workspace_id
UPDATE block_usage bu
SET workspace_id = cb.workspace_id
FROM content_blocks cb
WHERE bu.block_id = cb.id
  AND bu.workspace_id IS NULL;

-- Step 3: Add NOT NULL constraint (only if column doesn't already have it)
DO $$
BEGIN
  -- Check if the column is nullable and make it NOT NULL
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'block_usage'
    AND column_name = 'workspace_id'
    AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE block_usage ALTER COLUMN workspace_id SET NOT NULL;
  END IF;
END $$;

-- Step 4: Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'block_usage_workspace_id_fkey'
    AND table_name = 'block_usage'
  ) THEN
    ALTER TABLE block_usage
    ADD CONSTRAINT block_usage_workspace_id_fkey
    FOREIGN KEY (workspace_id) REFERENCES organization(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 5: Add index for workspace_id queries
CREATE INDEX IF NOT EXISTS ix_block_usage_workspace ON block_usage (workspace_id);
