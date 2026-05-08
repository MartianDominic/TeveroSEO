-- Migration: 0008_fix_continuous_aggregate_columns.sql
-- Phase 96: DBS-004 Fix - Resolve column name and TIMESTAMPTZ mismatch in continuous aggregates
--
-- PROBLEM:
-- 1. Continuous aggregates use `day` and `total_clicks` but services query for `bucket` and `daily_clicks`
-- 2. time_bucket() on TIMESTAMPTZ returns TIMESTAMPTZ, but queries cast to DATE losing timezone info
--
-- SOLUTION:
-- 1. Recreate continuous aggregates with correct column names (bucket, daily_clicks, daily_impressions)
-- 2. Use TIMESTAMPTZ consistently (no DATE casts in aggregate definition)
-- 3. Update refresh policies
--
-- NOTE: Continuous aggregates must be dropped and recreated - cannot alter column names in place.
-- Data will be recomputed automatically by the refresh policy.

-- ============================================
-- 1. Drop existing continuous aggregate policies
-- ============================================
-- Must drop policies before dropping aggregates

DO $$
BEGIN
    -- Drop growing_pages_cagg policy if exists
    IF EXISTS (
        SELECT 1 FROM timescaledb_information.jobs
        WHERE hypertable_name = 'growing_pages_cagg'
    ) THEN
        PERFORM remove_continuous_aggregate_policy('growing_pages_cagg', if_exists => TRUE);
    END IF;

    -- Drop master_dashboard_cagg policy if exists
    IF EXISTS (
        SELECT 1 FROM timescaledb_information.jobs
        WHERE hypertable_name = 'master_dashboard_cagg'
    ) THEN
        PERFORM remove_continuous_aggregate_policy('master_dashboard_cagg', if_exists => TRUE);
    END IF;
EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if policies don't exist
    RAISE NOTICE 'Policies may not exist: %', SQLERRM;
END $$;

-- ============================================
-- 2. Drop existing continuous aggregates
-- ============================================
-- CASCADE drops dependent indexes automatically

DROP MATERIALIZED VIEW IF EXISTS growing_pages_cagg CASCADE;
DROP MATERIALIZED VIEW IF EXISTS master_dashboard_cagg CASCADE;

-- ============================================
-- 3. Recreate growing_pages_cagg with correct column names
-- ============================================
-- Uses TIMESTAMPTZ bucket column (not DATE) to preserve timezone information
-- Column names match what services expect: bucket, daily_clicks, daily_impressions, avg_ctr, avg_position

CREATE MATERIALIZED VIEW growing_pages_cagg
WITH (timescaledb.continuous) AS
SELECT
  site_id,
  page_url,
  time_bucket('1 day', query_time) AS bucket,  -- TIMESTAMPTZ bucket, not DATE
  SUM(clicks) AS daily_clicks,                  -- Renamed from total_clicks
  SUM(impressions) AS daily_impressions,        -- Renamed from total_impressions
  AVG(ctr) AS avg_ctr,
  AVG(position) AS avg_position,
  COUNT(DISTINCT query) AS unique_queries
FROM seo_gsc_query_analytics
WHERE page_url IS NOT NULL
GROUP BY site_id, page_url, time_bucket('1 day', query_time)
WITH NO DATA;

-- Add refresh policy for growing_pages_cagg (hourly refresh, 3-day lookback)
SELECT add_continuous_aggregate_policy(
  'growing_pages_cagg',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- Create indexes on growing_pages_cagg for fast queries
CREATE INDEX IF NOT EXISTS idx_growing_pages_site_bucket
  ON growing_pages_cagg (site_id, bucket DESC);

CREATE INDEX IF NOT EXISTS idx_growing_pages_page
  ON growing_pages_cagg (page_url);

-- ============================================
-- 4. Recreate master_dashboard_cagg with correct column names
-- ============================================
-- Site-level daily aggregates for high-level dashboard queries
-- Uses TIMESTAMPTZ bucket column and correct column names

CREATE MATERIALIZED VIEW master_dashboard_cagg
WITH (timescaledb.continuous) AS
SELECT
  site_id,
  time_bucket('1 day', query_time) AS bucket,  -- TIMESTAMPTZ bucket, not DATE
  SUM(clicks) AS daily_clicks,                  -- Renamed from total_clicks
  SUM(impressions) AS daily_impressions,        -- Renamed from total_impressions
  AVG(ctr) AS avg_ctr,
  AVG(position) AS avg_position,
  COUNT(DISTINCT query) AS unique_queries,
  COUNT(DISTINCT page_url) AS unique_pages,
  COUNT(DISTINCT country) AS unique_countries
FROM seo_gsc_query_analytics
GROUP BY site_id, time_bucket('1 day', query_time)
WITH NO DATA;

-- Add refresh policy for master_dashboard_cagg (hourly refresh, 3-day lookback)
SELECT add_continuous_aggregate_policy(
  'master_dashboard_cagg',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- Create indexes on master_dashboard_cagg for fast queries
CREATE INDEX IF NOT EXISTS idx_master_dashboard_site_bucket
  ON master_dashboard_cagg (site_id, bucket DESC);

-- ============================================
-- 5. Initial data population (optional, can be slow for large tables)
-- ============================================
-- Refresh aggregates to populate with existing data
-- This is commented out by default as it can take time for large datasets
-- The hourly refresh policy will populate data incrementally

-- CALL refresh_continuous_aggregate('growing_pages_cagg', NULL, NOW());
-- CALL refresh_continuous_aggregate('master_dashboard_cagg', NULL, NOW());

-- ============================================
-- 6. Documentation: Timezone Handling Guidelines
-- ============================================
-- IMPORTANT: When querying continuous aggregates:
--
-- 1. The `bucket` column is TIMESTAMPTZ (timezone-aware)
-- 2. Compare bucket to TIMESTAMPTZ values, not DATE:
--    GOOD: bucket >= '2024-01-01'::timestamptz
--    AVOID: bucket >= '2024-01-01'::date (implicit conversion)
--
-- 3. For display in specific timezone:
--    SELECT bucket AT TIME ZONE 'UTC' AS bucket_utc
--
-- 4. JavaScript Date objects are always UTC internally, so Drizzle
--    handles TIMESTAMPTZ correctly when inserting/selecting.
--
-- See: https://docs.timescale.com/use-timescale/latest/continuous-aggregates/

COMMENT ON MATERIALIZED VIEW growing_pages_cagg IS
  'Phase 96: Daily page performance aggregates for trend detection. bucket=TIMESTAMPTZ. Refresh: hourly.';

COMMENT ON MATERIALIZED VIEW master_dashboard_cagg IS
  'Phase 96: Daily site-level aggregates for master dashboard. bucket=TIMESTAMPTZ. Refresh: hourly.';
