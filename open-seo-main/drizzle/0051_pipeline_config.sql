-- 0051_pipeline_config.sql
-- Phase 50: Pipeline Kanban - Pipeline Configuration
--
-- Creates pipeline_configs table for per-workspace configurable pipeline stages.
-- Implements D-05 (full pipeline stages), D-06 (configurable stages).

-- Create pipeline_configs table
CREATE TABLE IF NOT EXISTS pipeline_configs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  stages JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index on workspace_id (one config per workspace)
CREATE UNIQUE INDEX IF NOT EXISTS ix_pipeline_configs_workspace ON pipeline_configs(workspace_id);

-- Comment on table
COMMENT ON TABLE pipeline_configs IS 'Per-workspace pipeline stage configuration for sales kanban (Phase 50)';
COMMENT ON COLUMN pipeline_configs.stages IS 'JSONB array of {id, name, order, color} stage objects';
