-- Phase 68-03: API Contract Alignment
-- Add version column for optimistic locking on webhooks table

ALTER TABLE webhooks
ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN webhooks.version IS 'Optimistic locking version - incremented on each update';
