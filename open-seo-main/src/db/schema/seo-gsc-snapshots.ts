/**
 * SEO GSC daily snapshots schema for database consolidation.
 * Phase 67-01: Schema Design (Database Consolidation)
 *
 * Namespace: seo_*
 * ORM Owner: Drizzle
 *
 * This schema stores Google Search Console analytics data.
 * One row per client per date.
 *
 * Requirements:
 *   - CRITICAL-DB-002: Namespaced to avoid AI-Writer conflict
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
 * SEO GSC daily aggregate snapshots.
 * One row per client per date.
 *
 * CASCADE delete on client_id FK ensures cleanup when client is deleted.
 * Soft delete preserves irreplaceable historical GSC data.
 */
export const seoGscDailySnapshots = pgTable(
  "seo_gsc_daily_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign key to unified shared_clients with CASCADE delete
    clientId: uuid("client_id")
      .notNull()
      .references(() => sharedClients.id, { onDelete: "cascade" }),

    // Date of the snapshot
    date: date("date").notNull(),

    // GSC site URL for multi-property support
    siteUrl: text("site_url").notNull(),

    // GSC metrics
    clicks: integer("clicks").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    ctr: real("ctr").notNull().default(0),
    position: real("position").notNull().default(0),

    // Sync metadata - TIMESTAMPTZ (MED-DB-006)
    syncedAt: timestamp("synced_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    // Soft delete - analytics data is irreplaceable (can't re-sync historical GSC data)
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    // Unique constraint per client per date
    unique("uq_seo_gsc_daily_snapshots_client_date").on(
      table.clientId,
      table.date
    ),

    // Indexes for common queries
    index("ix_seo_gsc_daily_snapshots_client_date").on(
      table.clientId,
      table.date
    ),
    index("ix_seo_gsc_daily_snapshots_deleted").on(table.isDeleted),
  ]
);

/**
 * SEO GSC top queries per day.
 * Up to 50 queries per client per date.
 */
export const seoGscQuerySnapshots = pgTable(
  "seo_gsc_query_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Foreign key to unified shared_clients with CASCADE delete
    clientId: uuid("client_id")
      .notNull()
      .references(() => sharedClients.id, { onDelete: "cascade" }),

    // Date and query
    date: date("date").notNull(),
    query: text("query").notNull(),

    // GSC metrics for this query
    clicks: integer("clicks").default(0),
    impressions: integer("impressions").default(0),
    ctr: real("ctr").default(0),
    position: real("position").default(0),
  },
  (table) => [
    // Unique constraint per client per date per query
    unique("uq_seo_gsc_query_snapshots_client_date_query").on(
      table.clientId,
      table.date,
      table.query
    ),

    // Index for common queries
    index("ix_seo_gsc_query_snapshots_client_date").on(
      table.clientId,
      table.date
    ),
  ]
);

// Relations
export const seoGscDailySnapshotsRelations = relations(
  seoGscDailySnapshots,
  ({ one }) => ({
    client: one(sharedClients, {
      fields: [seoGscDailySnapshots.clientId],
      references: [sharedClients.id],
    }),
  })
);

export const seoGscQuerySnapshotsRelations = relations(
  seoGscQuerySnapshots,
  ({ one }) => ({
    client: one(sharedClients, {
      fields: [seoGscQuerySnapshots.clientId],
      references: [sharedClients.id],
    }),
  })
);

// Type exports
export type SeoGscDailySnapshotSelect = typeof seoGscDailySnapshots.$inferSelect;
export type SeoGscDailySnapshotInsert = typeof seoGscDailySnapshots.$inferInsert;
export type SeoGscQuerySnapshotSelect = typeof seoGscQuerySnapshots.$inferSelect;
export type SeoGscQuerySnapshotInsert = typeof seoGscQuerySnapshots.$inferInsert;
