-- Phase 96-05: Client Portal Tables
-- Creates client visibility controls, brand term tracking, and report scheduling

-------------------------------------------------------------------------------
-- client_visibility: Per-client metric visibility settings
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "client_visibility" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
    "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,

    -- Per-metric visibility
    "show_clicks" boolean NOT NULL DEFAULT true,
    "show_impressions" boolean NOT NULL DEFAULT true,
    "show_position" boolean NOT NULL DEFAULT true,
    "show_ctr" boolean NOT NULL DEFAULT true,
    "show_queries" boolean NOT NULL DEFAULT false,
    "show_pages" boolean NOT NULL DEFAULT true,
    "show_competitors" boolean NOT NULL DEFAULT false,

    -- Report access
    "can_view_growing" boolean NOT NULL DEFAULT true,
    "can_view_decaying" boolean NOT NULL DEFAULT true,
    "can_view_cannibalization" boolean NOT NULL DEFAULT false,
    "can_export" boolean NOT NULL DEFAULT false,

    -- Timestamps
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Indexes for client_visibility
CREATE UNIQUE INDEX IF NOT EXISTS "uq_client_visibility_client_workspace"
    ON "client_visibility" ("client_id", "workspace_id");
CREATE INDEX IF NOT EXISTS "ix_client_visibility_client"
    ON "client_visibility" ("client_id");
CREATE INDEX IF NOT EXISTS "ix_client_visibility_workspace"
    ON "client_visibility" ("workspace_id");

-------------------------------------------------------------------------------
-- brand_terms: Brand keyword terms for traffic classification
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "brand_terms" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "client_id" uuid NOT NULL REFERENCES "clients"("id") ON DELETE CASCADE,
    "term" text NOT NULL,
    "is_auto_detected" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now()
);

-- Indexes for brand_terms
CREATE INDEX IF NOT EXISTS "ix_brand_terms_client"
    ON "brand_terms" ("client_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uq_brand_terms_client_term"
    ON "brand_terms" ("client_id", "term");

-------------------------------------------------------------------------------
-- analytics_report_schedules: Automated report scheduling
-------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "analytics_report_schedules" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "workspace_id" text NOT NULL REFERENCES "organization"("id") ON DELETE CASCADE,
    "client_id" uuid REFERENCES "clients"("id") ON DELETE CASCADE,

    -- Schedule configuration
    "frequency" text NOT NULL,
    "recipients" jsonb NOT NULL DEFAULT '[]',

    -- Execution tracking
    "next_run_at" timestamptz NOT NULL,
    "last_run_at" timestamptz,
    "is_active" boolean NOT NULL DEFAULT true,

    -- Timestamps
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- Indexes for analytics_report_schedules
CREATE INDEX IF NOT EXISTS "ix_analytics_report_schedules_workspace"
    ON "analytics_report_schedules" ("workspace_id");
CREATE INDEX IF NOT EXISTS "ix_analytics_report_schedules_client"
    ON "analytics_report_schedules" ("client_id");
CREATE INDEX IF NOT EXISTS "ix_analytics_report_schedules_next_run"
    ON "analytics_report_schedules" ("next_run_at");
CREATE INDEX IF NOT EXISTS "ix_analytics_report_schedules_active"
    ON "analytics_report_schedules" ("is_active");
