/**
 * GSC Query Analytics Schema
 * Phase 96-01: TimescaleDB hypertable for agency-scale GSC data
 *
 * Design decisions:
 * - TIMESTAMPTZ for query_time (required by TimescaleDB hypertables)
 * - 7-day chunks for 125M rows/day workload
 * - Compression on chunks > 30 days (90-95% reduction)
 * - 5-year retention policy via add_retention_policy()
 * - PRIMARY KEY includes query_time for hypertable partitioning
 * - References siteConnections (not clients) for site-level GSC data
 */
import { pgTable, uuid, text, integer, real, timestamp, index } from "drizzle-orm/pg-core";
import { siteConnections } from "./connection-schema";

export const seoGscQueryAnalytics = pgTable(
  "seo_gsc_query_analytics",
  {
    id: uuid("id").defaultRandom(),
    siteId: text("site_id").notNull().references(() => siteConnections.id, { onDelete: "cascade" }),
    queryTime: timestamp("query_time", { withTimezone: true }).notNull(),
    query: text("query").notNull(),
    pageUrl: text("page_url"),
    country: text("country"),
    device: text("device"),
    searchAppearance: text("search_appearance"),
    clicks: integer("clicks").default(0),
    impressions: integer("impressions").default(0),
    ctr: real("ctr"),
    position: real("position"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (table) => [
    // Composite primary key including time for hypertable
    // Note: Drizzle doesn't support composite PKs directly, handled in migration
    index("idx_gsc_query_site_time").on(table.siteId, table.queryTime),
    index("idx_gsc_query_query").on(table.query),
    index("idx_gsc_query_page").on(table.pageUrl),
  ]
);

export type SeoGscQueryAnalytics = typeof seoGscQueryAnalytics.$inferSelect;
export type SeoGscQueryAnalyticsInsert = typeof seoGscQueryAnalytics.$inferInsert;
