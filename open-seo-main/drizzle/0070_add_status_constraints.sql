-- Migration: 0070_add_status_constraints.sql
-- Date: 2026-05-03
-- Phase: 69-02 Cascade & Constraints
-- Purpose: Add status CHECK constraints and create PostgreSQL enums for type safety
--
-- This migration:
--   1. Creates PostgreSQL ENUMs for common status fields
--   2. Adds CHECK constraints to tables that use inline text status
--   3. Provides database-level validation for status values
--
-- Note: Some tables already have CHECK constraints via Drizzle schema definitions.
--       This migration focuses on database-level enforcement and missing constraints.

BEGIN;

-- ============================================================================
-- 1. Create PostgreSQL ENUMs for status fields
-- Using DO $$ blocks to handle "already exists" gracefully
-- ============================================================================

-- Audit status enum (matches app.schema.ts auditStatusEnum)
DO $$ BEGIN
  CREATE TYPE audit_status AS ENUM (
    'pending', 'running', 'completed', 'failed', 'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Type audit_status already exists, skipping.';
END $$;

-- Brief status enum (matches brief-schema.ts BRIEF_STATUSES)
DO $$ BEGIN
  CREATE TYPE brief_status AS ENUM (
    'draft', 'ready', 'generating', 'published'
  );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Type brief_status already exists, skipping.';
END $$;

-- Connection status enum (matches connection-schema.ts CONNECTION_STATUS)
DO $$ BEGIN
  CREATE TYPE connection_status AS ENUM (
    'pending', 'active', 'error', 'disconnected'
  );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Type connection_status already exists, skipping.';
END $$;

-- Proposal status enum (matches proposal-schema.ts PROPOSAL_STATUS)
DO $$ BEGIN
  CREATE TYPE proposal_status AS ENUM (
    'draft', 'sent', 'viewed', 'accepted', 'signed', 'paid', 'onboarded', 'expired', 'declined'
  );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Type proposal_status already exists, skipping.';
END $$;

-- Workflow instance status enum (matches schema/workflow-instances.ts)
DO $$ BEGIN
  CREATE TYPE workflow_instance_status AS ENUM (
    'pending', 'running', 'paused', 'completed', 'failed', 'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN
    RAISE NOTICE 'Type workflow_instance_status already exists, skipping.';
END $$;


-- ============================================================================
-- 2. Add CHECK constraints to tables missing them
-- Using conditional DDL to avoid errors if constraint already exists
-- ============================================================================

-- audits.status CHECK constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_audit_status_valid'
  ) THEN
    ALTER TABLE audits
      ADD CONSTRAINT chk_audit_status_valid
      CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));
    RAISE NOTICE 'Added CHECK constraint chk_audit_status_valid to audits.';
  ELSE
    RAISE NOTICE 'Constraint chk_audit_status_valid already exists, skipping.';
  END IF;
END $$;

-- site_connections.status CHECK constraint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_site_connection_status_valid'
  ) THEN
    ALTER TABLE site_connections
      ADD CONSTRAINT chk_site_connection_status_valid
      CHECK (status IN ('pending', 'active', 'error', 'disconnected'));
    RAISE NOTICE 'Added CHECK constraint chk_site_connection_status_valid to site_connections.';
  ELSE
    RAISE NOTICE 'Constraint chk_site_connection_status_valid already exists, skipping.';
  END IF;
END $$;

-- workflow_instances.status CHECK constraint (if table exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_instances') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'chk_workflow_instance_status_valid'
    ) THEN
      ALTER TABLE workflow_instances
        ADD CONSTRAINT chk_workflow_instance_status_valid
        CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled'));
      RAISE NOTICE 'Added CHECK constraint chk_workflow_instance_status_valid to workflow_instances.';
    ELSE
      RAISE NOTICE 'Constraint chk_workflow_instance_status_valid already exists, skipping.';
    END IF;
  ELSE
    RAISE NOTICE 'Table workflow_instances does not exist, skipping.';
  END IF;
END $$;

-- proposals.status CHECK constraint (if not already present)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_proposal_status_valid'
  ) THEN
    ALTER TABLE proposals
      ADD CONSTRAINT chk_proposal_status_valid
      CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'signed', 'paid', 'onboarded', 'expired', 'declined'));
    RAISE NOTICE 'Added CHECK constraint chk_proposal_status_valid to proposals.';
  ELSE
    RAISE NOTICE 'Constraint chk_proposal_status_valid already exists, skipping.';
  END IF;
END $$;

-- report_schedules.enabled is BOOLEAN so no CHECK needed
-- (boolean type is self-validating)


-- ============================================================================
-- 3. Document status constraint pattern
-- ============================================================================

COMMENT ON TYPE audit_status IS
  'Valid status values for audits table. '
  'pending -> running -> completed|failed|cancelled';

COMMENT ON TYPE brief_status IS
  'Valid status values for content_briefs table. '
  'draft -> ready -> generating -> published';

COMMENT ON TYPE connection_status IS
  'Valid status values for site_connections table. '
  'pending -> active|error|disconnected';


COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (run manually if needed)
-- ============================================================================
-- BEGIN;
-- ALTER TABLE proposals DROP CONSTRAINT IF EXISTS chk_proposal_status_valid;
-- ALTER TABLE workflow_instances DROP CONSTRAINT IF EXISTS chk_workflow_instance_status_valid;
-- ALTER TABLE site_connections DROP CONSTRAINT IF EXISTS chk_site_connection_status_valid;
-- ALTER TABLE audits DROP CONSTRAINT IF EXISTS chk_audit_status_valid;
-- DROP TYPE IF EXISTS workflow_instance_status;
-- DROP TYPE IF EXISTS proposal_status;
-- DROP TYPE IF EXISTS connection_status;
-- DROP TYPE IF EXISTS brief_status;
-- DROP TYPE IF EXISTS audit_status;
-- COMMIT;
