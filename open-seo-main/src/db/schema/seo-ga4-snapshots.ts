/**
 * SEO GA4 daily snapshots schema for database consolidation.
 * Phase 67-01: Schema Design (Database Consolidation)
 *
 * Namespace: seo_*
 * ORM Owner: Drizzle
 *
 * This schema stores Google Analytics 4 data.
 * One row per client per date.
 *
 * Requirements:
 *   - CRITICAL-DB-005: Namespaced to avoid AI-Writer conflict
 *   - MED-DB-006: TIMESTAMPTZ for all timestamp columns
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
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sharedClients } from "./shared-clients";

/**
 * SEO GA4 daily aggregate snapshots.
 * One row per client per date.
 *
 * CASCADE delete on client_id FK ensures cleanup when client is deleted.
 * Soft delete preserves irreplaceable historical GA4 data.
 */
export const seoGa4DailySnapshots = pgTable(
  "seo_ga4_daily_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign key to unified shared_clients with CASCADE delete
    clientId: uuid("client_id")
      .notNull()
      .references(() => sharedClients.id, { onDelete: "cascade" }),

    // Date of the snapshot
    date: date("date").notNull(),

    // GA4 property identifier
    propertyId: text("property_id").notNull(),

    // GA4 metrics
    sessions: integer("sessions").default(0),
    users: integer("users").default(0),
    newUsers: integer("new_users").default(0),
    bounceRate: real("bounce_rate").default(0),
    avgSessionDuration: real("avg_session_duration").default(0),
    conversions: integer("conversions").default(0),
    revenue: real("revenue").default(0),

    // Page-level metrics
    pageviews: integer("pageviews").default(0),
    uniquePageviews: integer("unique_pageviews").default(0),
    avgTimeOnPage: real("avg_time_on_page").default(0),
    exitRate: real("exit_rate").default(0),

    // Sync metadata - TIMESTAMPTZ (MED-DB-006)
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    // Soft delete - analytics data is irreplaceable (can't re-sync historical GA4 data)
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // Unique constraint per client per date
    unique("uq_seo_ga4_daily_snapshots_client_date").on(
      table.clientId,
      table.date
    ),

    // Indexes for common queries
    index("ix_seo_ga4_daily_snapshots_client_date").on(
      table.clientId,
      table.date
    ),
    index("ix_seo_ga4_daily_snapshots_deleted").on(table.isDeleted),
  ]
);

/**
 * SEO GA4 top pages per day.
 * Up to 50 pages per client per date.
 */
export const seoGa4PageSnapshots = pgTable(
  "seo_ga4_page_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign key to unified shared_clients with CASCADE delete
    clientId: uuid("client_id")
      .notNull()
      .references(() => sharedClients.id, { onDelete: "cascade" }),

    // Date and page path
    date: date("date").notNull(),
    pagePath: text("page_path").notNull(),
    pageTitle: text("page_title"),

    // GA4 metrics for this page
    pageviews: integer("pageviews").default(0),
    uniquePageviews: integer("unique_pageviews").default(0),
    avgTimeOnPage: real("avg_time_on_page").default(0),
    bounceRate: real("bounce_rate").default(0),
    exitRate: real("exit_rate").default(0),
    entrances: integer("entrances").default(0),
  },
  (table) => [
    // Unique constraint per client per date per page
    unique("uq_seo_ga4_page_snapshots_client_date_page").on(
      table.clientId,
      table.date,
      table.pagePath
    ),

    // Index for common queries
    index("ix_seo_ga4_page_snapshots_client_date").on(
      table.clientId,
      table.date
    ),
  ]
);

// Relations
export const seoGa4DailySnapshotsRelations = relations(
  seoGa4DailySnapshots,
  ({ one }) => ({
    client: one(sharedClients, {
      fields: [seoGa4DailySnapshots.clientId],
      references: [sharedClients.id],
    }),
  })
);

export const seoGa4PageSnapshotsRelations = relations(
  seoGa4PageSnapshots,
  ({ one }) => ({
    client: one(sharedClients, {
      fields: [seoGa4PageSnapshots.clientId],
      references: [sharedClients.id],
    }),
  })
);

// Type exports
export type SeoGa4DailySnapshotSelect = typeof seoGa4DailySnapshots.$inferSelect;
export type SeoGa4DailySnapshotInsert = typeof seoGa4DailySnapshots.$inferInsert;
export type SeoGa4PageSnapshotSelect = typeof seoGa4PageSnapshots.$inferSelect;
export type SeoGa4PageSnapshotInsert = typeof seoGa4PageSnapshots.$inferInsert;
