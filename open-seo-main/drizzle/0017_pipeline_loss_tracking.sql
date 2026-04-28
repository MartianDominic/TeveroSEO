-- Phase 30-08: Pipeline & Automation - Loss Tracking
-- Adds declined_reason and declined_notes to proposals table for loss analysis

-- Add loss tracking columns to proposals
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "declined_reason" text;
ALTER TABLE "proposals" ADD COLUMN IF NOT EXISTS "declined_notes" text;

-- Add index for analytics queries on declined proposals
CREATE INDEX IF NOT EXISTS "ix_proposals_declined_reason" ON "proposals" ("declined_reason") WHERE "status" = 'declined';
