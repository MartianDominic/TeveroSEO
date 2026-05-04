/**
 * Audit logs schema for security and compliance.
 * Phase 72-03: Monitoring & Observability
 *
 * Logs sensitive operations for security audit and compliance.
 * 90-day retention policy enforced by cleanup job.
 */
import { pgTable, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { organization } from "../user-schema";

/**
 * Audit action types for categorizing operations.
 */
export const AUDIT_ACTIONS = [
  "client.create",
  "client.update",
  "client.delete",
  "client.archive",
  "settings.update",
  "credentials.create",
  "credentials.update",
  "credentials.delete",
  "api_key.create",
  "api_key.revoke",
  "user.invite",
  "user.remove",
  "user.role_change",
  "export.data",
  "import.data",
  "auth.login",
  "auth.logout",
  "auth.failed_login",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Resource types that can be audited.
 */
export const AUDIT_RESOURCES = [
  "client",
  "workspace",
  "user",
  "api_key",
  "credentials",
  "settings",
  "report",
  "proposal",
  "contract",
] as const;
export type AuditResource = (typeof AUDIT_RESOURCES)[number];

/**
 * audit_logs table - immutable security audit trail.
 *
 * Records all sensitive operations for compliance and forensics.
 * Append-only: rows are never updated or deleted (except by retention job).
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    userId: text("user_id"), // null for system operations
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: text("resource_id"),
    previousValue: jsonb("previous_value").$type<Record<string, unknown>>(),
    newValue: jsonb("new_value").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata")
      .$type<{
        ipAddress?: string;
        userAgent?: string;
        requestId?: string;
      }>()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("ix_audit_workspace_created").on(
      table.workspaceId,
      table.createdAt.desc()
    ),
    index("ix_audit_user").on(table.userId),
    index("ix_audit_action").on(table.action),
    index("ix_audit_resource").on(table.resourceType, table.resourceId),
    index("ix_audit_created").on(table.createdAt),
  ]
);

/**
 * Relations for type-safe queries.
 */
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  workspace: one(organization, {
    fields: [auditLogs.workspaceId],
    references: [organization.id],
  }),
}));

/**
 * Type exports for select and insert operations.
 */
export type AuditLogSelect = typeof auditLogs.$inferSelect;
export type AuditLogInsert = typeof auditLogs.$inferInsert;

/**
 * Retention period in days.
 */
export const AUDIT_RETENTION_DAYS = 90;
