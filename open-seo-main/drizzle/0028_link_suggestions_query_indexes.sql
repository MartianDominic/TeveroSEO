-- Phase 40: Composite indexes for link_suggestions query optimization
-- Optimizes the auto-applicable suggestions query in suggestions.ts
--
-- Query being optimized:
-- SELECT * FROM link_suggestions
-- WHERE client_id = $1
--   AND status = 'pending'
--   AND is_auto_applicable = true
--   AND anchor_confidence >= 0.85
-- ORDER BY score DESC
-- LIMIT 50

-- drizzle-kit:disable-transaction
-- Note: CONCURRENTLY indexes cannot run inside a transaction

-- Composite index for the WHERE clause filter columns
-- Uses partial index to only index rows matching the common filter conditions
-- This significantly reduces index size and improves query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ix_link_suggestions_query_filter"
ON "link_suggestions" (
  "client_id",
  "anchor_confidence" DESC
)
WHERE "status" = 'pending' AND "is_auto_applicable" = true;

-- Covering index for the ORDER BY + LIMIT operation
-- Includes client_id for the equality filter and score DESC for sorting
-- Partial index filters to only pending, auto-applicable suggestions
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ix_link_suggestions_query_sort"
ON "link_suggestions" (
  "client_id",
  "score" DESC
)
WHERE "status" = 'pending' AND "is_auto_applicable" = true;

-- Drop the old single-column partial index as it's superseded by the composite indexes
-- The new indexes provide better coverage for the query pattern
DROP INDEX IF EXISTS "ix_link_suggestions_auto_applicable";
