/**
 * Audit logging for data mutations.
 *
 * Provides comprehensive audit trail for sensitive data operations.
 * Tracks who changed what, when, and the before/after values.
 *
 * Security: Audit logs are protected by RLS (admin-only access).
 */

import {
  pgTable,
  varchar,
  timestamp,
  jsonb,
  uuid,
  text,
  index,
} from "drizzle-orm/pg-core";
import { db } from "./index";
import { sql, desc, eq, and } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "audit" });

// Audit log table schema
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // What changed
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: varchar("entity_id", { length: 255 }).notNull(),
    action: varchar("action", { length: 50 }).notNull(), // create, update, delete, read_sensitive

    // Who made the change
    userId: varchar("user_id", { length: 255 }),
    userEmail: varchar("user_email", { length: 255 }),
    organizationId: varchar("organization_id", { length: 255 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),

    // Change details
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),
    changedFields: jsonb("changed_fields").$type<string[]>(),

    // Context
    requestId: varchar("request_id", { length: 255 }),
    metadata: jsonb("metadata"),

    // Timestamps
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("ix_audit_logs_entity").on(table.entityType, table.entityId),
    index("ix_audit_logs_user").on(table.userId),
    index("ix_audit_logs_org").on(table.organizationId),
    index("ix_audit_logs_action").on(table.action),
    index("ix_audit_logs_created").on(table.createdAt),
  ]
);

export type AuditAction = "create" | "update" | "delete" | "read_sensitive";

export type AuditLogSelect = typeof auditLogs.$inferSelect;
export type AuditLogInsert = typeof auditLogs.$inferInsert;

// Fields that should be redacted in audit logs (sensitive data)
const REDACTED_FIELDS = new Set([
  "password",
  "passwordHash",
  "secret",
  "secretKey",
  "apiKey",
  "keyHash",
  "refreshToken",
  "accessToken",
  "gscRefreshToken",
  "privateKey",
  "credentials",
]);

interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: AuditAction;
  userId?: string;
  userEmail?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

/**
 * Redact sensitive fields from values before logging.
 */
function redactSensitiveFields(
  values: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!values) return undefined;

  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    if (REDACTED_FIELDS.has(key)) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      redacted[key] = redactSensitiveFields(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Determine which fields changed between old and new values.
 */
function getChangedFields(
  oldValues: Record<string, unknown>,
  newValues: Record<string, unknown>
): string[] {
  const changed: string[] = [];

  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of allKeys) {
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      changed.push(key);
    }
  }

  return changed;
}

/**
 * Log an audit entry.
 * Automatically redacts sensitive fields and calculates changed fields.
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  const redactedOld = redactSensitiveFields(entry.oldValues);
  const redactedNew = redactSensitiveFields(entry.newValues);

  const changedFields =
    entry.oldValues && entry.newValues
      ? getChangedFields(entry.oldValues, entry.newValues)
      : undefined;

  try {
    await db.insert(auditLogs).values({
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      userId: entry.userId,
      userEmail: entry.userEmail,
      organizationId: entry.organizationId,
      ipAddress: entry.ipAddress,
      userAgent: entry.userAgent,
      oldValues: redactedOld,
      newValues: redactedNew,
      changedFields,
      requestId: entry.requestId,
      metadata: entry.metadata,
    });
  } catch (error) {
    // Log audit failures to stderr but don't throw
    // Audit logging should not break the main operation
    // SECURITY: Redact entry before logging to prevent sensitive data exposure
    const safeEntry = {
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      userId: entry.userId ? `${entry.userId.substring(0, 8)}***` : undefined,
      organizationId: entry.organizationId,
      // Omit oldValues, newValues, metadata which may contain sensitive data
      hasOldValues: !!entry.oldValues,
      hasNewValues: !!entry.newValues,
      hasMetadata: !!entry.metadata,
    };
    log.error("Failed to log audit entry", error instanceof Error ? error : new Error(String(error)), safeEntry);
  }
}

/**
 * Context for audit logging within a request.
 */
export interface AuditContext {
  userId?: string;
  userEmail?: string;
  organizationId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Create audit middleware for database operations.
 * Provides typed logging methods for create, update, delete, and sensitive reads.
 */
export function withAudit<T extends Record<string, unknown>>(
  entityType: string,
  context: AuditContext = {}
) {
  return {
    /**
     * Log a create operation.
     */
    async logCreate(
      entityId: string,
      values: T,
      metadata?: Record<string, unknown>
    ): Promise<void> {
      await logAudit({
        entityType,
        entityId,
        action: "create",
        ...context,
        newValues: values as Record<string, unknown>,
        metadata,
      });
    },

    /**
     * Log an update operation.
     */
    async logUpdate(
      entityId: string,
      oldValues: Partial<T>,
      newValues: Partial<T>,
      metadata?: Record<string, unknown>
    ): Promise<void> {
      await logAudit({
        entityType,
        entityId,
        action: "update",
        ...context,
        oldValues: oldValues as Record<string, unknown>,
        newValues: newValues as Record<string, unknown>,
        metadata,
      });
    },

    /**
     * Log a delete operation.
     */
    async logDelete(
      entityId: string,
      deletedValues?: T,
      metadata?: Record<string, unknown>
    ): Promise<void> {
      await logAudit({
        entityType,
        entityId,
        action: "delete",
        ...context,
        oldValues: deletedValues as Record<string, unknown>,
        metadata,
      });
    },

    /**
     * Log a sensitive data read operation.
     * Use for PII access, credential views, etc.
     */
    async logSensitiveRead(
      entityId: string,
      accessedFields: string[],
      metadata?: Record<string, unknown>
    ): Promise<void> {
      await logAudit({
        entityType,
        entityId,
        action: "read_sensitive",
        ...context,
        metadata: {
          ...metadata,
          accessedFields,
        },
      });
    },
  };
}

/**
 * Query audit logs for an entity.
 * Returns the most recent entries first.
 */
export async function getAuditHistory(
  entityType: string,
  entityId: string,
  limit = 50
): Promise<AuditLogSelect[]> {
  return db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

/**
 * Query audit logs for a user.
 * Useful for user activity reports.
 */
export async function getAuditHistoryByUser(
  userId: string,
  limit = 100
): Promise<AuditLogSelect[]> {
  return db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.userId, userId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

/**
 * Query audit logs for an organization.
 * Useful for compliance and security reviews.
 */
export async function getAuditHistoryByOrganization(
  organizationId: string,
  options: {
    entityType?: string;
    action?: AuditAction;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<AuditLogSelect[]> {
  const { limit = 100, entityType, action, startDate, endDate } = options;

  let whereClause = eq(auditLogs.organizationId, organizationId);

  if (entityType) {
    whereClause = and(whereClause, eq(auditLogs.entityType, entityType))!;
  }

  if (action) {
    whereClause = and(whereClause, eq(auditLogs.action, action))!;
  }

  // Note: Date filtering would need additional SQL conditions
  // For now, we rely on limit and post-filter if needed

  return db
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
