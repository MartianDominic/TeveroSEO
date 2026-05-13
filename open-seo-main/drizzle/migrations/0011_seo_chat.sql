-- Migration: Add SEO Chat tables
-- Phase 98-01: Foundation (Types, Stores, Schema)
-- Created: 2026-05-13

-- SEO Chat Sessions table
CREATE TABLE IF NOT EXISTS "seo_chat_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL,
  "prospect_domain" text,
  "prospect_name" text,
  "prospect_email" text,
  "title" text,
  "status" text DEFAULT 'active' NOT NULL,
  "metadata" jsonb DEFAULT '{}',
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "seo_chat_sessions_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "organization"("id") ON DELETE cascade
);

-- SEO Chat Messages table
CREATE TABLE IF NOT EXISTS "seo_chat_messages" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "role" text NOT NULL,
  "content" text NOT NULL,
  "intent" text,
  "extracted_context" jsonb DEFAULT '{}',
  "tool_calls" jsonb DEFAULT '[]',
  "token_count" integer,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "seo_chat_messages_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "seo_chat_sessions"("id") ON DELETE cascade
);

-- SEO Chat Analyses table (analysis result cache)
CREATE TABLE IF NOT EXISTS "seo_chat_analyses" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL,
  "analysis_type" text NOT NULL,
  "input_hash" text NOT NULL,
  "result" jsonb NOT NULL,
  "cost_micros" integer DEFAULT 0,
  "duration_ms" integer,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "seo_chat_analyses_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "seo_chat_sessions"("id") ON DELETE cascade
);

-- Indexes for seo_chat_sessions
CREATE INDEX IF NOT EXISTS "idx_seo_chat_sessions_workspace" ON "seo_chat_sessions" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_seo_chat_sessions_domain" ON "seo_chat_sessions" ("prospect_domain");
CREATE INDEX IF NOT EXISTS "idx_seo_chat_sessions_status" ON "seo_chat_sessions" ("status");

-- Indexes for seo_chat_messages
CREATE INDEX IF NOT EXISTS "idx_seo_chat_messages_session" ON "seo_chat_messages" ("session_id");
CREATE INDEX IF NOT EXISTS "idx_seo_chat_messages_created" ON "seo_chat_messages" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_seo_chat_messages_role" ON "seo_chat_messages" ("role");

-- Unique index for seo_chat_analyses cache lookup
CREATE UNIQUE INDEX IF NOT EXISTS "idx_seo_chat_analyses_cache" ON "seo_chat_analyses" ("session_id", "analysis_type", "input_hash");
