-- 0032_indexes_batch2.sql - Index creation batch 2 of 3
-- Date: 2026-04-28
--
-- Run this after batch1 completes successfully.
--
-- drizzle-kit:disable-transaction

-- Link opportunities (continued)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_opportunities_audit_id"
ON "link_opportunities" ("audit_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_opportunities_page_id"
ON "link_opportunities" ("page_id");

-- Link suggestions indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_suggestions_client_id"
ON "link_suggestions" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_suggestions_audit_id"
ON "link_suggestions" ("audit_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_suggestions_source_page_id"
ON "link_suggestions" ("source_page_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_suggestions_target_page_id"
ON "link_suggestions" ("target_page_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_suggestions_opportunity_id"
ON "link_suggestions" ("opportunity_id");

-- Voice and keyword indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_keyword_cannibalization_client_id"
ON "keyword_cannibalization" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_voice_profiles_client_id"
ON "voice_profiles" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_voice_analysis_profile_id"
ON "voice_analysis" ("profile_id");

-- Batch 2 complete: 10 indexes created
