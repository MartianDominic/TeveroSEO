-- Migration: 0038_soft_delete_clients.sql
-- Purpose: Add soft delete support to clients and organizations tables
-- Date: 2026-04-29
--
-- This migration implements soft delete to prevent catastrophic cascade deletes.
-- Instead of physically deleting records, we mark them as deleted/archived.
-- This allows for recovery and maintains referential integrity.

-- ============================================================================
-- CLIENTS TABLE: Add soft delete columns
-- ============================================================================

-- Add is_deleted column with default false
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE NOT NULL;

-- Add deleted_at timestamp for tracking when deletion occurred
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create partial index for active clients (most common query pattern)
-- This index speeds up queries that filter out deleted clients
CREATE INDEX IF NOT EXISTS ix_clients_is_deleted
ON clients(workspace_id, is_deleted)
WHERE is_deleted = FALSE;

-- ============================================================================
-- ORGANIZATION TABLE: Add archive columns
-- ============================================================================

-- Add is_archived column with default false
ALTER TABLE organization
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE NOT NULL;

-- Add archived_at timestamp for tracking when archival occurred
ALTER TABLE organization
ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

-- Create index for active organizations
CREATE INDEX IF NOT EXISTS ix_organization_is_archived
ON organization(is_archived)
WHERE is_archived = FALSE;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN clients.is_deleted IS
  'Soft delete flag. When true, client is considered deleted but data is preserved for recovery.';

COMMENT ON COLUMN clients.deleted_at IS
  'Timestamp when the client was soft-deleted. NULL if client is active.';

COMMENT ON COLUMN organization.is_archived IS
  'Archive flag. When true, organization is archived but all data is preserved.';

COMMENT ON COLUMN organization.archived_at IS
  'Timestamp when the organization was archived. NULL if organization is active.';
