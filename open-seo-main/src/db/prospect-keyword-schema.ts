/**
 * Prospect Keyword Schema
 *
 * Unified keyword storage with source tracking for all 5 entry points.
 * Supports deduplication by normalized keyword per prospect.
 */

import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  real,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// Source enum - tracks where keyword originated
export const KEYWORD_SOURCES = [
  "dataforseo", // From DataForSEO API (organic/gap)
  "manual", // User typed directly
  "csv_upload", // Imported from CSV
  "competitor_gap", // From competitor gap analysis
  "quick_check", // Quick check entry (no workspace)
] as const;
export type KeywordSource = (typeof KEYWORD_SOURCES)[number];

// Enrichment status enum
export const ENRICHMENT_STATUS = [
  "pending", // Not yet enriched
  "enriched", // Successfully enriched via API
  "cached", // Metrics from Redis cache
  "failed", // API call failed
  "skipped", // Metrics present from source (CSV)
] as const;
export type EnrichmentStatus = (typeof ENRICHMENT_STATUS)[number];

// Tier enum for prioritization
export const KEYWORD_TIERS = [
  "must_do", // 0.75-1.0 composite score
  "should_do", // 0.50-0.749
  "nice_to_have", // 0.25-0.499
  "ignore", // < 0.25
] as const;
export type KeywordTier = (typeof KEYWORD_TIERS)[number];

// Quick win types
export const QUICK_WIN_TYPES = [
  "striking_distance", // Position 11-30, volume >= 200
  "low_hanging", // Position 4-10, competition <= 0.5
  "fresh_opportunity", // Not ranking, high relevance
] as const;
export type QuickWinType = (typeof QUICK_WIN_TYPES)[number];

// Source metadata by type
export interface SourceMetadata {
  csvFileName?: string;
  csvRowNumber?: number;
  competitorDomain?: string;
  competitorPosition?: number;
  originalSource?: string;
  importedAt?: string;
}

/**
 * ProspectKeywords table - unified keyword storage with source tracking.
 * Supports all 5 entry points with deduplication by normalized keyword.
 *
 * Note: References prospects table which must exist. If running standalone,
 * ensure prospect-schema.ts is loaded first.
 */
export const prospectKeywords = pgTable(
  "prospect_keywords",
  {
    id: text("id").primaryKey(),
    prospectId: text("prospect_id").notNull(),

    // Keyword data
    keyword: text("keyword").notNull(),
    normalizedKeyword: text("normalized_keyword").notNull(), // Lowercase, trimmed

    // Source tracking
    source: text("source").notNull(), // KeywordSource
    sourceMetadata: jsonb("source_metadata").$type<SourceMetadata>(),

    // Metrics (nullable until enriched)
    searchVolume: integer("search_volume"),
    keywordDifficulty: real("keyword_difficulty"),
    cpc: real("cpc"),
    competition: real("competition"),

    // Current ranking (if any)
    currentPosition: integer("current_position"),
    currentUrl: text("current_url"),

    // Enrichment tracking
    enrichmentStatus: text("enrichment_status").notNull().default("pending"),
    enrichmentCostCents: integer("enrichment_cost_cents").default(0),
    enrichedAt: timestamp("enriched_at", { withTimezone: true, mode: "date" }),

    // Prioritization (computed by PrioritizationService)
    tier: text("tier"), // KeywordTier
    quickWinType: text("quick_win_type"), // QuickWinType
    compositeScore: real("composite_score"),
    relevanceScore: real("relevance_score"),

    // Page mapping (if assigned)
    mappedUrl: text("mapped_url"),
    mappedAction: text("mapped_action"), // "optimize" | "create"
    mappingConfidence: real("mapping_confidence"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_prospect_keywords_prospect").on(table.prospectId),
    index("ix_prospect_keywords_source").on(table.source),
    index("ix_prospect_keywords_tier").on(table.tier),
    index("ix_prospect_keywords_enrichment").on(table.enrichmentStatus),
    uniqueIndex("ix_prospect_keywords_unique").on(
      table.prospectId,
      table.normalizedKeyword
    ),
  ]
);

// Inferred types
export type ProspectKeywordSelect = typeof prospectKeywords.$inferSelect;
export type ProspectKeywordInsert = typeof prospectKeywords.$inferInsert;
