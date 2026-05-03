-- Migration: Add performance index for follow_ups status queries
-- MED-PERF-01: Improves query performance for status-based filtering
--
-- This index optimizes:
-- 1. findDueForUnsnooze() - filters by status='snoozed' across all workspaces
-- 2. Any cross-workspace status aggregation queries
-- 3. Background job processing that filters by status without workspace context

-- ============================================================================
-- Follow-ups Status Index
-- ============================================================================

-- Single-column index on status for efficient status-only filtering
-- Complements the composite ix_follow_ups_workspace_status for workspace-scoped queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follow_ups_status
ON follow_ups (status);

-- Composite index for snooze processing: status + snoozed_until
-- Optimizes the findDueForUnsnooze query: WHERE status = 'snoozed' AND snoozed_until <= now()
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_follow_ups_snoozed_until
ON follow_ups (status, snoozed_until)
WHERE status = 'snoozed';

-- ============================================================================
-- Verification
-- ============================================================================

-- Note: CONCURRENTLY indexes don't block writes but require more time
-- Run ANALYZE after migration to update query planner statistics:
-- ANALYZE follow_ups;
