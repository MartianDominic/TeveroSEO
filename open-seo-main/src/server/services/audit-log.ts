/**
 * Audit logging service for security and compliance.
 * Phase 72-03: Monitoring & Observability
 *
 * Fire-and-forget audit logging for sensitive operations.
 * Non-blocking to avoid impacting request latency.
 */
import { db } from "@/db";
import {
  auditLogs,
  AUDIT_ACTIONS,
  AUDIT_RETENTION_DAYS,
  type AuditAction,
  type AuditResource,
  type AuditLogInsert,
} from "@/db/schema";
import { lt } from "drizzle-orm";

interface AuditContext {
  workspaceId: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

interface AuditEntry {
  action: AuditAction;
  resourceType: AuditResource;
  resourceId?: string;
  previousValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
}

/**
 * Audit log service for recording sensitive operations.
 */
export const auditLogService = {
  /**
   * Log an audit event (fire-and-forget).
   * Does not throw on failure - errors are logged but not propagated.
   */
  async log(ctx: AuditContext, entry: AuditEntry): Promise<void> {
    try {
      const record: AuditLogInsert = {
        id: crypto.randomUUID(),
        workspaceId: ctx.workspaceId,
        userId: ctx.userId,
        action: entry.action,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        previousValue: entry.previousValue,
        newValue: entry.newValue,
        metadata: {
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
          requestId: ctx.requestId,
        },
      };

      await db.insert(auditLogs).values(record);
    } catch (error) {
      console.error("[AuditLog] Failed to record audit event:", error);
    }
  },

  /**
   * Log client creation.
   */
  async logClientCreate(
    ctx: AuditContext,
    clientId: string,
    clientData: Record<string, unknown>
  ): Promise<void> {
    await this.log(ctx, {
      action: "client.create",
      resourceType: "client",
      resourceId: clientId,
      newValue: sanitizeForAudit(clientData),
    });
  },

  /**
   * Log client update.
   */
  async logClientUpdate(
    ctx: AuditContext,
    clientId: string,
    previousData: Record<string, unknown>,
    newData: Record<string, unknown>
  ): Promise<void> {
    await this.log(ctx, {
      action: "client.update",
      resourceType: "client",
      resourceId: clientId,
      previousValue: sanitizeForAudit(previousData),
      newValue: sanitizeForAudit(newData),
    });
  },

  /**
   * Log client deletion.
   */
  async logClientDelete(
    ctx: AuditContext,
    clientId: string,
    clientData: Record<string, unknown>
  ): Promise<void> {
    await this.log(ctx, {
      action: "client.delete",
      resourceType: "client",
      resourceId: clientId,
      previousValue: sanitizeForAudit(clientData),
    });
  },

  /**
   * Log settings change.
   */
  async logSettingsUpdate(
    ctx: AuditContext,
    settingKey: string,
    previousValue: unknown,
    newValue: unknown
  ): Promise<void> {
    await this.log(ctx, {
      action: "settings.update",
      resourceType: "settings",
      resourceId: settingKey,
      previousValue: { value: previousValue },
      newValue: { value: newValue },
    });
  },

  /**
   * Log API key creation.
   */
  async logApiKeyCreate(
    ctx: AuditContext,
    keyId: string,
    keyName: string
  ): Promise<void> {
    await this.log(ctx, {
      action: "api_key.create",
      resourceType: "api_key",
      resourceId: keyId,
      newValue: { name: keyName },
    });
  },

  /**
   * Log API key revocation.
   */
  async logApiKeyRevoke(
    ctx: AuditContext,
    keyId: string,
    keyName: string
  ): Promise<void> {
    await this.log(ctx, {
      action: "api_key.revoke",
      resourceType: "api_key",
      resourceId: keyId,
      previousValue: { name: keyName },
    });
  },

  /**
   * Log user role change.
   */
  async logUserRoleChange(
    ctx: AuditContext,
    targetUserId: string,
    previousRole: string,
    newRole: string
  ): Promise<void> {
    await this.log(ctx, {
      action: "user.role_change",
      resourceType: "user",
      resourceId: targetUserId,
      previousValue: { role: previousRole },
      newValue: { role: newRole },
    });
  },

  /**
   * Log data export.
   */
  async logDataExport(
    ctx: AuditContext,
    exportType: string,
    recordCount: number
  ): Promise<void> {
    await this.log(ctx, {
      action: "export.data",
      resourceType: "workspace",
      resourceId: ctx.workspaceId,
      newValue: { type: exportType, recordCount },
    });
  },

  /**
   * Cleanup old audit logs (retention policy).
   * Should be called by scheduled job.
   */
  async cleanupOldLogs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - AUDIT_RETENTION_DAYS);

    const result = await db
      .delete(auditLogs)
      .where(lt(auditLogs.createdAt, cutoffDate));

    return result.rowCount ?? 0;
  },

  /**
   * Get valid audit actions for validation.
   */
  getValidActions(): readonly string[] {
    return AUDIT_ACTIONS;
  },
};

/**
 * Sanitize data for audit logging.
 * Removes sensitive fields that should not be logged.
 */
function sanitizeForAudit(
  data: Record<string, unknown>
): Record<string, unknown> {
  const sensitiveKeys = [
    "password",
    "secret",
    "token",
    "apiKey",
    "api_key",
    "accessToken",
    "access_token",
    "refreshToken",
    "refresh_token",
    "encryptedCredentials",
    "encrypted_credentials",
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeForAudit(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export type { AuditContext, AuditEntry };
