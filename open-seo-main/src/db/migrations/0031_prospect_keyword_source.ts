/**
 * Migration: 0031_prospect_keyword_source
 *
 * Creates the prospect_keywords table for unified keyword storage
 * with source tracking across all 5 entry points.
 */

import { sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";

export async function up(tx: PgTransaction<any, any, any>) {
  await tx.execute(sql`
    CREATE TABLE IF NOT EXISTS prospect_keywords (
      id TEXT PRIMARY KEY,
      prospect_id TEXT NOT NULL,

      -- Keyword data
      keyword TEXT NOT NULL,
      normalized_keyword TEXT NOT NULL,

      -- Source tracking
      source TEXT NOT NULL,
      source_metadata JSONB,

      -- Metrics (nullable until enriched)
      search_volume INTEGER,
      keyword_difficulty REAL,
      cpc REAL,
      competition REAL,

      -- Current ranking
      current_position INTEGER,
      current_url TEXT,

      -- Enrichment tracking
      enrichment_status TEXT NOT NULL DEFAULT 'pending',
      enrichment_cost_cents INTEGER DEFAULT 0,
      enriched_at TIMESTAMPTZ,

      -- Prioritization
      tier TEXT,
      quick_win_type TEXT,
      composite_score REAL,
      relevance_score REAL,

      -- Page mapping
      mapped_url TEXT,
      mapped_action TEXT,
      mapping_confidence REAL,

      -- Timestamps
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS ix_prospect_keywords_prospect
      ON prospect_keywords(prospect_id);
    CREATE INDEX IF NOT EXISTS ix_prospect_keywords_source
      ON prospect_keywords(source);
    CREATE INDEX IF NOT EXISTS ix_prospect_keywords_tier
      ON prospect_keywords(tier);
    CREATE INDEX IF NOT EXISTS ix_prospect_keywords_enrichment
      ON prospect_keywords(enrichment_status);
    CREATE UNIQUE INDEX IF NOT EXISTS ix_prospect_keywords_unique
      ON prospect_keywords(prospect_id, normalized_keyword);
  `);
}

export async function down(tx: PgTransaction<any, any, any>) {
  await tx.execute(sql`
    DROP INDEX IF EXISTS ix_prospect_keywords_unique;
    DROP INDEX IF EXISTS ix_prospect_keywords_enrichment;
    DROP INDEX IF EXISTS ix_prospect_keywords_tier;
    DROP INDEX IF EXISTS ix_prospect_keywords_source;
    DROP INDEX IF EXISTS ix_prospect_keywords_prospect;
    DROP TABLE IF EXISTS prospect_keywords;
  `);
}
