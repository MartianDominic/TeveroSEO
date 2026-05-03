-- Migration: Add composite indexes for common query patterns
-- PERF FIX (MEDIUM-01): Improves query performance for dashboard and filtering operations
--
-- These indexes optimize:
-- 1. Client listing with status filters
-- 2. Alert queries by client and type
-- 3. Goal queries by client and attainment level
-- 4. Audit finding queries by severity

-- ============================================================================
-- Alerts Table Indexes
-- ============================================================================

-- Index for filtering alerts by client and status (common dashboard query)
CREATE INDEX IF NOT EXISTS idx_alerts_client_status
ON alerts (client_id, status);

-- Index for filtering alerts by client and alert type
CREATE INDEX IF NOT EXISTS idx_alerts_client_type
ON alerts (client_id, alert_type);

-- Index for filtering alerts by client and severity (critical alerts dashboard)
CREATE INDEX IF NOT EXISTS idx_alerts_client_severity
ON alerts (client_id, severity);

-- Composite index for dashboard alert counts with date range
CREATE INDEX IF NOT EXISTS idx_alerts_client_status_created
ON alerts (client_id, status, created_at DESC);

-- ============================================================================
-- Goals Table Indexes
-- ============================================================================

-- Index for client goals with attainment filtering
CREATE INDEX IF NOT EXISTS idx_goals_client_attainment
ON client_goals (client_id, attainment_pct);

-- Index for active goals by client (status filter)
CREATE INDEX IF NOT EXISTS idx_goals_client_status
ON client_goals (client_id, status);

-- ============================================================================
-- Audit Findings Indexes
-- ============================================================================

-- Index for filtering findings by audit and severity
CREATE INDEX IF NOT EXISTS idx_audit_findings_audit_severity
ON audit_findings (audit_id, severity);

-- Index for filtering findings by audit and category
CREATE INDEX IF NOT EXISTS idx_audit_findings_audit_category
ON audit_findings (audit_id, category);

-- Composite index for paginated findings with filters
CREATE INDEX IF NOT EXISTS idx_audit_findings_audit_severity_id
ON audit_findings (audit_id, severity, id);

-- ============================================================================
-- Clients Table Indexes
-- ============================================================================

-- Index for workspace client queries with archive filter
CREATE INDEX IF NOT EXISTS idx_clients_workspace_archived
ON clients (workspace_id, is_archived);

-- Index for client priority scoring (dashboard sort)
CREATE INDEX IF NOT EXISTS idx_clients_workspace_priority
ON clients (workspace_id, priority_score DESC);

-- ============================================================================
-- GSC Snapshots Indexes (for dashboard metrics)
-- ============================================================================

-- Index for time-range queries on GSC data by client
CREATE INDEX IF NOT EXISTS idx_gsc_snapshots_client_date
ON gsc_snapshots (client_id, date DESC);

-- Index for GSC query snapshots by client and date
CREATE INDEX IF NOT EXISTS idx_gsc_query_snapshots_client_date
ON gsc_query_snapshots (client_id, date DESC);

-- ============================================================================
-- Verification: Log index creation
-- ============================================================================

-- Note: Run ANALYZE after creating indexes to update statistics
-- ANALYZE alerts;
-- ANALYZE client_goals;
-- ANALYZE audit_findings;
-- ANALYZE clients;
-- ANALYZE gsc_snapshots;
-- ANALYZE gsc_query_snapshots;
