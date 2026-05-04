-- Phase 61-01: Platform Integration - OAuth Platform Connections
-- Creates tables for OAuth platform connections, state management, and data cache
-- Transaction wrapper added for atomic execution (FIX-13: HIGH-02-01)

BEGIN;

-- Create platform_connections table for OAuth tokens and credentials
CREATE TABLE IF NOT EXISTS "platform_connections" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "prospect_id" text REFERENCES "prospects"("id") ON DELETE SET NULL,

  -- Platform identification
  "platform" text NOT NULL,
  "platform_account_id" text,
  "platform_account_name" text,
  "platform_site_url" text,

  -- OAuth tokens (AES-256-GCM encrypted)
  "access_token_encrypted" text,
  "refresh_token_encrypted" text,
  "token_expires_at" timestamp with time zone,
  "token_type" text DEFAULT 'Bearer',

  -- Non-OAuth credentials (for WordPress app passwords, API keys)
  "credential_type" text,
  "credentials_encrypted" text,

  -- Connection status
  "status" text NOT NULL DEFAULT 'pending',

  -- Sync tracking
  "last_sync_at" timestamp with time zone,
  "last_sync_status" text,
  "last_error" text,
  "sync_schedule" text DEFAULT 'daily',

  -- Scopes (JSONB arrays)
  "scopes_requested" jsonb,
  "scopes_granted" jsonb,

  -- Audit trail
  "connected_at" timestamp with time zone,
  "connected_by" text,
  "revoked_at" timestamp with time zone,
  "revoked_by" text,

  -- Standard timestamps
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT "chk_platform_valid" CHECK (platform IN (
    'google_search_console', 'google_analytics', 'google_business_profile',
    'wordpress_com', 'wordpress_org', 'shopify', 'wix', 'squarespace',
    'webflow', 'hubspot', 'bigcommerce', 'magento', 'drupal', 'ghost', 'bing_webmaster'
  )),
  CONSTRAINT "chk_status_valid" CHECK (status IN (
    'pending', 'connecting', 'active', 'expired', 'revoked', 'error'
  )),
  CONSTRAINT "chk_credential_type_valid" CHECK (credential_type IS NULL OR credential_type IN (
    'oauth', 'app_password', 'api_key'
  )),
  CONSTRAINT "chk_sync_schedule_valid" CHECK (sync_schedule IS NULL OR sync_schedule IN (
    'hourly', 'daily', 'weekly', 'manual'
  ))
);

-- Indexes for platform_connections
CREATE INDEX IF NOT EXISTS "idx_platform_connections_workspace_prospect"
  ON "platform_connections" ("workspace_id", "prospect_id");
CREATE INDEX IF NOT EXISTS "idx_platform_connections_status"
  ON "platform_connections" ("status");
CREATE INDEX IF NOT EXISTS "idx_platform_connections_expiry"
  ON "platform_connections" ("token_expires_at");

-- Create oauth_states table for CSRF protection
CREATE TABLE IF NOT EXISTS "oauth_states" (
  "id" text PRIMARY KEY NOT NULL,
  "state" text NOT NULL UNIQUE,

  -- OAuth flow context
  "platform" text NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
  "prospect_id" text REFERENCES "prospects"("id") ON DELETE SET NULL,
  "user_id" text NOT NULL,

  -- OAuth configuration
  "redirect_uri" text NOT NULL,
  "scopes" jsonb NOT NULL,

  -- Expiry (10-minute window) and usage tracking
  "expires_at" timestamp with time zone NOT NULL,
  "used_at" timestamp with time zone,

  -- Standard timestamp
  "created_at" timestamp with time zone DEFAULT now()
);

-- Index for state lookups
CREATE UNIQUE INDEX IF NOT EXISTS "idx_oauth_states_state" ON "oauth_states" ("state");

-- Create platform_data_cache table for synced platform data
CREATE TABLE IF NOT EXISTS "platform_data_cache" (
  "id" text PRIMARY KEY NOT NULL,
  "connection_id" text NOT NULL REFERENCES "platform_connections"("id") ON DELETE CASCADE,

  -- Data type and range
  "data_type" text NOT NULL,
  "date_range" text,

  -- Cached data
  "data" jsonb NOT NULL,

  -- Cache metadata
  "fetched_at" timestamp with time zone NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,

  -- Standard timestamp
  "created_at" timestamp with time zone DEFAULT now()
);

-- Indexes for platform_data_cache
CREATE INDEX IF NOT EXISTS "idx_platform_data_cache_connection"
  ON "platform_data_cache" ("connection_id");
CREATE INDEX IF NOT EXISTS "idx_platform_data_cache_type"
  ON "platform_data_cache" ("data_type");
CREATE INDEX IF NOT EXISTS "idx_platform_data_cache_expiry"
  ON "platform_data_cache" ("expires_at");

-- Comment the tables
COMMENT ON TABLE "platform_connections" IS 'OAuth platform connections with encrypted tokens (Phase 61)';
COMMENT ON TABLE "oauth_states" IS 'OAuth CSRF state parameters with 10-minute expiry (Phase 61)';
COMMENT ON TABLE "platform_data_cache" IS 'Cached data from connected platforms (Phase 61)';

COMMIT;
