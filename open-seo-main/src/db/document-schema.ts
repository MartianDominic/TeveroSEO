/**
 * Document management schema.
 * Phase 101: Direct Proposal & Manual Deal Pipeline (D-04)
 *
 * Provides document storage with Google Drive integration:
 * - Flexible sync modes (two_way_sync, import_copy, link_only)
 * - Version tracking for uploaded files
 * - Smart reminder automation
 *
 * Storage Architecture:
 * - Hybrid: PostgreSQL metadata + Google Drive integration
 * - Dual views: Files attached to deals AND viewable as client folder
 */
import {
  pgTable,
  text,
  integer,
  timestamp,
  jsonb,
  index,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { organization } from "./user-schema";
import { clients } from "./client-schema";
import { prospects } from "./prospect-schema";
import { proposals } from "./proposal-schema";
import { softDeleteColumns } from "./soft-delete-columns";

// ============================================================================
// Enums
// ============================================================================

/**
 * Document sync modes with Google Drive.
 * - two_way_sync: Changes reflect in both places
 * - import_copy: File copied to TeveroSEO, Drive link maintained
 * - link_only: Just store URL, file stays in Drive
 */
export const DOCUMENT_SYNC_MODES = ["two_way_sync", "import_copy", "link_only"] as const;
export type DocumentSyncMode = (typeof DOCUMENT_SYNC_MODES)[number];

/**
 * Reminder types for smart automation.
 * - unopened: Document hasn't been viewed after X days
 * - expiring: Document expires soon
 * - follow_up: Scheduled follow-up reminder
 * - re_engagement: Opened after dormant period
 */
export const REMINDER_TYPES = ["unopened", "expiring", "follow_up", "re_engagement"] as const;
export type ReminderType = (typeof REMINDER_TYPES)[number];

/**
 * Reminder status for scheduling.
 */
export const REMINDER_STATUS = ["pending", "sent", "cancelled"] as const;
export type ReminderStatus = (typeof REMINDER_STATUS)[number];

// ============================================================================
// Documents Table
// ============================================================================

/**
 * Documents table - stores metadata for all client documents.
 *
 * Can be linked to:
 * - A client (general document storage)
 * - A prospect (pre-conversion documents)
 * - A proposal (proposal-specific documents)
 *
 * Google Drive integration via driveFileId/driveFolderId fields.
 */
export const documents = pgTable(
  "documents",
  {
    id: text("id").primaryKey(),

    // Workspace scoping (required for tenant isolation)
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Entity links (all nullable for flexibility)
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    prospectId: text("prospect_id").references(() => prospects.id, { onDelete: "set null" }),
    proposalId: text("proposal_id").references(() => proposals.id, { onDelete: "set null" }),

    // File metadata
    name: text("name").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),

    // Google Drive integration
    driveFileId: text("drive_file_id"), // Google Drive file ID
    driveFolderId: text("drive_folder_id"), // Parent folder in Drive
    syncMode: text("sync_mode").notNull().default("link_only"),

    // Local storage (for import_copy mode)
    localPath: text("local_path"),

    // External URL (for link_only mode)
    externalUrl: text("external_url"),

    // Sync tracking
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true, mode: "date" }),

    // View tracking
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true, mode: "date" }),

    // Standard timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),

    // Audit trail
    createdBy: text("created_by"),

    // Soft delete (7-year retention for audit compliance)
    ...softDeleteColumns,
  },
  (table) => [
    index("ix_documents_workspace").on(table.workspaceId),
    index("ix_documents_client").on(table.clientId),
    index("ix_documents_proposal").on(table.proposalId),
    index("ix_documents_drive_file").on(table.driveFileId),
    index("ix_documents_soft_deleted").on(table.softDeletedAt),
    check(
      "chk_document_sync_mode",
      sql`sync_mode IN ('two_way_sync', 'import_copy', 'link_only')`
    ),
  ]
);

// ============================================================================
// Document Versions Table
// ============================================================================

/**
 * Document versions - tracks version history for imported documents.
 *
 * Each version stores:
 * - Version number (incrementing)
 * - Drive revision ID (if synced)
 * - Local snapshot path (for import_copy mode)
 */
export const documentVersions = pgTable(
  "document_versions",
  {
    id: text("id").primaryKey(),

    // Parent document
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),

    // Version info
    versionNumber: integer("version_number").notNull(),
    driveRevisionId: text("drive_revision_id"), // Google Drive revision ID

    // File data
    sizeBytes: integer("size_bytes"),
    snapshotPath: text("snapshot_path"), // Local path for import_copy

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    createdBy: text("created_by"),
  },
  (table) => [
    index("ix_doc_versions_document").on(table.documentId),
    unique("uq_doc_versions_document_version").on(table.documentId, table.versionNumber),
  ]
);

// ============================================================================
// Document Reminders Table
// ============================================================================

/**
 * Document reminders - tracks smart automation for document follow-ups.
 *
 * Per D-04: Smart automation surfaces documents needing attention.
 *
 * Types:
 * - unopened: Configurable reminders for unopened documents
 * - expiring: Document expiration handling
 * - follow_up: Scheduled follow-up reminders
 * - re_engagement: Alerts when document opened after dormant period
 */
export const documentReminders = pgTable(
  "document_reminders",
  {
    id: text("id").primaryKey(),

    // Parent document
    documentId: text("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),

    // Reminder configuration
    reminderType: text("reminder_type").notNull(),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true, mode: "date" }).notNull(),

    // Execution tracking
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }),
    status: text("status").notNull().default("pending"),

    // Extra context (e.g., { unopened_days: 3, reason: "Client requested callback" })
    metadata: jsonb("metadata").default(sql`'{}'::jsonb`),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_doc_reminders_document").on(table.documentId),
    index("ix_doc_reminders_scheduled").on(table.scheduledFor, table.status), // For BullMQ polling
    check(
      "chk_reminder_type",
      sql`reminder_type IN ('unopened', 'expiring', 'follow_up', 're_engagement')`
    ),
    check(
      "chk_reminder_status",
      sql`status IN ('pending', 'sent', 'cancelled')`
    ),
  ]
);

// ============================================================================
// Relations
// ============================================================================

export const documentsRelations = relations(documents, ({ one, many }) => ({
  workspace: one(organization, {
    fields: [documents.workspaceId],
    references: [organization.id],
  }),
  client: one(clients, {
    fields: [documents.clientId],
    references: [clients.id],
  }),
  prospect: one(prospects, {
    fields: [documents.prospectId],
    references: [prospects.id],
  }),
  proposal: one(proposals, {
    fields: [documents.proposalId],
    references: [proposals.id],
  }),
  versions: many(documentVersions),
  reminders: many(documentReminders),
}));

export const documentVersionsRelations = relations(documentVersions, ({ one }) => ({
  document: one(documents, {
    fields: [documentVersions.documentId],
    references: [documents.id],
  }),
}));

export const documentRemindersRelations = relations(documentReminders, ({ one }) => ({
  document: one(documents, {
    fields: [documentReminders.documentId],
    references: [documents.id],
  }),
}));

// ============================================================================
// Type Exports
// ============================================================================

export type DocumentSelect = typeof documents.$inferSelect;
export type DocumentInsert = typeof documents.$inferInsert;
export type DocumentVersionSelect = typeof documentVersions.$inferSelect;
export type DocumentVersionInsert = typeof documentVersions.$inferInsert;
export type DocumentReminderSelect = typeof documentReminders.$inferSelect;
export type DocumentReminderInsert = typeof documentReminders.$inferInsert;
