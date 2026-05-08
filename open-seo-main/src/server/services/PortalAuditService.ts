/**
 * Portal Audit Service
 * Phase 96: CPR-006
 *
 * Provides non-blocking audit logging for portal client activities.
 * All logging is async to avoid impacting portal request latency.
 *
 * Usage:
 * ```ts
 * import { portalAuditService } from '@/server/services/PortalAuditService';
 *
 * // In route handler after successful response
 * portalAuditService.logAsync({
 *   clientId,
 *   workspaceId,
 *   action: 'view_dashboard',
 *   request,
 * });
 * ```
 */
import { db } from "@/db";
import {
  portalAuditLog,
  type PortalAction,
  type PortalResource,
  type PortalAuditMetadata,
} from "@/db/portal-audit-log-schema";
import { createLogger } from "@/server/lib/logger";
import { eq, and, desc, gte, sql } from "drizzle-orm";

const logger = createLogger({ module: "portal-audit" });

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters for logging a portal action.
 */
export interface PortalAuditLogParams {
  clientId: string;
  workspaceId: string;
  action: PortalAction;
  resourceType?: PortalResource;
  resourceId?: string;
  metadata?: PortalAuditMetadata;
  request?: Request;
}

/**
 * Query options for fetching audit logs.
 */
export interface PortalAuditQueryOptions {
  clientId?: string;
  workspaceId: string;
  action?: PortalAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Audit log entry returned from queries.
 */
export interface PortalAuditEntry {
  id: string;
  clientId: string;
  workspaceId: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  metadata: PortalAuditMetadata | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract client IP from request headers.
 * Handles common proxy headers (X-Forwarded-For, CF-Connecting-IP, etc.)
 */
function getClientIp(request?: Request): string | undefined {
  if (!request) return undefined;

  // Check common proxy headers in order of preference
  const headers = [
    "cf-connecting-ip", // Cloudflare
    "x-real-ip", // nginx
    "x-forwarded-for", // Standard proxy header
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // X-Forwarded-For can contain multiple IPs, take the first
      return value.split(",")[0].trim();
    }
  }

  return undefined;
}

/**
 * Get user agent from request.
 */
function getUserAgent(request?: Request): string | undefined {
  return request?.headers.get("user-agent") ?? undefined;
}

// ============================================================================
// Service Class
// ============================================================================

/**
 * Service for logging and querying portal audit entries.
 */
export class PortalAuditService {
  /**
   * Log a portal action asynchronously (non-blocking).
   *
   * This method fires and forgets - it won't block the caller or throw.
   * Any errors are logged but not propagated.
   *
   * @param params - Audit log parameters
   */
  logAsync(params: PortalAuditLogParams): void {
    // Fire and forget - don't await
    this.log(params).catch((error) => {
      logger.warn("Failed to log portal audit entry", {
        action: params.action,
        clientId: params.clientId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  /**
   * Log a portal action (awaitable version).
   *
   * Use this when you need to ensure the log was written before continuing.
   *
   * @param params - Audit log parameters
   * @returns The created audit log ID
   */
  async log(params: PortalAuditLogParams): Promise<string> {
    const { clientId, workspaceId, action, resourceType, resourceId, metadata, request } =
      params;

    const [entry] = await db
      .insert(portalAuditLog)
      .values({
        clientId,
        workspaceId,
        action,
        resourceType: resourceType ?? null,
        resourceId: resourceId ?? null,
        metadata: metadata ?? {},
        ipAddress: getClientIp(request) ?? null,
        userAgent: getUserAgent(request) ?? null,
      })
      .returning({ id: portalAuditLog.id });

    logger.debug("Portal audit logged", {
      id: entry.id,
      action,
      clientId: clientId.slice(0, 8) + "...",
    });

    return entry.id;
  }

  /**
   * Query audit logs for a client or workspace.
   *
   * @param options - Query options
   * @returns Array of audit entries
   */
  async query(options: PortalAuditQueryOptions): Promise<PortalAuditEntry[]> {
    const { clientId, workspaceId, action, startDate, endDate, limit = 50, offset = 0 } =
      options;

    // Build WHERE conditions
    const conditions = [eq(portalAuditLog.workspaceId, workspaceId)];

    if (clientId) {
      conditions.push(eq(portalAuditLog.clientId, clientId));
    }

    if (action) {
      conditions.push(eq(portalAuditLog.action, action));
    }

    if (startDate) {
      conditions.push(gte(portalAuditLog.createdAt, startDate));
    }

    if (endDate) {
      conditions.push(sql`${portalAuditLog.createdAt} <= ${endDate}`);
    }

    const entries = await db
      .select()
      .from(portalAuditLog)
      .where(and(...conditions))
      .orderBy(desc(portalAuditLog.createdAt))
      .limit(limit)
      .offset(offset);

    return entries.map((entry) => ({
      ...entry,
      metadata: entry.metadata as PortalAuditMetadata | null,
    }));
  }

  /**
   * Get recent activity for a client (last N entries).
   *
   * @param clientId - Client ID
   * @param workspaceId - Workspace ID
   * @param limit - Maximum entries to return (default 20)
   * @returns Recent audit entries
   */
  async getRecentActivity(
    clientId: string,
    workspaceId: string,
    limit = 20
  ): Promise<PortalAuditEntry[]> {
    return this.query({ clientId, workspaceId, limit });
  }

  /**
   * Get activity summary for a client within a date range.
   *
   * @param clientId - Client ID
   * @param workspaceId - Workspace ID
   * @param startDate - Start of range
   * @param endDate - End of range
   * @returns Activity counts by action
   */
  async getActivitySummary(
    clientId: string,
    workspaceId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Record<string, number>> {
    const result = await db
      .select({
        action: portalAuditLog.action,
        count: sql<number>`count(*)::int`,
      })
      .from(portalAuditLog)
      .where(
        and(
          eq(portalAuditLog.clientId, clientId),
          eq(portalAuditLog.workspaceId, workspaceId),
          gte(portalAuditLog.createdAt, startDate),
          sql`${portalAuditLog.createdAt} <= ${endDate}`
        )
      )
      .groupBy(portalAuditLog.action);

    return Object.fromEntries(result.map((r) => [r.action, r.count]));
  }
}

// Default singleton instance
export const portalAuditService = new PortalAuditService();

/**
 * Factory function for testing.
 */
export function createPortalAuditService(): PortalAuditService {
  return new PortalAuditService();
}
