-- Migration: Add Missing Indexes (SCHEMA-INDEX)
-- Phase 96: Agency Analytics - Schema Standardization
--
-- Adds indexes for common query patterns identified in performance analysis.
-- All indexes use CONCURRENTLY for zero-downtime deployment.
-- Note: CONCURRENTLY cannot run inside a transaction, so these must be run outside.

-- ============================================================================
-- site_tags indexes
-- ============================================================================
-- idx_site_tags_site_id already exists in schema, verify or create
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_site_tags_site_id
  ON site_tags (site_id);

-- ============================================================================
-- client_tags indexes
-- ============================================================================
-- idx_client_tags_client_id already exists in schema, verify or create
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_tags_client_id
  ON client_tags (client_id);

-- ============================================================================
-- seo_gsc_query_analytics indexes
-- Composite index for site + date range queries (common dashboard pattern)
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gsc_query_analytics_site_date
  ON seo_gsc_query_analytics (site_id, query_time DESC);

-- Index for keyword search across all sites
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gsc_query_analytics_query_search
  ON seo_gsc_query_analytics USING gin (query gin_trgm_ops);

-- ============================================================================
-- analytics_annotations indexes
-- Composite index for client + created_at pagination
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_annotations_workspace_created
  ON analytics_annotations (workspace_id, created_at DESC);

-- Index for date-range annotation overlay on charts
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_annotations_date_type
  ON analytics_annotations (annotation_date, annotation_type);

-- ============================================================================
-- seo_gsc_snapshots indexes (for Growing/Decaying pages report)
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seo_gsc_snapshots_client_date_clicks
  ON seo_gsc_snapshots (client_id, date DESC, clicks);

-- ============================================================================
-- seo_ga4_snapshots indexes
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_seo_ga4_snapshots_client_date
  ON seo_ga4_snapshots (client_id, date DESC);

-- ============================================================================
-- gsc_query_snapshots indexes (for query-level analysis)
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gsc_query_snapshots_client_query
  ON gsc_query_snapshots (client_id, query);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_gsc_query_snapshots_position
  ON gsc_query_snapshots (client_id, date, position);

-- ============================================================================
-- content_groups indexes
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_content_groups_match_type
  ON content_groups (site_id, match_type);

-- ============================================================================
-- analytics_topic_clusters indexes
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_analytics_topic_clusters_coverage
  ON analytics_topic_clusters (site_id, coverage DESC);

-- ============================================================================
-- page_index_status indexes (for coverage reports)
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_page_index_status_crawl_time
  ON page_index_status (site_id, last_crawl_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_page_index_status_canonical
  ON page_index_status (site_id, is_canonical, coverage_state);

-- ============================================================================
-- indexing_requests indexes (for queue processing)
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_indexing_requests_pending
  ON indexing_requests (status, priority DESC, created_at)
  WHERE status = 'pending';

-- ============================================================================
-- client_dashboard_metrics indexes (for portfolio queries)
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_dashboard_health_score
  ON client_dashboard_metrics (health_score DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_dashboard_alerts
  ON client_dashboard_metrics (alerts_critical DESC, alerts_open DESC);

-- ============================================================================
-- goal_snapshots indexes (for trend analysis)
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_goal_snapshots_goal_date_pct
  ON goal_snapshots (goal_id, snapshot_date DESC, attainment_pct);

-- ============================================================================
-- client_goals indexes (for workspace aggregation)
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_goals_workspace_primary
  ON client_goals (workspace_id, is_primary)
  WHERE is_primary = true;

-- ============================================================================
-- detected_patterns indexes
-- ============================================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_detected_patterns_active
  ON detected_patterns (workspace_id, status, detected_at DESC)
  WHERE status = 'active';

-- Add documentation
COMMENT ON INDEX idx_gsc_query_analytics_site_date IS
  'Primary lookup pattern for GSC query analytics by site and time range';
COMMENT ON INDEX idx_annotations_workspace_created IS
  'Supports paginated annotation timeline queries';
COMMENT ON INDEX idx_indexing_requests_pending IS
  'Partial index for efficient pending request queue processing';
