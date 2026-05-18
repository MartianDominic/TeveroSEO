-- Phase 101: Document Schema Fixes
-- Migration: 0104_document_schema_fixes.sql
--
-- Fixes:
-- - C-02: Change documents.client_id from TEXT to UUID to match clients.id
-- - H-14: Add missing index on documents.prospect_id

-- ============================================================================
-- C-02: Fix client_id type mismatch (TEXT -> UUID)
-- ============================================================================

-- Step 1: Drop the existing FK constraint
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_client_id_clients_id_fk";
ALTER TABLE "documents" DROP CONSTRAINT IF EXISTS "documents_client_id_fkey";

-- Step 2: Change column type from TEXT to UUID
-- Note: Any existing data must be valid UUID format for this to succeed
ALTER TABLE "documents"
  ALTER COLUMN "client_id" TYPE UUID USING client_id::uuid;

-- Step 3: Re-add FK constraint with correct name
ALTER TABLE "documents"
  ADD CONSTRAINT "documents_client_id_clients_id_fk"
  FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL;

-- ============================================================================
-- H-14: Add missing index on prospect_id
-- ============================================================================

CREATE INDEX IF NOT EXISTS "ix_documents_prospect" ON "documents"("prospect_id");

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN "documents"."client_id" IS 'UUID FK to clients.id - fixed from TEXT in migration 0104';
