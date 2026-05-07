/**
 * Migration: Create domain_scrape_configs and domain_scrape_history tables
 * Phase 95: Unified Scraping Infrastructure - TieredFetcher + Domain Learning
 *
 * Creates tables for per-domain scraping intelligence:
 * - domain_scrape_configs: Stores optimal tier and metadata per domain
 * - domain_scrape_history: Historical log of all scrape attempts
 *
 * Enables 97% cost reduction by starting at known-good tier.
 */
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export async function up(db: NodePgDatabase) {
  await db.execute(sql`
    -- =============================================================================
    -- Domain Scrape Configs: Per-domain scraping intelligence
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS domain_scrape_configs (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

      -- Domain key (normalized: no protocol, no www, no path)
      domain TEXT NOT NULL UNIQUE,

      -- Optimal tier: direct | webshare | geonode | camoufox | dfs_basic | dfs_js | dfs_browser
      optimal_tier TEXT NOT NULL,

      -- Whether this tier has been validated with successful fetches
      is_validated BOOLEAN NOT NULL DEFAULT FALSE,

      -- Success metrics
      success_count INTEGER NOT NULL DEFAULT 0,
      failure_count INTEGER NOT NULL DEFAULT 0,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      success_rate REAL NOT NULL DEFAULT 1.0,

      -- Performance metrics
      avg_response_time_ms INTEGER,
      avg_page_size_bytes INTEGER,
      p95_response_time_ms INTEGER,

      -- Technology detection
      primary_technology TEXT,
      detected_technologies JSONB,
      has_anti_bot_protection BOOLEAN DEFAULT FALSE,
      requires_js_rendering BOOLEAN DEFAULT FALSE,

      -- Geographic requirements
      geo_requirement JSONB,

      -- Discovery history (last 5 attempts)
      discovery_history JSONB,
      last_escalation_reason TEXT,

      -- Timestamps
      discovered_at TIMESTAMPTZ,
      last_success_at TIMESTAMPTZ,
      last_failure_at TIMESTAMPTZ,
      last_tested_at TIMESTAMPTZ,
      next_revalidation_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Indexes for domain_scrape_configs
    CREATE UNIQUE INDEX IF NOT EXISTS ix_domain_scrape_configs_domain
      ON domain_scrape_configs(domain);

    CREATE INDEX IF NOT EXISTS ix_domain_scrape_configs_revalidation
      ON domain_scrape_configs(next_revalidation_at);

    CREATE INDEX IF NOT EXISTS ix_domain_scrape_configs_failure_rate
      ON domain_scrape_configs(success_rate, consecutive_failures);

    CREATE INDEX IF NOT EXISTS ix_domain_scrape_configs_tier
      ON domain_scrape_configs(optimal_tier);

    CREATE INDEX IF NOT EXISTS ix_domain_scrape_configs_antibot
      ON domain_scrape_configs(has_anti_bot_protection);

    CREATE INDEX IF NOT EXISTS ix_domain_scrape_configs_js
      ON domain_scrape_configs(requires_js_rendering);

    COMMENT ON TABLE domain_scrape_configs IS 'Phase 95: Per-domain scraping intelligence - stores optimal tier and metadata';

    -- =============================================================================
    -- Domain Scrape History: Log of all scrape attempts
    -- =============================================================================
    CREATE TABLE IF NOT EXISTS domain_scrape_history (
      id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,

      -- Reference to domain config
      domain_config_id BIGINT NOT NULL REFERENCES domain_scrape_configs(id) ON DELETE CASCADE,

      -- Domain (denormalized for faster queries)
      domain TEXT NOT NULL,

      -- Full URL that was fetched
      url TEXT NOT NULL,

      -- Tier used: direct | webshare | geonode | camoufox | dfs_basic | dfs_js | dfs_browser
      tier TEXT NOT NULL,

      -- Result
      success BOOLEAN NOT NULL,
      status_code INTEGER,
      response_time_ms INTEGER,
      response_size_bytes INTEGER,
      cost_usd REAL NOT NULL DEFAULT 0,

      -- Error details
      escalation_reason TEXT,
      error_message TEXT,

      -- Content validation
      validation JSONB,

      -- Request metadata
      proxy_used TEXT,
      user_agent TEXT,
      job_id TEXT,
      client_id TEXT,

      -- Timestamp
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Indexes for domain_scrape_history
    CREATE INDEX IF NOT EXISTS ix_domain_scrape_history_domain
      ON domain_scrape_history(domain, attempted_at);

    CREATE INDEX IF NOT EXISTS ix_domain_scrape_history_config
      ON domain_scrape_history(domain_config_id);

    CREATE INDEX IF NOT EXISTS ix_domain_scrape_history_client_cost
      ON domain_scrape_history(client_id, attempted_at, cost_usd);

    CREATE INDEX IF NOT EXISTS ix_domain_scrape_history_tier
      ON domain_scrape_history(tier, attempted_at);

    CREATE INDEX IF NOT EXISTS ix_domain_scrape_history_failures
      ON domain_scrape_history(success, escalation_reason, attempted_at);

    CREATE INDEX IF NOT EXISTS ix_domain_scrape_history_cleanup
      ON domain_scrape_history(attempted_at);

    COMMENT ON TABLE domain_scrape_history IS 'Phase 95: Historical log of all scrape attempts for debugging and cost analysis';
  `);
}

export async function down(db: NodePgDatabase) {
  await db.execute(sql`
    -- Drop history table first (has FK to configs)
    DROP INDEX IF EXISTS ix_domain_scrape_history_cleanup;
    DROP INDEX IF EXISTS ix_domain_scrape_history_failures;
    DROP INDEX IF EXISTS ix_domain_scrape_history_tier;
    DROP INDEX IF EXISTS ix_domain_scrape_history_client_cost;
    DROP INDEX IF EXISTS ix_domain_scrape_history_config;
    DROP INDEX IF EXISTS ix_domain_scrape_history_domain;
    DROP TABLE IF EXISTS domain_scrape_history;

    -- Drop configs table
    DROP INDEX IF EXISTS ix_domain_scrape_configs_js;
    DROP INDEX IF EXISTS ix_domain_scrape_configs_antibot;
    DROP INDEX IF EXISTS ix_domain_scrape_configs_tier;
    DROP INDEX IF EXISTS ix_domain_scrape_configs_failure_rate;
    DROP INDEX IF EXISTS ix_domain_scrape_configs_revalidation;
    DROP INDEX IF EXISTS ix_domain_scrape_configs_domain;
    DROP TABLE IF EXISTS domain_scrape_configs;
  `);
}
