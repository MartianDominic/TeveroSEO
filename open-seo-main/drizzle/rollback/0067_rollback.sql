-- Rollback: 0067_schema_consistency_fixes.sql
-- Date: 2026-05-03
-- Agent: 2 (Database Schema Consistency)
--
-- This rollback removes:
-- - FK indexes added for performance
-- - Soft delete columns added to content_briefs, proposals, reports
-- - Does NOT remove table/column comments (harmless documentation)
--
-- Note: Run this BEFORE rolling back migration 0067

BEGIN;

-- ============================================================================
-- STEP 1: Remove FK indexes
-- ============================================================================

DROP INDEX IF EXISTS ix_magic_links_organization_id;
DROP INDEX IF EXISTS ix_follow_ups_prospect_id;
DROP INDEX IF EXISTS ix_tasks_client_id;
DROP INDEX IF EXISTS ix_invoice_items_invoice_id;
DROP INDEX IF EXISTS ix_invoices_contract_id;
DROP INDEX IF EXISTS ix_proposal_services_proposal_id;
DROP INDEX IF EXISTS ix_prospect_keywords_prospect_id;


-- ============================================================================
-- STEP 2: Remove soft delete columns from tables that didn't have them before
-- WARNING: This will lose any soft-deleted records. Back up first!
-- ============================================================================

-- reports
DROP INDEX IF EXISTS ix_reports_deleted;
ALTER TABLE reports DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE reports DROP COLUMN IF EXISTS is_deleted;

-- proposals
DROP INDEX IF EXISTS ix_proposals_deleted;
ALTER TABLE proposals DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE proposals DROP COLUMN IF EXISTS is_deleted;

-- content_briefs
DROP INDEX IF EXISTS ix_content_briefs_deleted;
ALTER TABLE content_briefs DROP COLUMN IF EXISTS deleted_at;
ALTER TABLE content_briefs DROP COLUMN IF EXISTS is_deleted;


-- ============================================================================
-- STEP 3: Update migration tracking
-- ============================================================================

-- After running this rollback, also remove the migration record:
-- DELETE FROM drizzle.__drizzle_migrations WHERE id = '<migration_id>';

COMMIT;

-- ============================================================================
-- POST-ROLLBACK VERIFICATION
-- ============================================================================
-- Run these queries to verify rollback was successful:
--
-- -- Verify indexes removed
-- SELECT indexname FROM pg_indexes
-- WHERE indexname LIKE 'ix_%_deleted' OR indexname LIKE 'ix_prospect_keywords_%';
--
-- -- Verify columns removed
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name IN ('reports', 'proposals', 'content_briefs')
--   AND column_name IN ('is_deleted', 'deleted_at');
