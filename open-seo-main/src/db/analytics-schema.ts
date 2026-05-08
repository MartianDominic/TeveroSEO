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
  boolean,
} from "drizzle-orm/pg-core";
import { clients } from "./client-schema";
import { organization } from "./user-schema";
import { siteConnections } from "./connection-schema";

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
    clientId: uuid("client_id")
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

    // Soft delete - analytics data is irreplaceable (can't re-sync historical GSC data)
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("uq_seo_gsc_snapshots_client_date").on(table.clientId, table.date),
    index("ix_seo_gsc_snapshots_client_date").on(table.clientId, table.date),
    index("ix_seo_gsc_snapshots_deleted").on(table.isDeleted),
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
    clientId: uuid("client_id")
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
 * SEO GA4 daily aggregate snapshots.
 * One row per client per date.
 *
 * Note: Renamed from ga4_snapshots to seo_ga4_snapshots to avoid conflict
 * with AI-Writer's ga4_snapshots table (CRITICAL-DB-005).
 */
export const seoGa4Snapshots = pgTable(
  "seo_ga4_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id")
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

    // Soft delete - analytics data is irreplaceable (can't re-sync historical GA4 data)
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("uq_seo_ga4_snapshots_client_date").on(table.clientId, table.date),
    index("ix_seo_ga4_snapshots_client_date").on(table.clientId, table.date),
    index("ix_seo_ga4_snapshots_deleted").on(table.isDeleted),
  ],
);

/** @deprecated Use seoGa4Snapshots instead. Alias kept for migration compatibility. */
export const ga4Snapshots = seoGa4Snapshots;

// Type exports for use in queries
export type SeoGSCSnapshot = typeof seoGscSnapshots.$inferSelect;
export type SeoGSCSnapshotInsert = typeof seoGscSnapshots.$inferInsert;

/** @deprecated Use SeoGSCSnapshot instead */
export type GSCSnapshot = SeoGSCSnapshot;
/** @deprecated Use SeoGSCSnapshotInsert instead */
export type GSCSnapshotInsert = SeoGSCSnapshotInsert;

export type GSCQuerySnapshot = typeof gscQuerySnapshots.$inferSelect;
export type GSCQuerySnapshotInsert = typeof gscQuerySnapshots.$inferInsert;

export type SeoGA4Snapshot = typeof seoGa4Snapshots.$inferSelect;
export type SeoGA4SnapshotInsert = typeof seoGa4Snapshots.$inferInsert;

/** @deprecated Use SeoGA4Snapshot instead */
export type GA4Snapshot = SeoGA4Snapshot;
/** @deprecated Use SeoGA4SnapshotInsert instead */
export type GA4SnapshotInsert = SeoGA4SnapshotInsert;

/**
 * Phase 96-03: Annotations for timeline visualization
 * Stores both Google algorithm updates (auto-imported) and custom annotations
 */
export const annotations = pgTable(
  "annotations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: text("site_id").references(() => siteConnections.id, { onDelete: "set null" }), // null = global annotation (Google updates)
    workspaceId: text("workspace_id").notNull().references(() => organization.id, { onDelete: "cascade" }),
    annotationDate: date("annotation_date").notNull(),
    annotationType: text("annotation_type").notNull(), // core_update, spam_update, helpful_content, product_reviews, link_spam, site_change, custom
    title: text("title").notNull(),
    description: text("description"),
    impact: text("impact").notNull().default('unknown'), // positive, negative, neutral, unknown
    autoGenerated: boolean("auto_generated").notNull().default(false),
    sourceUrl: text("source_url"),
    createdBy: uuid("created_by"), // User ID for custom annotations
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique constraint prevents duplicate Google updates per workspace
    unique("uq_annotations_workspace_date_title").on(
      table.workspaceId,
      table.annotationDate,
      table.title
    ),
    index("ix_annotations_workspace_site").on(table.workspaceId, table.siteId),
    index("ix_annotations_date").on(table.annotationDate),
    index("ix_annotations_type").on(table.annotationType),
  ]
);

export type Annotation = typeof annotations.$inferSelect;
export type AnnotationInsert = typeof annotations.$inferInsert;
