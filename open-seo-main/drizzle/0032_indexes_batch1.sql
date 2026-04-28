-- 0032_indexes_batch1.sql - Index creation batch 1 of 3
-- Date: 2026-04-28
--
-- Split from 0032_database_schema_improvements.sql to avoid long-running migration.
-- Each batch creates ~10 indexes. Run batches sequentially during maintenance window.
--
-- drizzle-kit:disable-transaction

-- Link graph indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_graph_client_id"
ON "link_graph" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_graph_audit_id"
ON "link_graph" ("audit_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_graph_source_page_id"
ON "link_graph" ("source_page_id");

-- Page links indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_page_links_client_id"
ON "page_links" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_page_links_audit_id"
ON "page_links" ("audit_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_page_links_page_id"
ON "page_links" ("page_id");

-- Orphan pages indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orphan_pages_client_id"
ON "orphan_pages" ("client_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orphan_pages_audit_id"
ON "orphan_pages" ("audit_id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_orphan_pages_page_id"
ON "orphan_pages" ("page_id");

-- Link opportunities indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_link_opportunities_client_id"
ON "link_opportunities" ("client_id");

-- Batch 1 complete: 10 indexes created
