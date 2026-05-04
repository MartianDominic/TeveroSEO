-- Migration: Fix generatedAgreements.clientId type from TEXT to UUID
-- Phase: FIX-04 Database Schema Integrity
-- Issue: CRIT-DB-01 - generatedAgreements.clientId was TEXT but clients.id is UUID
--
-- This migration aligns the client_id column type with the clients table
-- which was converted to UUID in migration 0034_client_id_to_uuid.sql
-- Transaction wrapper added for atomic execution (FIX-13: HIGH-02-01)

BEGIN;

-- Step 1: Drop the existing foreign key constraint if it exists
ALTER TABLE IF EXISTS generated_agreements
  DROP CONSTRAINT IF EXISTS generated_agreements_client_id_clients_id_fk;

-- Step 2: Convert client_id from TEXT to UUID
-- Uses ::uuid cast which works for valid UUID string formats
-- NULL values remain NULL
ALTER TABLE IF EXISTS generated_agreements
  ALTER COLUMN client_id TYPE uuid USING client_id::uuid;

-- Step 3: Re-add the foreign key constraint with proper onDelete behavior
ALTER TABLE IF EXISTS generated_agreements
  ADD CONSTRAINT generated_agreements_client_id_clients_id_fk
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

-- Rollback instructions:
-- ALTER TABLE generated_agreements DROP CONSTRAINT IF EXISTS generated_agreements_client_id_clients_id_fk;
-- ALTER TABLE generated_agreements ALTER COLUMN client_id TYPE text USING client_id::text;
-- ALTER TABLE generated_agreements ADD CONSTRAINT generated_agreements_client_id_clients_id_fk
--   FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL;

COMMIT;
