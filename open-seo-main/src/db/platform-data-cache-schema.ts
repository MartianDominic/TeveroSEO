/**
 * Schema for cached platform data.
 * Phase 61-01: Platform Integration Excellence
 *
 * Stores fetched data from connected platforms with expiry.
 * Used for caching GSC queries, GA metrics, Shopify products, etc.
 *
 * HIGH-36 LIMITATION: The $onUpdate() hook is client-side only (Drizzle ORM).
 * It will NOT trigger for:
 * - Raw SQL updates (e.g., db.execute(sql`UPDATE ...`))
 * - Database triggers or stored procedures
 * - Updates from other applications/services
 *
 * If server-side auto-update is required, create a PostgreSQL trigger:
 * CREATE OR REPLACE FUNCTION update_updated_at()
 * RETURNS TRIGGER AS $$
 * BEGIN
 *   NEW.updated_at = NOW();
 *   RETURN NEW;
 * END;
 * $$ LANGUAGE plpgsql;
 *
 * CREATE TRIGGER set_updated_at
 * BEFORE UPDATE ON platform_data_cache
 * FOR EACH ROW EXECUTE FUNCTION update_updated_at();
 */
import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { platformConnections } from "./platform-connection-schema";

// Data type constants for type-safe cache keys
export const PLATFORM_DATA_TYPES = [
  "search_queries",
  "pages",
  "index_status",
  "core_web_vitals",
  "traffic_overview",
  "top_pages",
  "traffic_sources",
  "conversions",
  "posts",
  "products",
  "collections",
  "redirects",
  "reviews",
  "insights",
] as const;

export type PlatformDataType = (typeof PLATFORM_DATA_TYPES)[number];

/**
 * Platform data cache table - stores fetched platform data with expiry.
 * Each record represents a specific data type from a connection.
 * Data is stored as JSONB and expires based on data freshness requirements.
 */
export const platformDataCache = pgTable(
  "platform_data_cache",
  {
    id: text("id").primaryKey(),

    // Foreign key to platform connection
    connectionId: text("connection_id")
      .notNull()
      .references(() => platformConnections.id, { onDelete: "cascade" }),

    // Data type and range
    dataType: text("data_type").notNull(),
    dateRange: text("date_range"), // e.g., 'last_7_days', 'last_30_days', '2024-01-01:2024-01-31'

    // Cached data as JSONB
    data: jsonb("data").notNull(),

    // Cache metadata
    fetchedAt: timestamp("fetched_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    // H-07: Added updatedAt for cache freshness tracking
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_platform_data_cache_connection").on(table.connectionId),
    index("idx_platform_data_cache_type").on(table.dataType),
    index("idx_platform_data_cache_expiry").on(table.expiresAt),
  ]
);

// Relations
export const platformDataCacheRelations = relations(
  platformDataCache,
  ({ one }) => ({
    connection: one(platformConnections, {
      fields: [platformDataCache.connectionId],
      references: [platformConnections.id],
    }),
  })
);

// Inferred types for database operations
export type PlatformDataCacheSelect = typeof platformDataCache.$inferSelect;
export type PlatformDataCacheInsert = typeof platformDataCache.$inferInsert;
