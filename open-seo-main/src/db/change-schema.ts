/**
 * Schema for auto-fix change tracking system.
 * Phase 33-01: Change Tracking Schema
 *
 * Stores all SEO changes applied by the platform, enabling granular revert capabilities
 * and automatic rollback triggers based on traffic/ranking metrics.
 */
import {
  pgTable,
  text,
  uuid,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { clients } from "./client-schema";
import { siteConnections } from "./connection-schema";

/**
 * site_changes table - tracks every SEO change applied.
 * Core of the granular revert system.
 */
export const siteChanges = pgTable(
  "site_changes",
  {
    id: text("id").primaryKey(),
    clientId: uuid("client_id")
      .references(() => clients.id, { onDelete: "set null" }),
    connectionId: text("connection_id")
      .references(() => siteConnections.id, { onDelete: "set null" }),

    // Classification
    changeType: text("change_type").notNull(), // 'meta_title', 'meta_description', 'h1', 'image_alt', etc.
    category: text("category").notNull(), // 'meta_tags', 'headings', 'images', 'links', etc.
    resourceType: text("resource_type").notNull(), // 'post', 'page', 'product', 'collection', 'image'
    resourceId: text("resource_id").notNull(), // Platform-specific resource ID
    resourceUrl: text("resource_url").notNull(), // Full URL of the resource

    // Change details
    field: text("field").notNull(), // Specific field changed
    beforeValue: text("before_value"), // Value before change (nullable for new additions)
    afterValue: text("after_value"), // Value after change (nullable for deletions)
    beforeSnapshot: jsonb("before_snapshot").$type<Record<string, unknown>>(), // Full object before
    afterSnapshot: jsonb("after_snapshot").$type<Record<string, unknown>>(), // Full object after

    // Provenance
    triggeredBy: text("triggered_by").notNull(), // 'audit', 'manual', 'scheduled', 'ai_suggestion', 'revert'
    auditId: text("audit_id"), // FK to audits (if from audit)
    findingId: text("finding_id"), // FK to audit_findings (if from finding)
    userId: text("user_id"), // Who approved (null if auto-approved)

    // Status
    status: text("status").notNull().default("pending"), // 'pending', 'applied', 'verified', 'reverted', 'failed'
    appliedAt: timestamp("applied_at", { withTimezone: true, mode: "date" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true, mode: "date" }),
    revertedAt: timestamp("reverted_at", { withTimezone: true, mode: "date" }),
    revertedByChangeId: text("reverted_by_change_id"), // FK to the revert change record

    // Batch grouping
    batchId: text("batch_id"), // Group related changes for batch operations
    batchSequence: integer("batch_sequence"), // Order within batch

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),

    // Soft delete - preserves SEO change history for rollback
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("ix_site_changes_client").on(table.clientId),
    index("ix_site_changes_connection").on(table.connectionId),
    index("ix_site_changes_category").on(table.category),
    index("ix_site_changes_status").on(table.status),
    index("ix_site_changes_resource").on(table.resourceId, table.resourceType),
    index("ix_site_changes_batch").on(table.batchId),
    index("ix_site_changes_created").on(table.createdAt),
    index("ix_site_changes_reverted").on(table.revertedAt),
    index("ix_site_changes_deleted").on(table.isDeleted),
    // H-02: Site change status must be valid enum value
    check("chk_site_change_status_valid", sql`status IN ('pending', 'applied', 'verified', 'reverted', 'failed')`),
  ]
);

/**
 * change_backups table - stores point-in-time snapshots before changes.
 * Used for safe rollback to a known-good state.
 */
export const changeBackups = pgTable(
  "change_backups",
  {
    id: text("id").primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // Scope
    scope: text("scope").notNull(), // 'page', 'site', 'category'
    resourceIds: jsonb("resource_ids").$type<string[]>(), // Array of resource IDs included

    // Backup data
    snapshotData: jsonb("snapshot_data").$type<{
      pages?: Array<{
        resourceId: string;
        resourceUrl: string;
        resourceType: string;
        fields: Record<string, unknown>;
        capturedAt: string;
      }>;
      settings?: Array<{
        key: string;
        value: unknown;
        capturedAt: string;
      }>;
    }>(),

    // Metadata
    createdBeforeChangeId: text("created_before_change_id"), // FK to site_changes
    sizeBytes: integer("size_bytes"),

    // Retention
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }),
    isPinned: boolean("is_pinned").notNull().default(false), // Never auto-delete if pinned

    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_change_backups_client").on(table.clientId),
    index("ix_change_backups_expires").on(table.expiresAt),
    index("ix_change_backups_scope").on(table.scope),
  ]
);

