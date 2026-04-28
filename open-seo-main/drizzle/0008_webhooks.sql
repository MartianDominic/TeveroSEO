-- Phase 18.5: Webhook infrastructure tables
-- Migration 0008: webhooks, webhook_deliveries, webhook_events

-- Create webhook scope enum
DO $$ BEGIN
  CREATE TYPE webhook_scope AS ENUM ('global', 'workspace', 'client');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope webhook_scope NOT NULL,
  scope_id TEXT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  headers JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhooks_scope_scope_id_idx ON webhooks (scope, scope_id);
CREATE INDEX IF NOT EXISTS webhooks_enabled_idx ON webhooks (enabled);

-- Webhook deliveries table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  last_response_status INTEGER,
  last_response_body TEXT,
  last_error TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_id_idx ON webhook_deliveries (webhook_id);
CREATE INDEX IF NOT EXISTS webhook_deliveries_status_idx ON webhook_deliveries (status);
CREATE INDEX IF NOT EXISTS webhook_deliveries_event_id_idx ON webhook_deliveries (event_id);
CREATE INDEX IF NOT EXISTS webhook_deliveries_created_at_idx ON webhook_deliveries (created_at);

-- Webhook events registry table
CREATE TABLE IF NOT EXISTS webhook_events (
  type TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  tier INTEGER NOT NULL DEFAULT 1,
  description TEXT NOT NULL,
  sample_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
