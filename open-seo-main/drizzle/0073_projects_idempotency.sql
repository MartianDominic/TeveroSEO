-- Migration: 0073_projects_idempotency.sql
-- FIX-16: H-ONBOARD-01 - Add idempotency key to projects table
--
-- This migration adds an idempotency_key column to the projects table
-- to prevent duplicate project creation when users retry after network errors.
-- The key is a composite of client_id + normalized_domain + time_window.

-- Add idempotency_key column to projects table
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Create unique index on organization_id + idempotency_key for fast lookups
-- Partial index excludes NULL keys (legacy projects without idempotency)
CREATE UNIQUE INDEX IF NOT EXISTS uq_projects_org_idempotency
ON projects (organization_id, idempotency_key)
WHERE idempotency_key IS NOT NULL AND is_deleted = false;

-- Add index for efficient idempotency lookups
CREATE INDEX IF NOT EXISTS idx_projects_idempotency_key
ON projects (idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN projects.idempotency_key IS
  'H-ONBOARD-01: Idempotency key to prevent duplicate project creation on retry. Format: seo-project:{client_id}:{normalized_domain}:{5min_window}';
