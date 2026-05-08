-- Migration: Shadow Comparison Logs (MIG-3)
-- Phase 95-05: Migration & Monitoring
--
-- Creates persistent storage for shadow mode comparison logs,
-- replacing the in-memory buffer that loses data on restart.

-- Shadow comparison logs table
CREATE TABLE IF NOT EXISTS scraping_shadow_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,

  -- Feature classification
  feature TEXT NOT NULL,
  url TEXT,

  -- Status from each implementation
  legacy_status TEXT NOT NULL,
  new_status TEXT NOT NULL,

  -- Comparison result
  matches BOOLEAN NOT NULL,
  match_score REAL,

  -- Performance timing
  legacy_duration_ms REAL,
  new_duration_ms REAL,

  -- Cost tracking (optional)
  legacy_cost REAL,
  new_cost REAL,

  -- Detailed differences (for debugging mismatches)
  differences JSONB,

  -- Sample diff (first difference for quick viewing)
  sample_diff TEXT,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns

-- 1. Analysis by feature over time
CREATE INDEX IF NOT EXISTS ix_shadow_logs_feature_created
  ON scraping_shadow_logs (feature, created_at);

-- 2. Find mismatches for investigation
CREATE INDEX IF NOT EXISTS ix_shadow_logs_matches_created
  ON scraping_shadow_logs (matches, created_at);

-- 3. Cleanup old logs (retention policy)
CREATE INDEX IF NOT EXISTS ix_shadow_logs_created_at
  ON scraping_shadow_logs (created_at);

-- 4. Feature + match status for targeted analysis
CREATE INDEX IF NOT EXISTS ix_shadow_logs_feature_matches
  ON scraping_shadow_logs (feature, matches);

-- Add comment for documentation
COMMENT ON TABLE scraping_shadow_logs IS
  'Shadow mode comparison logs for migration analysis (MIG-3). Stores results from parallel execution of legacy and new implementations.';
