-- Phase 72-03: Audit Logs for security and compliance
-- 90-day retention policy enforced by cleanup job

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "user_id" text,
  "action" text NOT NULL,
  "resource_type" text NOT NULL,
  "resource_id" text,
  "previous_value" jsonb,
  "new_value" jsonb,
  "metadata" jsonb DEFAULT '{}'::jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS "ix_audit_workspace_created" ON "audit_logs" ("workspace_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "ix_audit_user" ON "audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "ix_audit_action" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "ix_audit_resource" ON "audit_logs" ("resource_type", "resource_id");
CREATE INDEX IF NOT EXISTS "ix_audit_created" ON "audit_logs" ("created_at");
