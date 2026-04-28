-- Phase 21: Agency Command Center
-- Migration 0009: client_dashboard_metrics, portfolio_activity, dashboard_views

-- Client dashboard metrics table (pre-computed)
CREATE TABLE IF NOT EXISTS client_dashboard_metrics (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  health_score INTEGER NOT NULL DEFAULT 100,
  health_breakdown JSONB,
  traffic_current INTEGER DEFAULT 0,
  traffic_previous INTEGER DEFAULT 0,
  traffic_trend_pct TEXT,
  keywords_total INTEGER DEFAULT 0,
  keywords_top_10 INTEGER DEFAULT 0,
  keywords_top_3 INTEGER DEFAULT 0,
  keywords_position_1 INTEGER DEFAULT 0,
  keywords_distribution JSONB,
  backlinks_total INTEGER DEFAULT 0,
  backlinks_new_month INTEGER DEFAULT 0,
  alerts_open INTEGER DEFAULT 0,
  alerts_critical INTEGER DEFAULT 0,
  last_report_at TIMESTAMPTZ,
  last_audit_at TIMESTAMPTZ,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_dashboard_metrics_computed ON client_dashboard_metrics (computed_at);

-- Portfolio activity feed table
CREATE TABLE IF NOT EXISTS portfolio_activity (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  client_id TEXT,
  event_type TEXT NOT NULL,
  event_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_activity_workspace_created ON portfolio_activity (workspace_id, created_at);
CREATE INDEX IF NOT EXISTS ix_activity_client ON portfolio_activity (client_id);

-- Dashboard views table (saved filters and layouts)
CREATE TABLE IF NOT EXISTS dashboard_views (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  user_id TEXT,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  layout JSONB,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_views_workspace_user ON dashboard_views (workspace_id, user_id);
CREATE INDEX IF NOT EXISTS ix_views_default ON dashboard_views (workspace_id, is_default);
