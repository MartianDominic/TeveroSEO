/**
 * Portal Audit Log Schema
 * Phase 96: CPR-006
 *
 * Tracks client portal activities for agency monitoring.
 * Records all client interactions including:
 * - Dashboard views
 * - Report exports
 * - Keyword views
 * - Settings changes
 *
 * Security:
 * - IP address captured for access tracking
 * - User agent stored for device identification
 * - 90-day retention (matches main audit log)
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { clients } from "./client-schema";
import { organization } from "./user-schema";

/**
 * Portal action types for categorizing activities.
 */
export const PORTAL_ACTIONS = [
  // Dashboard
  "view_dashboard",
  "view_metrics",

  // Reports
  "view_report",
  "export_csv",
  "export_sheets",
  "export_pdf",

  // Keywords
  "view_keywords",
  "view_keyword_details",

  // Trends & Analysis
  "view_growing_keywords",
  "view_decaying_keywords",
  "view_cannibalization",

  // Settings
  "view_settings",
  "update_notifications",

  // Auth
  "portal_login",
  "portal_logout",
  "session_extended",
] as const;
export type PortalAction = (typeof PORTAL_ACTIONS)[number];

/**
 * Portal resource types that can be accessed.
 */
export const PORTAL_RESOURCES = [
  "dashboard",
  "report",
  "keyword",
  "export",
  "settings",
  "session",
] as const;
export type PortalResource = (typeof PORTAL_RESOURCES)[number];

/**
 * Metadata type for audit log entries.
 * Contains contextual information about the action.
 */
export interface PortalAuditMetadata {
  // Export metadata
  exportFormat?: "csv" | "sheets" | "pdf";
  exportRowCount?: number;

  // Report metadata
  reportType?: string;
  dateRange?: { start: string; end: string };

  // Keyword metadata
  keywordId?: string;
  keywordQuery?: string;

  // Session metadata
  sessionId?: string;
  tokenId?: string;

  // Request context
  queryParams?: Record<string, string>;

  // Generic extension point
  [key: string]: unknown;
}

/**
 * portal_audit_log table - client activity tracking.
 *
 * Records all portal interactions for agency visibility.
 * Immutable: rows are never updated or deleted (except by retention job).
 *
 * Performance considerations:
 * - Uses async inserts to not block portal requests
 * - Composite indexes for common query patterns
 * - 90-day retention to manage table size
 */
export const portalAuditLog = pgTable(
  "portal_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Client and workspace context
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),

    // Action details
    action: text("action").notNull(),
    resourceType: text("resource_type"),
    resourceId: text("resource_id"),

    // Additional context
    metadata: jsonb("metadata").$type<PortalAuditMetadata>().default({}),

    // Request context (for security/forensics)
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),

    // Timestamp
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Primary query pattern: client activities by date
    index("ix_portal_audit_client_created").on(
      table.clientId,
      table.createdAt.desc()
    ),

    // Agency view: all client activities
    index("ix_portal_audit_workspace_created").on(
      table.workspaceId,
      table.createdAt.desc()
    ),

    // Filter by action type
    index("ix_portal_audit_action").on(table.action),

    // Retention cleanup index
    index("ix_portal_audit_created").on(table.createdAt),

    // Validate action is a known type
    check(
      "chk_portal_audit_action_valid",
      sql`action IN (
        'view_dashboard', 'view_metrics',
        'view_report', 'export_csv', 'export_sheets', 'export_pdf',
        'view_keywords', 'view_keyword_details',
        'view_growing_keywords', 'view_decaying_keywords', 'view_cannibalization',
        'view_settings', 'update_notifications',
        'portal_login', 'portal_logout', 'session_extended'
      )`
    ),
  ]
);

/**
 * Relations for type-safe queries.
 */
export const portalAuditLogRelations = relations(portalAuditLog, ({ one }) => ({
  client: one(clients, {
    fields: [portalAuditLog.clientId],
    references: [clients.id],
  }),
  workspace: one(organization, {
    fields: [portalAuditLog.workspaceId],
    references: [organization.id],
  }),
}));

// Type exports
export type PortalAuditLogSelect = typeof portalAuditLog.$inferSelect;
export type PortalAuditLogInsert = typeof portalAuditLog.$inferInsert;

/**
 * Retention period in days (matches main audit log).
 */
export const PORTAL_AUDIT_RETENTION_DAYS = 90;
