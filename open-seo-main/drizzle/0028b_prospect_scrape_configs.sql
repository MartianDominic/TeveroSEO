-- Phase 43: Prospect Keyword Pipeline
-- Migration: Create prospect_scrape_configs table for AI selector discovery

CREATE TABLE IF NOT EXISTS "prospect_scrape_configs" (
  "id" text PRIMARY KEY NOT NULL,
  "prospect_id" text NOT NULL REFERENCES "prospects"("id") ON DELETE CASCADE,

  -- Site detection
  "detected_platform" text,
  "detected_site_type" text,
  "platform_version" text,

  -- Extraction rules (user-defined or AI-generated)
  "extraction_rules" jsonb,

  -- AI-discovered selectors (before user confirmation)
  "ai_selectors" jsonb,

  -- Crawl settings
  "max_pages" integer DEFAULT 500,
  "max_depth" integer DEFAULT 3,
  "rate_limit" integer DEFAULT 2,
  "include_patterns" jsonb,
  "exclude_patterns" jsonb,

  -- Timestamps
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Unique index: one config per prospect
CREATE UNIQUE INDEX IF NOT EXISTS "ix_prospect_scrape_configs_prospect" ON "prospect_scrape_configs" ("prospect_id");
