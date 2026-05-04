-- Migration: 0064_invoice_optimistic_locking.sql
-- H-CONC-01: Add optimistic locking version column to invoices
-- Prevents race conditions in concurrent webhook callbacks

-- Add version column with default 1 for existing rows
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Create index for version lookups (useful for conflict detection queries)
CREATE INDEX IF NOT EXISTS ix_invoices_version ON invoices (id, version);

-- Add version column to audits table for H-CONC-02
ALTER TABLE audits
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Create index for audit version lookups
CREATE INDEX IF NOT EXISTS ix_audits_version ON audits (id, version);

COMMENT ON COLUMN invoices.version IS 'Optimistic locking version - increment on each update, reject if stale';
COMMENT ON COLUMN audits.version IS 'Optimistic locking version for concurrent phase updates';
