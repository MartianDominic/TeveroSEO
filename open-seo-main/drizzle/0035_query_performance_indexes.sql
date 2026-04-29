-- 0035_query_performance_indexes.sql - Add missing indexes for common query patterns
-- Date: 2026-04-28
--
-- Issue: M-20 - Missing indexes for common queries
--
-- Index 1: keyword_rankings (keywordId, date DESC) for time-series queries
--   Query pattern: SELECT * FROM keyword_rankings WHERE keyword_id = ? ORDER BY date DESC
--
-- Index 2: voice_audit_log (auditedAt) for trend analysis filtering
--   Query pattern: Filter by auditedAt for trend analysis
--
-- drizzle-kit:disable-transaction

-- Index for time-series ranking queries with date ordering
-- Optimizes: SELECT * FROM keyword_rankings WHERE keyword_id = ? ORDER BY date DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ix_rankings_keyword_date_desc"
ON "keyword_rankings" ("keyword_id", "date" DESC);

-- Index for voice audit trend analysis queries
-- Optimizes: Filter by auditedAt for trend analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_voice_audit_audited_at"
ON "voice_audit_log" ("audited_at");

-- Migration complete: 2 indexes created
