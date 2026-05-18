-- Migration: 0105_indexes_and_triggers.sql
-- Phase 101: Performance indexes and updated_at triggers
--
-- Adds:
-- 1. Index on client_credits.expires_at for expiration queries (M-DB-02)
-- 2. Partial index on content_blocks for soft-delete filtering (M-DB-03)
-- 3. updated_at triggers for payments, content_blocks, documents (M-DB-04)
--
-- All statements are idempotent (IF NOT EXISTS / DROP IF EXISTS patterns)

-- ============================================================================
-- 1. Index on client_credits.expires_at (M-DB-02)
-- ============================================================================
-- ClientCreditRepository.findAvailableByClientId filters by expiresAt
-- Without an index, expiration queries scan the full table

CREATE INDEX IF NOT EXISTS "ix_credits_expires"
  ON "client_credits"("expires_at");

-- ============================================================================
-- 2. Partial index on content_blocks for active records (M-DB-03)
-- ============================================================================
-- All queries filter by soft_deleted_at IS NULL
-- A partial index improves performance for workspace-scoped queries

CREATE INDEX IF NOT EXISTS "ix_content_blocks_active"
  ON "content_blocks"("workspace_id")
  WHERE soft_deleted_at IS NULL;

-- ============================================================================
-- 3. updated_at triggers for new Phase 101 tables (M-DB-04)
-- ============================================================================
-- The payments, content_blocks, and documents tables have updated_at columns
-- but no database triggers to auto-update them. Drizzle's $onUpdate is
-- application-level only.

-- Ensure the trigger function exists (idempotent)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- 3a. Trigger for payments table
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3b. Trigger for content_blocks table
DROP TRIGGER IF EXISTS update_content_blocks_updated_at ON content_blocks;
CREATE TRIGGER update_content_blocks_updated_at
  BEFORE UPDATE ON content_blocks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 3c. Trigger for documents table
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Documentation
-- ============================================================================

COMMENT ON INDEX "ix_credits_expires" IS
  'Performance index for credit expiration queries (M-DB-02)';

COMMENT ON INDEX "ix_content_blocks_active" IS
  'Partial index for active content blocks - filters soft-deleted rows (M-DB-03)';
