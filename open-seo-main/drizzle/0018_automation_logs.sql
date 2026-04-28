-- Phase 30-08: Pipeline & Automation - Execution Log Persistence
-- Creates automation_logs table to track executed automations and prevent duplicates

-- Create automation_logs table
CREATE TABLE IF NOT EXISTS "automation_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "proposal_id" text NOT NULL REFERENCES "proposals"("id") ON DELETE CASCADE,
  "rule_id" text NOT NULL,
  "action_type" text NOT NULL,
  "executed_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS "ix_automation_logs_proposal" ON "automation_logs" ("proposal_id");
CREATE INDEX IF NOT EXISTS "ix_automation_logs_proposal_rule" ON "automation_logs" ("proposal_id", "rule_id");
