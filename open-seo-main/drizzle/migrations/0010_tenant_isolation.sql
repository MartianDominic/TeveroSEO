-- Migration: 0010_tenant_isolation.sql
-- Purpose: Add tenant isolation enforcement and cost tracking tables
-- Phase: Multi-tenant isolation for SEO chat system
-- GDPR: Supports right-to-forget via cascade deletes and audit logs

-- ============================================================================
-- 1. Add missing indexes for tenant-scoped queries
-- ============================================================================

-- Ensure all client-scoped tables have workspace_id indexes
-- These are critical for enforcing tenant isolation at the database level

-- Projects table - add composite index for tenant-scoped queries
CREATE INDEX IF NOT EXISTS ix_projects_workspace_client
  ON projects (workspace_id, client_id);

-- Reports table
CREATE INDEX IF NOT EXISTS ix_reports_workspace_client
  ON reports (workspace_id, client_id);

-- Content briefs table
CREATE INDEX IF NOT EXISTS ix_content_briefs_workspace_client
  ON content_briefs (workspace_id, client_id);

-- ============================================================================
-- 2. Add Row-Level Security (RLS) policies
-- ============================================================================

-- Enable RLS on clients table
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see clients in their workspace
-- Note: This requires the application to SET role and current_setting('app.workspace_id')
CREATE POLICY IF NOT EXISTS clients_workspace_isolation
  ON clients
  FOR ALL
  USING (workspace_id = current_setting('app.workspace_id', true));

-- Enable RLS on projects table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see projects in their workspace
CREATE POLICY IF NOT EXISTS projects_workspace_isolation
  ON projects
  FOR ALL
  USING (workspace_id = current_setting('app.workspace_id', true));

-- ============================================================================
-- 3. Create tenant_usage_daily table for cost aggregation
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_usage_daily (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- Date for this usage record
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Cost in microdollars (1/1,000,000 of a dollar)
  total_cost_micros BIGINT NOT NULL DEFAULT 0,

  -- Breakdown by operation type (JSONB for flexibility)
  cost_by_operation JSONB NOT NULL DEFAULT '{}',

  -- Token usage for LLM operations
  total_input_tokens BIGINT NOT NULL DEFAULT 0,
  total_output_tokens BIGINT NOT NULL DEFAULT 0,

  -- Operation counts
  operation_counts JSONB NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint per workspace/client/date
  UNIQUE (workspace_id, client_id, usage_date)
);

-- Indexes for tenant_usage_daily
CREATE INDEX IF NOT EXISTS ix_tenant_usage_daily_workspace
  ON tenant_usage_daily (workspace_id);
CREATE INDEX IF NOT EXISTS ix_tenant_usage_daily_workspace_date
  ON tenant_usage_daily (workspace_id, usage_date);
CREATE INDEX IF NOT EXISTS ix_tenant_usage_daily_client
  ON tenant_usage_daily (client_id);

-- ============================================================================
-- 4. Create tenant_usage_monthly table for billing
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_usage_monthly (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,

  -- Month for this usage record (first day of month)
  usage_month DATE NOT NULL,

  -- Cost in microdollars
  total_cost_micros BIGINT NOT NULL DEFAULT 0,

  -- Breakdown by operation type
  cost_by_operation JSONB NOT NULL DEFAULT '{}',

  -- Token usage
  total_input_tokens BIGINT NOT NULL DEFAULT 0,
  total_output_tokens BIGINT NOT NULL DEFAULT 0,

  -- Operation counts
  operation_counts JSONB NOT NULL DEFAULT '{}',

  -- Billing status
  billing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (billing_status IN ('pending', 'invoiced', 'paid', 'waived')),
  invoice_id TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint per workspace/client/month
  UNIQUE (workspace_id, client_id, usage_month)
);

-- Indexes for tenant_usage_monthly
CREATE INDEX IF NOT EXISTS ix_tenant_usage_monthly_workspace
  ON tenant_usage_monthly (workspace_id);
CREATE INDEX IF NOT EXISTS ix_tenant_usage_monthly_workspace_month
  ON tenant_usage_monthly (workspace_id, usage_month);
CREATE INDEX IF NOT EXISTS ix_tenant_usage_monthly_billing
  ON tenant_usage_monthly (billing_status);

