-- DataForSEO Cost Tracking Tables
-- Phase 95: Unified Scraping Infrastructure - DataForSEO Optimization
-- Tracks API costs for budget monitoring and optimization analysis

-- =============================================================================
-- DFS Cost Records - Individual request tracking
-- =============================================================================

CREATE TABLE IF NOT EXISTS dfs_cost_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Attribution
  client_id TEXT,
  job_id TEXT,
  workspace_id TEXT,

  -- Request details
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('basic', 'js', 'browser')),
  used_standard_queue BOOLEAN NOT NULL DEFAULT FALSE,
  task_id TEXT,

  -- Cost
  estimated_cost REAL NOT NULL,
  actual_cost REAL,

  -- Result
  success BOOLEAN NOT NULL DEFAULT FALSE,
  status_code INTEGER,
  dfs_error_code INTEGER,
  error_message TEXT,
  response_size_bytes INTEGER,
  response_time_ms INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for dfs_cost_records
CREATE INDEX IF NOT EXISTS ix_dfs_cost_records_client
  ON dfs_cost_records (client_id, created_at);

CREATE INDEX IF NOT EXISTS ix_dfs_cost_records_workspace
  ON dfs_cost_records (workspace_id, created_at);

CREATE INDEX IF NOT EXISTS ix_dfs_cost_records_job
  ON dfs_cost_records (job_id);

CREATE INDEX IF NOT EXISTS ix_dfs_cost_records_created
  ON dfs_cost_records (created_at);

CREATE INDEX IF NOT EXISTS ix_dfs_cost_records_mode
  ON dfs_cost_records (mode, created_at);

CREATE INDEX IF NOT EXISTS ix_dfs_cost_records_queue
  ON dfs_cost_records (used_standard_queue, created_at);

CREATE INDEX IF NOT EXISTS ix_dfs_cost_records_domain
  ON dfs_cost_records (domain, created_at);

CREATE INDEX IF NOT EXISTS ix_dfs_cost_records_failures
  ON dfs_cost_records (success, dfs_error_code);

-- =============================================================================
-- DFS Cost Daily Aggregates - Pre-computed for dashboard
-- =============================================================================

CREATE TABLE IF NOT EXISTS dfs_cost_daily_aggregates (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Grouping
  date DATE NOT NULL,
  client_id TEXT,
  workspace_id TEXT,

  -- Totals
  total_cost REAL NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,

  -- By mode
  basic_cost REAL NOT NULL DEFAULT 0,
  basic_count INTEGER NOT NULL DEFAULT 0,
  js_cost REAL NOT NULL DEFAULT 0,
  js_count INTEGER NOT NULL DEFAULT 0,
  browser_cost REAL NOT NULL DEFAULT 0,
  browser_count INTEGER NOT NULL DEFAULT 0,

  -- By queue type
  standard_queue_cost REAL NOT NULL DEFAULT 0,
  standard_queue_count INTEGER NOT NULL DEFAULT 0,
  live_cost REAL NOT NULL DEFAULT 0,
  live_count INTEGER NOT NULL DEFAULT 0,

  -- Calculated savings
  hypothetical_live_cost REAL NOT NULL DEFAULT 0,
  savings_from_standard_queue REAL NOT NULL DEFAULT 0,

  -- Performance
  avg_response_time_ms INTEGER,
  total_bytes_transferred BIGINT,

  -- Timestamps
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for dfs_cost_daily_aggregates
CREATE INDEX IF NOT EXISTS ix_dfs_daily_date_client
  ON dfs_cost_daily_aggregates (date, client_id);

CREATE INDEX IF NOT EXISTS ix_dfs_daily_date_workspace
  ON dfs_cost_daily_aggregates (date, workspace_id);

CREATE INDEX IF NOT EXISTS ix_dfs_daily_date
  ON dfs_cost_daily_aggregates (date);

CREATE INDEX IF NOT EXISTS ix_dfs_daily_cost
  ON dfs_cost_daily_aggregates (total_cost);

-- Unique constraint for aggregates
CREATE UNIQUE INDEX IF NOT EXISTS ix_dfs_daily_unique
  ON dfs_cost_daily_aggregates (date, COALESCE(client_id, ''), COALESCE(workspace_id, ''));

-- =============================================================================
-- DFS Budget Alerts - Alert tracking for deduplication
-- =============================================================================

CREATE TABLE IF NOT EXISTS dfs_budget_alerts (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Alert details
  alert_type TEXT NOT NULL CHECK (alert_type IN ('daily', 'monthly')),
  threshold REAL NOT NULL,
  spend_amount REAL NOT NULL,
  budget_limit REAL NOT NULL,
  workspace_id TEXT,

  -- Delivery
  sent_successfully BOOLEAN NOT NULL DEFAULT FALSE,
  delivery_method TEXT CHECK (delivery_method IN ('webhook', 'email', 'both')),
  delivery_error TEXT,

  -- Timestamp
  alerted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for dfs_budget_alerts
CREATE INDEX IF NOT EXISTS ix_dfs_budget_alerts_lookup
  ON dfs_budget_alerts (alert_type, threshold, workspace_id, alerted_at);

CREATE INDEX IF NOT EXISTS ix_dfs_budget_alerts_time
  ON dfs_budget_alerts (alerted_at);

-- =============================================================================
-- Helpful Views
-- =============================================================================

-- View: Today's spend summary
CREATE OR REPLACE VIEW v_dfs_spend_today AS
SELECT
  workspace_id,
  COUNT(*) as request_count,
  SUM(COALESCE(actual_cost, estimated_cost)) as total_cost,
  SUM(CASE WHEN mode = 'basic' THEN 1 ELSE 0 END) as basic_count,
  SUM(CASE WHEN mode = 'js' THEN 1 ELSE 0 END) as js_count,
  SUM(CASE WHEN mode = 'browser' THEN 1 ELSE 0 END) as browser_count,
  SUM(CASE WHEN used_standard_queue THEN 1 ELSE 0 END) as standard_queue_count,
  SUM(CASE WHEN NOT used_standard_queue THEN 1 ELSE 0 END) as live_count,
  AVG(response_time_ms) as avg_response_time_ms
FROM dfs_cost_records
WHERE created_at >= CURRENT_DATE
GROUP BY workspace_id;

-- View: This month's spend summary
CREATE OR REPLACE VIEW v_dfs_spend_month AS
SELECT
  workspace_id,
  COUNT(*) as request_count,
  SUM(COALESCE(actual_cost, estimated_cost)) as total_cost,
  SUM(CASE WHEN mode = 'basic' THEN COALESCE(actual_cost, estimated_cost) ELSE 0 END) as basic_cost,
  SUM(CASE WHEN mode = 'js' THEN COALESCE(actual_cost, estimated_cost) ELSE 0 END) as js_cost,
  SUM(CASE WHEN mode = 'browser' THEN COALESCE(actual_cost, estimated_cost) ELSE 0 END) as browser_cost
FROM dfs_cost_records
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY workspace_id;
