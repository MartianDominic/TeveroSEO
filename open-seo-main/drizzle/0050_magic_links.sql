-- Migration: 0050_magic_links
-- Phase 49-51: Onboarding & Agency Dashboard
-- Creates magic_links table for secure client onboarding invitations

-- Create magic_links table
CREATE TABLE IF NOT EXISTS "magic_links" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
  "checklist_id" text NOT NULL REFERENCES "onboarding_checklists"("id") ON DELETE CASCADE,
  "item_id" text NOT NULL,
  "token" text NOT NULL UNIQUE,
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for fast token lookups during validation
CREATE UNIQUE INDEX IF NOT EXISTS "ix_magic_links_token" ON "magic_links" ("token");

-- Index for cleanup queries on expired tokens
CREATE INDEX IF NOT EXISTS "ix_magic_links_expires" ON "magic_links" ("expires_at");

-- Index for workspace-scoped queries
CREATE INDEX IF NOT EXISTS "ix_magic_links_workspace" ON "magic_links" ("workspace_id");

-- Comment for documentation
COMMENT ON TABLE "magic_links" IS 'Secure invitation tokens for white-label client onboarding credential completion';
COMMENT ON COLUMN "magic_links"."token" IS '32-char nanoid with 128 bits entropy';
COMMENT ON COLUMN "magic_links"."expires_at" IS '24-hour expiry from creation';
COMMENT ON COLUMN "magic_links"."used_at" IS 'Set when token is consumed, null if unused';
