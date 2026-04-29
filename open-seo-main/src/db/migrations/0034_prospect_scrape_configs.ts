/**
 * Migration: Create prospect_scrape_configs table
 * Phase 43: Prospect Keyword Pipeline - AI Selector Discovery
 *
 * Creates the table for storing per-prospect scraping configuration including:
 * - Platform detection (Shopify, WooCommerce, Magento, etc.)
 * - Custom extraction rules for product/category pages
 * - AI-discovered CSS selectors with confidence scores
 * - Crawl settings (max pages, depth, rate limits)
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function up(db: NodePgDatabase) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS prospect_scrape_configs (
      id TEXT PRIMARY KEY,
      prospect_id TEXT NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,

      -- Site detection
      detected_platform TEXT,
      detected_site_type TEXT,
      platform_version TEXT,

      -- Extraction rules (user-defined or AI-generated)
      extraction_rules JSONB,

      -- AI-discovered selectors (before user confirmation)
      ai_selectors JSONB,

      -- Crawl settings
      max_pages INTEGER DEFAULT 500,
      max_depth INTEGER DEFAULT 3,
      rate_limit INTEGER DEFAULT 2,
      include_patterns JSONB,
      exclude_patterns JSONB,

      -- Timestamps
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Unique index: one config per prospect
    CREATE UNIQUE INDEX IF NOT EXISTS ix_prospect_scrape_configs_prospect
      ON prospect_scrape_configs(prospect_id);

    -- Comment for documentation
    COMMENT ON TABLE prospect_scrape_configs IS 'Phase 43: Per-prospect scraping configuration with AI selector discovery';
  `);
}

export async function down(db: NodePgDatabase) {
  await db.execute(sql`
    DROP INDEX IF EXISTS ix_prospect_scrape_configs_prospect;
    DROP TABLE IF EXISTS prospect_scrape_configs;
  `);
}
