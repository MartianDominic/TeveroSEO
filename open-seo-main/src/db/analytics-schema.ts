/**
 * Drizzle ORM schema for analytics snapshot tables.
 *
 * These tables store GSC and GA4 data synced by the analytics worker.
 * Data is written by open-seo-worker and read by the Next.js dashboard.
 */
import {
  pgTable,
  uuid,
  text,
  date,
  integer,
  real,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { clients } from "./client-schema";

/**
 * SEO GSC daily aggregate snapshots.
 * One row per client per date.
 *
 * Note: Renamed from gsc_snapshots to seo_gsc_snapshots to avoid conflict
 * with AI-Writer's gsc_snapshots table (CRITICAL-DB-002).
 */
export const seoGscSnapshots = pgTable(
  "seo_gsc_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    siteUrl: text("site_url").notNull(),
    clicks: integer("clicks").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    ctr: real("ctr").notNull().default(0),
    position: real("position").notNull().default(0),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("uq_seo_gsc_snapshots_client_date").on(table.clientId, table.date),
    index("ix_seo_gsc_snapshots_client_date").on(table.clientId, table.date),
  ],
);

/** @deprecated Use seoGscSnapshots instead. Alias kept for migration compatibility. */
export const gscSnapshots = seoGscSnapshots;

/**
 * GSC top queries per day.
 * Up to 50 queries per client per date.
 */
export const gscQuerySnapshots = pgTable(
  "gsc_query_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    query: text("query").notNull(),
    clicks: integer("clicks").default(0),
    impressions: integer("impressions").default(0),
    ctr: real("ctr").default(0),
    position: real("position").default(0),
  },
  (table) => [
    unique("uq_gsc_query_snapshots_client_date_query").on(
      table.clientId,
      table.date,
      table.query,
    ),
    index("ix_gsc_query_snapshots_client_date").on(table.clientId, table.date),
  ],
);

/**
 * GA4 daily aggregate snapshots.
 * One row per client per date.
 */
export const ga4Snapshots = pgTable(
  "ga4_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    propertyId: text("property_id").notNull(),
    sessions: integer("sessions").default(0),
    users: integer("users").default(0),
    newUsers: integer("new_users").default(0),
    bounceRate: real("bounce_rate").default(0),
    avgSessionDuration: real("avg_session_duration").default(0),
    conversions: integer("conversions").default(0),
    revenue: real("revenue").default(0),
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("uq_ga4_snapshots_client_date").on(table.clientId, table.date),
    index("ix_ga4_snapshots_client_date").on(table.clientId, table.date),
  ],
);

// Type exports for use in queries
export type SeoGSCSnapshot = typeof seoGscSnapshots.$inferSelect;
export type SeoGSCSnapshotInsert = typeof seoGscSnapshots.$inferInsert;

/** @deprecated Use SeoGSCSnapshot instead */
export type GSCSnapshot = SeoGSCSnapshot;
/** @deprecated Use SeoGSCSnapshotInsert instead */
export type GSCSnapshotInsert = SeoGSCSnapshotInsert;

export type GSCQuerySnapshot = typeof gscQuerySnapshots.$inferSelect;
export type GSCQuerySnapshotInsert = typeof gscQuerySnapshots.$inferInsert;

export type GA4Snapshot = typeof ga4Snapshots.$inferSelect;
export type GA4SnapshotInsert = typeof ga4Snapshots.$inferInsert;