/**
 * rollback_triggers table - defines automatic rollback conditions.
 * When a trigger fires, rolls back specified change scope.
 */
export const rollbackTriggers = pgTable(
  "rollback_triggers",
  {
    id: text("id").primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),

    // Trigger config
    triggerType: text("trigger_type").notNull(), // 'traffic_drop', 'ranking_drop', 'error_spike', 'manual'
    config: jsonb("config").$type<{
      type: string;
      threshold?: number;
      comparisonPeriod?: string;
      minimumBaseline?: number;
      cooldownHours?: number;
      keywords?: string[] | "all_tracked";
      positionDrop?: number;
      minimumKeywords?: number;
      errorTypes?: string[];
    }>(),

    // Rollback scope
    rollbackScope: jsonb("rollback_scope").$type<{
      type:
        | "single"
        | "field"
        | "resource"
        | "category"
        | "batch"
        | "date_range"
        | "audit"
        | "full";
      changeId?: string;
      resourceId?: string;
      field?: string;
      category?: string;
      batchId?: string;
      from?: string;
      to?: string;
      auditId?: string;
    }>(),

    // Status
    isEnabled: boolean("is_enabled").notNull().default(true),
    lastTriggeredAt: timestamp("last_triggered_at", {
      withTimezone: true,
      mode: "date",
    }),
    lastCheckAt: timestamp("last_check_at", {
      withTimezone: true,
      mode: "date",
    }),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_rollback_triggers_client").on(table.clientId),
    index("ix_rollback_triggers_type").on(table.triggerType),
    index("ix_rollback_triggers_enabled").on(table.isEnabled),
  ]
);

// Relations
export const siteChangesRelations = relations(siteChanges, ({ one }) => ({
  client: one(clients, {
    fields: [siteChanges.clientId],
    references: [clients.id],
  }),
  connection: one(siteConnections, {
    fields: [siteChanges.connectionId],
    references: [siteConnections.id],
  }),
  revertedBy: one(siteChanges, {
    fields: [siteChanges.revertedByChangeId],
    references: [siteChanges.id],
  }),
}));

export const changeBackupsRelations = relations(changeBackups, ({ one }) => ({
  client: one(clients, {
    fields: [changeBackups.clientId],
    references: [clients.id],
  }),
}));

export const rollbackTriggersRelations = relations(
  rollbackTriggers,
  ({ one }) => ({
    client: one(clients, {
      fields: [rollbackTriggers.clientId],
      references: [clients.id],
    }),
  })
);

// Inferred types for database operations
export type SiteChangeSelect = typeof siteChanges.$inferSelect;
export type SiteChangeInsert = typeof siteChanges.$inferInsert;
export type ChangeBackupSelect = typeof changeBackups.$inferSelect;
export type ChangeBackupInsert = typeof changeBackups.$inferInsert;
export type RollbackTriggerSelect = typeof rollbackTriggers.$inferSelect;
export type RollbackTriggerInsert = typeof rollbackTriggers.$inferInsert;

// Constants
export const CHANGE_STATUS = [
  "pending",
  "applied",
  "verified",
  "reverted",
  "failed",
] as const;
export type ChangeStatus = (typeof CHANGE_STATUS)[number];

export const CHANGE_TYPES = [
  "meta_title",
  "meta_description",
  "og_tags",
  "canonical",
  "h1",
  "headings",
  "image_alt",
  "image_dimensions",
  "url_slug",
  "internal_link",
  "external_link",
  "schema_markup",
  "content_body",
  "robots_meta",
  "lazy_loading",
] as const;
export type ChangeType = (typeof CHANGE_TYPES)[number];

export const TRIGGER_TYPES = [
  "traffic_drop",
  "ranking_drop",
  "error_spike",
  "manual",
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];