-- ============================================================================
-- 5. Create data_deletion_log table for GDPR compliance
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_deletion_log (
  id TEXT PRIMARY KEY,

  -- Request details
  workspace_id TEXT NOT NULL,
  client_id UUID NOT NULL, -- Not a FK since the client will be deleted
  client_name_hash TEXT NOT NULL, -- Anonymized for audit purposes

  -- Actor information
  requested_by TEXT NOT NULL,

  -- Deletion details
  reason TEXT NOT NULL
    CHECK (reason IN ('gdpr_request', 'client_request', 'churn', 'test_data', 'other')),
  notes TEXT,

  -- Counts of deleted records
  deleted_counts JSONB NOT NULL DEFAULT '{}',

  -- Status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  error_message TEXT,

  -- Timestamps
  requested_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for data_deletion_log
CREATE INDEX IF NOT EXISTS ix_data_deletion_log_workspace
  ON data_deletion_log (workspace_id);
CREATE INDEX IF NOT EXISTS ix_data_deletion_log_status
  ON data_deletion_log (status);
CREATE INDEX IF NOT EXISTS ix_data_deletion_log_requested_at
  ON data_deletion_log (requested_at);

-- ============================================================================
-- 6. Create tenant_rate_limits table for configurable limits
-- ============================================================================

CREATE TABLE IF NOT EXISTS tenant_rate_limits (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  workspace_id TEXT NOT NULL REFERENCES organization(id) ON DELETE CASCADE,

  -- Limit category
  category TEXT NOT NULL
    CHECK (category IN ('chat', 'content_generation', 'seo_audit', 'api_call', 'export', 'bulk_operation')),

  -- Limit configuration
  max_requests INTEGER NOT NULL,
  window_seconds INTEGER NOT NULL,

  -- Whether this overrides the default
  is_custom BOOLEAN NOT NULL DEFAULT true,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint per workspace/category
  UNIQUE (workspace_id, category)
);

-- Index for tenant_rate_limits
CREATE INDEX IF NOT EXISTS ix_tenant_rate_limits_workspace
  ON tenant_rate_limits (workspace_id);

-- ============================================================================
-- 7. Add helper functions for tenant context
-- ============================================================================

-- Function to set tenant context (used by application)
CREATE OR REPLACE FUNCTION set_tenant_context(p_workspace_id TEXT, p_user_id TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.workspace_id', p_workspace_id, true);
  PERFORM set_config('app.user_id', p_user_id, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get current workspace ID
CREATE OR REPLACE FUNCTION get_current_workspace_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.workspace_id', true);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- 8. Create triggers for updated_at timestamps
-- ============================================================================

-- Trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to new tables
CREATE TRIGGER tenant_usage_daily_updated_at
  BEFORE UPDATE ON tenant_usage_daily
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tenant_usage_monthly_updated_at
  BEFORE UPDATE ON tenant_usage_monthly
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tenant_rate_limits_updated_at
  BEFORE UPDATE ON tenant_rate_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. Add check constraints for data integrity
-- ============================================================================

-- Ensure client belongs to workspace on insert (advisory, app should enforce)
-- This uses a trigger instead of FK since client_id can be NULL

CREATE OR REPLACE FUNCTION check_client_workspace_match()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.client_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM clients
      WHERE id = NEW.client_id
        AND workspace_id = NEW.workspace_id
        AND soft_deleted_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Client % does not belong to workspace %',
        NEW.client_id, NEW.workspace_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to usage tables
CREATE TRIGGER tenant_usage_daily_check_client
  BEFORE INSERT OR UPDATE ON tenant_usage_daily
  FOR EACH ROW EXECUTE FUNCTION check_client_workspace_match();

CREATE TRIGGER tenant_usage_monthly_check_client
  BEFORE INSERT OR UPDATE ON tenant_usage_monthly
  FOR EACH ROW EXECUTE FUNCTION check_client_workspace_match();

-- ============================================================================
-- 10. Comments for documentation
-- ============================================================================

COMMENT ON TABLE tenant_usage_daily IS
  'Daily usage aggregates per workspace/client for cost tracking';
COMMENT ON TABLE tenant_usage_monthly IS
  'Monthly usage aggregates for billing integration';
COMMENT ON TABLE data_deletion_log IS
  'GDPR Article 17 compliance: audit log of data deletion requests';
COMMENT ON TABLE tenant_rate_limits IS
  'Custom rate limit configurations per workspace';

COMMENT ON FUNCTION set_tenant_context IS
  'Set the current tenant context for RLS policies';
COMMENT ON FUNCTION get_current_workspace_id IS
  'Get the current workspace ID from session context';
