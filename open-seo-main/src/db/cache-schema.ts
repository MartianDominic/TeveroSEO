/**
 * HTML Cache Schema
 * Phase 95-02: Multi-Level Caching
 *
 * PostgreSQL schema for L3 persistent HTML cache.
 * Partitioned by crawl_date for efficient archival and pruning.
 */

import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  index,
  serial,
  jsonb,
  smallint,
  uuid,
} from "drizzle-orm/pg-core";
import { clients } from "./client-schema";
import type { ScrapeTier } from "./domain-scrape-learning-schema";

// =============================================================================
// Types
// =============================================================================

/**
 * Parsed page data stored as JSONB.
 */
export interface ParsedPageDataJson {
  title: string;
  metaDescription: string;
  canonical: string;
  h1: string[];
  h2: string[];
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  images: number;
  hasSchema: boolean;
}

// =============================================================================
// Tables
// =============================================================================

/**
 * Primary HTML cache storage (L3).
 *
 * Stores compressed HTML with metadata for persistent caching.
 * Note: For full partitioning support, create partitions via raw SQL migration.
 */
export const htmlCache = pgTable(
  "html_cache",
  {
    id: serial("id").primaryKey(),

    // Tenant isolation (Phase 97: Multi-tenant cache security)
    // Required for all new entries - prevents cross-tenant cache pollution
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // URL identification
    urlHash: text("url_hash").notNull(), // sha256(normalized_url).slice(0,16)
    url: text("url").notNull(), // Original URL for debugging

    // Content deduplication
    contentHash: text("content_hash").notNull(), // sha256(html).slice(0,16)

    // Compressed HTML storage
    htmlCompressed: text("html_compressed").notNull(), // Base64 encoded gzip
    compressionAlgo: text("compression_algo").notNull().default("gzip"),

    // Response metadata
    statusCode: smallint("status_code").notNull(),
    pageSizeBytes: integer("page_size_bytes").notNull(),
    tierUsed: text("tier_used").notNull().$type<ScrapeTier>(),

    // Timestamps
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    crawlDate: timestamp("crawl_date", { withTimezone: true })
      .notNull()
      .defaultNow(),

    // Revalidation headers
    etag: text("etag"),
    lastModified: text("last_modified"),

    // Content type for TTL calculation
    contentType: text("content_type"),

    // Pre-parsed data (optional, saves re-parsing)
    parsedData: jsonb("parsed_data").$type<ParsedPageDataJson>(),

    // Metadata
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // Composite index for tenant-scoped lookups (most common query pattern)
    clientUrlHashIdx: index("idx_html_cache_client_url_hash").on(
      table.clientId,
      table.urlHash
    ),
    // Index for client-scoped cache cleanup/maintenance
    clientIdIdx: index("idx_html_cache_client_id").on(table.clientId),
    urlHashIdx: index("idx_html_cache_url_hash").on(table.urlHash),
    contentHashIdx: index("idx_html_cache_content_hash").on(table.contentHash),
    expiresAtIdx: index("idx_html_cache_expires_at").on(table.expiresAt),
    crawlDateIdx: index("idx_html_cache_crawl_date").on(table.crawlDate),
  })
);

/**
 * URL aliases for content deduplication.
 *
 * Multiple URLs can point to the same content (different query params,
 * trailing slashes, etc.). This table maps alias URLs to their canonical
 * content entry.
 */
export const htmlCacheAliases = pgTable(
  "html_cache_aliases",
  {
    aliasUrlHash: text("alias_url_hash").primaryKey(),
    canonicalId: integer("canonical_id").notNull(),
    // Tenant isolation - must match the canonical entry's clientId
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    canonicalIdIdx: index("idx_html_cache_aliases_canonical").on(
      table.canonicalId
    ),
    // Index for client-scoped alias lookups
    clientAliasIdx: index("idx_html_cache_aliases_client").on(table.clientId),
  })
);

/**
 * Cache statistics for monitoring.
 *
 * Stores hourly cache performance metrics.
 */
export const cacheStats = pgTable("cache_stats", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),

  // Tenant isolation - optional for aggregate stats, required for client-specific stats
  clientId: uuid("client_id").references(() => clients.id, {
    onDelete: "cascade",
  }),

  // Per-level stats
  l1Hits: integer("l1_hits").notNull().default(0),
  l1Misses: integer("l1_misses").notNull().default(0),
  l2Hits: integer("l2_hits").notNull().default(0),
  l2Misses: integer("l2_misses").notNull().default(0),
  l3Hits: integer("l3_hits").notNull().default(0),
  l3Misses: integer("l3_misses").notNull().default(0),
  l4Hits: integer("l4_hits").notNull().default(0),
  l4Misses: integer("l4_misses").notNull().default(0),

  // Aggregate metrics
  totalHitRate: integer("total_hit_rate").notNull().default(0), // percentage * 100
  avgLatencyMs: integer("avg_latency_ms").notNull().default(0),

  // Storage metrics
  l1SizeBytes: integer("l1_size_bytes"),
  l2SizeBytes: integer("l2_size_bytes"),
  l3SizeBytes: integer("l3_size_bytes"),
  l4SizeBytes: integer("l4_size_bytes"),

  // Request counts
  totalRequests: integer("total_requests").notNull().default(0),
});

// =============================================================================
// Type Exports
// =============================================================================

export type HtmlCache = typeof htmlCache.$inferSelect;
export type NewHtmlCache = typeof htmlCache.$inferInsert;

export type HtmlCacheAlias = typeof htmlCacheAliases.$inferSelect;
export type NewHtmlCacheAlias = typeof htmlCacheAliases.$inferInsert;

export type CacheStatsRow = typeof cacheStats.$inferSelect;
export type NewCacheStatsRow = typeof cacheStats.$inferInsert;
