-- Client Preferences Table
-- Phase 86-09: Backfill Pool + Learning
--
-- SEPARATE from proposals table. Preferences persist across proposals
-- and are learned from edit history to improve future proposals.

CREATE TABLE IF NOT EXISTS "client_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "client_id" uuid NOT NULL UNIQUE,
  "exclusions" jsonb NOT NULL DEFAULT '[]',
  "funnel_bias" jsonb NOT NULL DEFAULT '{"bofu":1.0,"mofu":1.0,"tofu":1.0}',
  "positioning" text NOT NULL DEFAULT 'neutral',
  "preferred_topics" text[] NOT NULL DEFAULT '{}',
  "avoided_topics" text[] NOT NULL DEFAULT '{}',
  "last_learned_at" timestamp with time zone DEFAULT now(),
  "edits_since_last_learn" integer NOT NULL DEFAULT 0,
  "confidence_score" real NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "client_preferences_client_id_idx"
  ON "client_preferences" ("client_id");

COMMENT ON TABLE "client_preferences" IS
  'Client-level learned preferences from proposal edits. Separate from proposals - persists across all proposals for this client.';
