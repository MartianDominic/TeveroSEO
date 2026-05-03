-- Migration: Add composite indexes for hot query patterns
-- Phase 69-03: Query Optimization
--
-- Uses CREATE INDEX CONCURRENTLY to avoid locking tables during creation.
-- Note: CONCURRENTLY cannot run inside a transaction; run each statement separately.
--
-- These indexes optimize:
-- 1. Audit queries by client + status (dashboard filtering)
-- 2. Brief queries by client + status + created (content pipeline)
-- 3. SEO check queries by audit + severity (findings analysis)
-- 4. Prospect queries by workspace + status (sales pipeline)
-- 5. Background job queries by status + scheduled (job runner)

-- ============================================================================
-- Audits Table Indexes
-- ============================================================================

-- Composite index for audit queries filtered by client and status
-- Partial index excludes soft-deleted records
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audits_client_status
ON audits (client_id, status)
WHERE deleted_at IS NULL;

-- ============================================================================
-- Content Briefs Table Indexes
-- ============================================================================

-- Composite index for brief queries with client, status, and date sorting
-- Supports dashboard queries: "show me recent briefs for client X with status Y"
-- Note: content_briefs uses is_deleted boolean, not deleted_at timestamp
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_briefs_client_status_created
ON content_briefs (client_id, status, created_at DESC)
WHERE is_deleted = false;

-- ============================================================================
-- SEO Checks / Audit Findings Table Indexes
-- ============================================================================

-- Composite index for SEO check queries filtered by audit and severity
-- Note: The table is named audit_findings, not seo_checks
-- This index already exists in 0061 as idx_audit_findings_audit_severity
-- Skipping duplicate creation

-- ============================================================================
-- Prospects Table Indexes
-- ============================================================================

-- Composite index for prospect queries filtered by workspace and status
-- Most prospect queries filter by workspace first, then by status
-- Note: prospects table doesn't have deleted_at, uses status='archived'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prospects_workspace_status
ON prospects (workspace_id, status);

-- ============================================================================
-- Background Jobs Table (BullMQ metadata)
-- ============================================================================

-- Note: BullMQ stores jobs in Redis, not PostgreSQL.
-- If there's a custom background_jobs table for tracking, add index here.
-- Checking if table exists before creating index.

-- This is a conditional index - only create if table exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'background_jobs') THEN
    EXECUTE 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_status_scheduled
             ON background_jobs (status, scheduled_at)
             WHERE status = ''pending''';
  END IF;
END $$;

-- ============================================================================
-- Additional Hot Query Indexes
-- ============================================================================

-- Proposals by workspace + status (agency pipeline)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_proposals_workspace_status
ON proposals (workspace_id, status)
WHERE deleted_at IS NULL;

-- Contracts by workspace + status (contract management)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contracts_workspace_status
ON contracts (workspace_id, status);

-- Follow-ups by workspace + status + due date (command center)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_followups_workspace_status_due
ON follow_ups (workspace_id, status, due_date)
WHERE completed_at IS NULL;

-- ============================================================================
-- Verification
-- ============================================================================

-- After migration, run ANALYZE on affected tables to update statistics:
-- ANALYZE audits;
-- ANALYZE content_briefs;
-- ANALYZE prospects;
-- ANALYZE proposals;
-- ANALYZE contracts;
-- ANALYZE follow_ups;
