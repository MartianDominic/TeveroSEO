-- Phase 96-01: TimescaleDB GSC Query Analytics Hypertable
-- Creates TimescaleDB hypertable for 125M rows/day agency-scale GSC data
-- with 7-day chunks, compression, retention, and continuous aggregates

-- Enable TimescaleDB extension (idempotent)
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create the GSC query analytics table with composite primary key
-- Note: PRIMARY KEY must include query_time for hypertable partitioning
CREATE TABLE IF NOT EXISTS seo_gsc_query_analytics (
  id UUID DEFAULT gen_random_uuid(),
  site_id TEXT NOT NULL,
  query_time TIMESTAMPTZ NOT NULL,
  query TEXT NOT NULL,
  page_url TEXT,
  country TEXT,
  device TEXT,
  search_appearance TEXT,
  clicks INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  ctr REAL,
  position REAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, query_time),
  CONSTRAINT fk_gsc_analytics_site FOREIGN KEY (site_id)
    REFERENCES site_connections(id) ON DELETE CASCADE
);

-- Convert to hypertable with 7-day chunks
-- chunk_time_interval = 7 days = 604800 seconds * 1000000 microseconds
SELECT create_hypertable(
  'seo_gsc_query_analytics',
  'query_time',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

-- Create indexes for query patterns
CREATE INDEX IF NOT EXISTS idx_gsc_query_site_time
  ON seo_gsc_query_analytics (site_id, query_time DESC);

CREATE INDEX IF NOT EXISTS idx_gsc_query_query
  ON seo_gsc_query_analytics (query);

CREATE INDEX IF NOT EXISTS idx_gsc_query_page
  ON seo_gsc_query_analytics (page_url);

-- Add compression policy for chunks older than 30 days
-- Compression reduces storage by 90-95%
SELECT add_compression_policy(
  'seo_gsc_query_analytics',
  compress_after => INTERVAL '30 days',
  if_not_exists => TRUE
);

-- Configure compression settings for optimal space savings
ALTER TABLE seo_gsc_query_analytics SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'site_id',
  timescaledb.compress_orderby = 'query_time DESC'
);

-- Add retention policy for 5-year data lifecycle
SELECT add_retention_policy(
  'seo_gsc_query_analytics',
  drop_after => INTERVAL '5 years',
  if_not_exists => TRUE
);

-- Continuous Aggregate 1: Growing Pages (Daily Page Performance)
-- Tracks daily metrics per page for trend detection and growth analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS growing_pages_cagg
WITH (timescaledb.continuous) AS
SELECT
  site_id,
  page_url,
  time_bucket('1 day', query_time) AS day,
  SUM(clicks) AS total_clicks,
  SUM(impressions) AS total_impressions,
  AVG(ctr) AS avg_ctr,
  AVG(position) AS avg_position,
  COUNT(DISTINCT query) AS unique_queries
FROM seo_gsc_query_analytics
WHERE page_url IS NOT NULL
GROUP BY site_id, page_url, day
WITH NO DATA;

-- Add refresh policy for growing_pages_cagg (hourly refresh)
SELECT add_continuous_aggregate_policy(
  'growing_pages_cagg',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- Continuous Aggregate 2: Master Dashboard (Daily Site Totals)
-- Site-level daily aggregates for high-level dashboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS master_dashboard_cagg
WITH (timescaledb.continuous) AS
SELECT
  site_id,
  time_bucket('1 day', query_time) AS day,
  SUM(clicks) AS total_clicks,
  SUM(impressions) AS total_impressions,
  AVG(ctr) AS avg_ctr,
  AVG(position) AS avg_position,
  COUNT(DISTINCT query) AS unique_queries,
  COUNT(DISTINCT page_url) AS unique_pages,
  COUNT(DISTINCT country) AS unique_countries
FROM seo_gsc_query_analytics
GROUP BY site_id, day
WITH NO DATA;

-- Add refresh policy for master_dashboard_cagg (hourly refresh)
SELECT add_continuous_aggregate_policy(
  'master_dashboard_cagg',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- Create indexes on continuous aggregates for fast queries
CREATE INDEX IF NOT EXISTS idx_growing_pages_site_day
  ON growing_pages_cagg (site_id, day DESC);

CREATE INDEX IF NOT EXISTS idx_growing_pages_page
  ON growing_pages_cagg (page_url);

CREATE INDEX IF NOT EXISTS idx_master_dashboard_site_day
  ON master_dashboard_cagg (site_id, day DESC);

-- Grant permissions (if using specific role)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON seo_gsc_query_analytics TO tevero_app;
-- GRANT SELECT ON growing_pages_cagg TO tevero_app;
-- GRANT SELECT ON master_dashboard_cagg TO tevero_app;
