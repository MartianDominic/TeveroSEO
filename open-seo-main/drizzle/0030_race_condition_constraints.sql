-- Migration: Add unique constraints to prevent race condition duplicates
-- Issue: Check-then-act patterns in services allow duplicate records under concurrent requests

-- 1. Projects: Prevent duplicate "Default" projects per organization
-- Used by: getOrCreateDefaultProject() in ProjectRepository.ts
CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_org_name
ON projects(organization_id, name);

-- Note: The following constraints already exist in their respective schema files:
-- - alertRules: uq_alert_rules_client_type on (client_id, alert_type) - defined in alert-schema.ts
-- - prospects: ix_prospects_workspace_domain on (workspace_id, domain) - defined in prospect-schema.ts

-- 2. clientGoals: Consider adding a partial unique index for isPrimary constraint
-- This would enforce at the database level that only one goal per client can be isPrimary=true
-- However, this requires PostgreSQL 11+ and careful consideration of existing data
-- Uncomment if you want database-level enforcement:
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_client_goals_primary
-- ON client_goals(client_id) WHERE is_primary = true;
