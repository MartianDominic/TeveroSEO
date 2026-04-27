-- Migration: Add Row Level Security Policies
-- Phase: Security Hardening
--
-- This migration enables RLS on sensitive tables and creates
-- isolation policies based on user/organization context.
--
-- IMPORTANT: After running this migration, all queries must set
-- the user context via set_user_context() or RLS will block access.

-- ============================================================
-- PART 1: Create user context function
-- ============================================================

-- Function to set current user context for RLS
-- Call this at the start of each request/transaction
CREATE OR REPLACE FUNCTION set_user_context(
  p_user_id text,
  p_org_id text DEFAULT NULL,
  p_is_admin boolean DEFAULT false
)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', COALESCE(p_user_id, ''), true);
  PERFORM set_config('app.current_org_id', COALESCE(p_org_id, ''), true);
  PERFORM set_config('app.is_admin', p_is_admin::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear user context (for cleanup/logout)
CREATE OR REPLACE FUNCTION clear_user_context()
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', '', true);
  PERFORM set_config('app.current_org_id', '', true);
  PERFORM set_config('app.is_admin', 'false', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current user ID safely
CREATE OR REPLACE FUNCTION current_app_user_id()
RETURNS text AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to get current org ID safely
CREATE OR REPLACE FUNCTION current_app_org_id()
RETURNS text AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_org_id', true), '');
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION is_app_admin()
RETURNS boolean AS $$
BEGIN
  RETURN COALESCE(current_setting('app.is_admin', true)::boolean, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================
-- PART 2: Create audit_logs table if not exists
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What changed
  entity_type varchar(100) NOT NULL,
  entity_id varchar(255) NOT NULL,
  action varchar(50) NOT NULL,

  -- Who made the change
  user_id varchar(255),
  user_email varchar(255),
  organization_id varchar(255),
  ip_address varchar(45),
  user_agent text,

  -- Change details
  old_values jsonb,
  new_values jsonb,
  changed_fields jsonb,

  -- Context
  request_id varchar(255),
  metadata jsonb,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for audit_logs
CREATE INDEX IF NOT EXISTS ix_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS ix_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS ix_audit_logs_created ON audit_logs(created_at);

-- ============================================================
-- PART 3: Enable RLS on sensitive tables
-- ============================================================

-- Clients table: Users can only access clients in their organization
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS clients_org_isolation ON clients;
DROP POLICY IF EXISTS clients_insert_policy ON clients;
DROP POLICY IF EXISTS clients_update_policy ON clients;
DROP POLICY IF EXISTS clients_delete_policy ON clients;

-- Read policy: Users can see clients in their workspace (organization)
CREATE POLICY clients_org_isolation ON clients
  FOR SELECT
  USING (
    workspace_id = current_app_org_id()
    OR is_app_admin()
  );

-- Insert policy: Users can create clients in their organization
CREATE POLICY clients_insert_policy ON clients
  FOR INSERT
  WITH CHECK (
    workspace_id = current_app_org_id()
    OR is_app_admin()
  );

-- Update policy: Users can update clients in their organization
CREATE POLICY clients_update_policy ON clients
  FOR UPDATE
  USING (
    workspace_id = current_app_org_id()
    OR is_app_admin()
  );

-- Delete policy: Users can delete clients in their organization
CREATE POLICY clients_delete_policy ON clients
  FOR DELETE
  USING (
    workspace_id = current_app_org_id()
    OR is_app_admin()
  );

-- ============================================================
-- Prospects table: Organization isolation
-- ============================================================

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prospects_org_isolation ON prospects;
DROP POLICY IF EXISTS prospects_insert_policy ON prospects;
DROP POLICY IF EXISTS prospects_update_policy ON prospects;
DROP POLICY IF EXISTS prospects_delete_policy ON prospects;

CREATE POLICY prospects_org_isolation ON prospects
  FOR SELECT
  USING (
    workspace_id = current_app_org_id()
    OR is_app_admin()
  );

CREATE POLICY prospects_insert_policy ON prospects
  FOR INSERT
  WITH CHECK (
    workspace_id = current_app_org_id()
    OR is_app_admin()
  );

CREATE POLICY prospects_update_policy ON prospects
  FOR UPDATE
  USING (
    workspace_id = current_app_org_id()
    OR is_app_admin()
  );

CREATE POLICY prospects_delete_policy ON prospects
  FOR DELETE
  USING (
    workspace_id = current_app_org_id()
    OR is_app_admin()
  );

-- ============================================================
-- Prospect Keywords table: Organization isolation via prospect
-- ============================================================

ALTER TABLE prospect_keywords ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS prospect_keywords_org_isolation ON prospect_keywords;
DROP POLICY IF EXISTS prospect_keywords_insert_policy ON prospect_keywords;
DROP POLICY IF EXISTS prospect_keywords_update_policy ON prospect_keywords;
DROP POLICY IF EXISTS prospect_keywords_delete_policy ON prospect_keywords;

CREATE POLICY prospect_keywords_org_isolation ON prospect_keywords
  FOR SELECT
  USING (
    prospect_id IN (
      SELECT id FROM prospects
      WHERE workspace_id = current_app_org_id()
    )
    OR is_app_admin()
  );

CREATE POLICY prospect_keywords_insert_policy ON prospect_keywords
  FOR INSERT
  WITH CHECK (
    prospect_id IN (
      SELECT id FROM prospects
      WHERE workspace_id = current_app_org_id()
    )
    OR is_app_admin()
  );

CREATE POLICY prospect_keywords_update_policy ON prospect_keywords
  FOR UPDATE
  USING (
    prospect_id IN (
      SELECT id FROM prospects
      WHERE workspace_id = current_app_org_id()
    )
    OR is_app_admin()
  );

CREATE POLICY prospect_keywords_delete_policy ON prospect_keywords
  FOR DELETE
  USING (
    prospect_id IN (
      SELECT id FROM prospects
      WHERE workspace_id = current_app_org_id()
    )
    OR is_app_admin()
  );

-- ============================================================
-- API Keys table: Organization isolation
-- ============================================================

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_keys_org_isolation ON api_keys;
DROP POLICY IF EXISTS api_keys_insert_policy ON api_keys;
DROP POLICY IF EXISTS api_keys_update_policy ON api_keys;
DROP POLICY IF EXISTS api_keys_delete_policy ON api_keys;

-- Users can only see API keys for their organization
CREATE POLICY api_keys_org_isolation ON api_keys
  FOR SELECT
  USING (
    organization_id = current_app_org_id()
    OR is_app_admin()
  );

CREATE POLICY api_keys_insert_policy ON api_keys
  FOR INSERT
  WITH CHECK (
    organization_id = current_app_org_id()
    OR is_app_admin()
  );

CREATE POLICY api_keys_update_policy ON api_keys
  FOR UPDATE
  USING (
    organization_id = current_app_org_id()
    OR is_app_admin()
  );

CREATE POLICY api_keys_delete_policy ON api_keys
  FOR DELETE
  USING (
    organization_id = current_app_org_id()
    OR is_app_admin()
  );

-- ============================================================
-- Audit Logs table: Admin only
-- ============================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_admin_only ON audit_logs;
DROP POLICY IF EXISTS audit_logs_insert_all ON audit_logs;

-- Only admins can read audit logs
CREATE POLICY audit_logs_admin_only ON audit_logs
  FOR SELECT
  USING (is_app_admin());

-- Allow insert from any authenticated context (for logging)
-- The audit system needs to write regardless of user permissions
CREATE POLICY audit_logs_insert_all ON audit_logs
  FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- Members table: Organization members only see their org
-- ============================================================

ALTER TABLE member ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS member_org_isolation ON member;
DROP POLICY IF EXISTS member_insert_policy ON member;
DROP POLICY IF EXISTS member_update_policy ON member;
DROP POLICY IF EXISTS member_delete_policy ON member;

CREATE POLICY member_org_isolation ON member
  FOR SELECT
  USING (
    organization_id = current_app_org_id()
    OR user_id = current_app_user_id()
    OR is_app_admin()
  );

CREATE POLICY member_insert_policy ON member
  FOR INSERT
  WITH CHECK (
    organization_id = current_app_org_id()
    OR is_app_admin()
  );

CREATE POLICY member_update_policy ON member
  FOR UPDATE
  USING (
    organization_id = current_app_org_id()
    OR is_app_admin()
  );

CREATE POLICY member_delete_policy ON member
  FOR DELETE
  USING (
    organization_id = current_app_org_id()
    OR is_app_admin()
  );

-- ============================================================
-- Invitations table: Organization isolation
-- ============================================================

ALTER TABLE invitation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invitation_org_isolation ON invitation;
DROP POLICY IF EXISTS invitation_insert_policy ON invitation;
DROP POLICY IF EXISTS invitation_update_policy ON invitation;
DROP POLICY IF EXISTS invitation_delete_policy ON invitation;

CREATE POLICY invitation_org_isolation ON invitation
  FOR SELECT
  USING (
    organization_id = current_app_org_id()
    OR is_app_admin()
  );

CREATE POLICY invitation_insert_policy ON invitation
  FOR INSERT
  WITH CHECK (
    organization_id = current_app_org_id()
    OR is_app_admin()
  );

CREATE POLICY invitation_update_policy ON invitation
  FOR UPDATE
  USING (
    organization_id = current_app_org_id()
    OR is_app_admin()
  );

CREATE POLICY invitation_delete_policy ON invitation
  FOR DELETE
  USING (
    organization_id = current_app_org_id()
    OR is_app_admin()
  );

-- ============================================================
-- PART 4: Grant execution permissions
-- ============================================================

-- Allow the application role to execute context functions
-- Replace 'app_user' with your actual application database role
-- GRANT EXECUTE ON FUNCTION set_user_context TO app_user;
-- GRANT EXECUTE ON FUNCTION clear_user_context TO app_user;
-- GRANT EXECUTE ON FUNCTION current_app_user_id TO app_user;
-- GRANT EXECUTE ON FUNCTION current_app_org_id TO app_user;
-- GRANT EXECUTE ON FUNCTION is_app_admin TO app_user;

-- ============================================================
-- PART 5: Comment documentation
-- ============================================================

COMMENT ON FUNCTION set_user_context IS 'Sets the current user context for RLS policies. Call at the start of each request.';
COMMENT ON FUNCTION clear_user_context IS 'Clears the user context. Call on logout or session end.';
COMMENT ON FUNCTION current_app_user_id IS 'Returns the current user ID from session context.';
COMMENT ON FUNCTION current_app_org_id IS 'Returns the current organization ID from session context.';
COMMENT ON FUNCTION is_app_admin IS 'Returns true if the current user is an admin.';

COMMENT ON TABLE audit_logs IS 'Immutable audit trail for all sensitive data mutations.';
COMMENT ON POLICY clients_org_isolation ON clients IS 'Users can only access clients in their organization.';
COMMENT ON POLICY prospects_org_isolation ON prospects IS 'Users can only access prospects in their organization.';
COMMENT ON POLICY api_keys_org_isolation ON api_keys IS 'Users can only access API keys for their organization.';
COMMENT ON POLICY audit_logs_admin_only ON audit_logs IS 'Only admins can read audit logs.';
