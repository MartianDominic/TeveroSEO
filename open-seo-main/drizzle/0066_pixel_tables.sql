-- Phase 66-01: Platform Unification - TeveroPixel Tables
-- Creates tables for pixel installations, DOM changes, analytics, and developer handoffs

-- Create pixel_installations table for tracking script deployments
CREATE TABLE IF NOT EXISTS "pixel_installations" (
  "id" text PRIMARY KEY NOT NULL,
  "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,

  -- Unique site identifier (used in data-site attribute)
  "site_id" text NOT NULL UNIQUE,
  -- Domain this pixel is installed on
  "domain" text NOT NULL,

  -- Installation status
  "status" text NOT NULL DEFAULT 'pending',

  -- Detection tracking
  "first_ping_at" timestamp with time zone,
  "last_ping_at" timestamp with time zone,
  "ping_count" integer NOT NULL DEFAULT 0,

  -- Feature configuration (JSONB)
  "features" jsonb NOT NULL DEFAULT '{"analytics": true, "cwv": true, "metaInjection": false, "schemaInjection": false, "linkInjection": false, "abTesting": false}',

  -- Domain whitelist for CORS
  "allowed_origins" text[],

  -- Timestamps
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT "chk_pixel_status_valid" CHECK (status IN (
    'pending', 'detected', 'verified', 'error'
  ))
);

-- Indexes for pixel_installations
CREATE INDEX IF NOT EXISTS "idx_pixel_installations_workspace"
  ON "pixel_installations" ("workspace_id");
CREATE INDEX IF NOT EXISTS "idx_pixel_installations_status"
  ON "pixel_installations" ("status");
CREATE INDEX IF NOT EXISTS "idx_pixel_installations_domain"
  ON "pixel_installations" ("domain");

-- Create pixel_dom_changes table for approved SEO modifications
CREATE TABLE IF NOT EXISTS "pixel_dom_changes" (
  "id" text PRIMARY KEY NOT NULL,
  "installation_id" text NOT NULL REFERENCES "pixel_installations"("id") ON DELETE CASCADE,

  -- Change details
  "change_type" text NOT NULL,
  "target_selector" text,
  "target_url" text,
  "old_value" text,
  "new_value" text NOT NULL,

  -- Approval status
  "status" text NOT NULL DEFAULT 'pending',
  "approved_by" text REFERENCES "user"("id") ON DELETE SET NULL,
  "approved_at" timestamp with time zone,

  -- Deployment tracking
  "deployed_at" timestamp with time zone,

  -- Timestamps
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT "chk_pixel_change_status_valid" CHECK (status IN (
    'pending', 'approved', 'rejected', 'live', 'rolled_back'
  )),
  CONSTRAINT "chk_pixel_change_type_valid" CHECK (change_type IN (
    'meta_title', 'meta_description', 'canonical', 'schema', 'internal_link', 'content'
  ))
);

-- Indexes for pixel_dom_changes
CREATE INDEX IF NOT EXISTS "idx_pixel_dom_changes_installation"
  ON "pixel_dom_changes" ("installation_id");
CREATE INDEX IF NOT EXISTS "idx_pixel_dom_changes_status"
  ON "pixel_dom_changes" ("status");
CREATE INDEX IF NOT EXISTS "idx_pixel_dom_changes_target_url"
  ON "pixel_dom_changes" ("target_url");

-- Create pixel_analytics_daily table for aggregated daily metrics
CREATE TABLE IF NOT EXISTS "pixel_analytics_daily" (
  "id" text PRIMARY KEY NOT NULL,
  "installation_id" text NOT NULL REFERENCES "pixel_installations"("id") ON DELETE CASCADE,
  "date" date NOT NULL,

  -- Traffic metrics
  "pageviews" integer NOT NULL DEFAULT 0,
  "sessions" integer NOT NULL DEFAULT 0,
  "unique_visitors" integer NOT NULL DEFAULT 0,
  "avg_time_on_page" numeric(10, 2),
  "bounce_rate" numeric(5, 2),

  -- Core Web Vitals (p75 aggregates)
  "lcp_p75" numeric(10, 2),
  "cls_p75" numeric(10, 4),
  "inp_p75" numeric(10, 2),

  -- Top pages for the day (JSONB)
  "top_pages" jsonb,

  -- Timestamps
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for pixel_analytics_daily
CREATE INDEX IF NOT EXISTS "idx_pixel_analytics_installation"
  ON "pixel_analytics_daily" ("installation_id");
CREATE INDEX IF NOT EXISTS "idx_pixel_analytics_date"
  ON "pixel_analytics_daily" ("date");
-- Unique constraint on (installation_id, date)
CREATE UNIQUE INDEX IF NOT EXISTS "idx_pixel_analytics_installation_date"
  ON "pixel_analytics_daily" ("installation_id", "date");

-- Create developer_handoffs table for developer email flow tracking
CREATE TABLE IF NOT EXISTS "developer_handoffs" (
  "id" text PRIMARY KEY NOT NULL,
  "installation_id" text NOT NULL REFERENCES "pixel_installations"("id") ON DELETE CASCADE,

  -- Recipient details
  "developer_email" text NOT NULL,
  "developer_name" text,

  -- Status tracking
  "status" text NOT NULL DEFAULT 'sent',

  -- Magic link for one-click verification
  "magic_link_token" text UNIQUE,
  "magic_link_expires_at" timestamp with time zone,

  -- Tracking timestamps
  "sent_at" timestamp with time zone NOT NULL DEFAULT now(),
  "opened_at" timestamp with time zone,
  "completed_at" timestamp with time zone,

  -- Reminder tracking
  "reminder_count" integer NOT NULL DEFAULT 0,
  "last_reminder_at" timestamp with time zone,

  -- Constraints
  CONSTRAINT "chk_handoff_status_valid" CHECK (status IN (
    'sent', 'opened', 'completed', 'expired'
  ))
);

-- Indexes for developer_handoffs
CREATE INDEX IF NOT EXISTS "idx_developer_handoffs_installation"
  ON "developer_handoffs" ("installation_id");
CREATE INDEX IF NOT EXISTS "idx_developer_handoffs_status"
  ON "developer_handoffs" ("status");
CREATE INDEX IF NOT EXISTS "idx_developer_handoffs_email"
  ON "developer_handoffs" ("developer_email");

-- Comment the tables
COMMENT ON TABLE "pixel_installations" IS 'TeveroPixel script installations with workspace/site scoping (Phase 66)';
COMMENT ON TABLE "pixel_dom_changes" IS 'Approved SEO DOM modifications via pixel script (Phase 66)';
COMMENT ON TABLE "pixel_analytics_daily" IS 'Aggregated daily analytics from pixel (Phase 66)';
COMMENT ON TABLE "developer_handoffs" IS 'Developer email flow tracking for pixel installation (Phase 66)';
