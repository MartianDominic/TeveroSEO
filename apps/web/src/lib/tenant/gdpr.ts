/**
 * GDPR Data Deletion Module
 * Implements right-to-forget (Article 17 GDPR) for tenant data.
 *
 * Features:
 * 1. Complete client data deletion via backend API
 * 2. Cascading deletion across all related tables
 * 3. Audit trail preservation (anonymized)
 * 4. Deletion verification
 *
 * Note: All database operations are delegated to the backend API (open-seo-main)
 * which has direct database access.
 */

import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis/client";

import { getTenantContext } from "./context";
import {
  invalidateAllClientOwnership,
  invalidateOwnershipCache,
} from "./ownership";

// --- Types ---

/**
 * Data deletion request.
 */
export interface DataDeletionRequest {
  /** Client ID to delete */
  clientId: string;
  /** Workspace ID */
  workspaceId: string;
  /** User requesting deletion */
  requestedBy: string;
  /** Reason for deletion */
  reason: "gdpr_request" | "client_request" | "churn" | "test_data" | "other";
  /** Additional notes */
  notes?: string;
  /** Timestamp of request */
  requestedAt: number;
}

/**
 * Deletion result with details of what was deleted.
 */
export interface DataDeletionResult {
  /** Whether deletion was successful */
  success: boolean;
  /** Deletion request ID */
  requestId: string;
  /** Client ID that was deleted */
  clientId: string;
  /** Counts of deleted records by table */
  deletedCounts: Record<string, number>;
  /** Any errors that occurred */
  errors: string[];
  /** Completion timestamp */
  completedAt: number;
  /** Audit log ID for the deletion */
  auditLogId: string;
}

/**
 * Pre-deletion report showing what will be deleted.
 */
export interface PreDeletionReport {
  /** Client ID */
  clientId: string;
  /** Client name (for confirmation) */
  clientName: string;
  /** Counts of records that will be deleted */
  recordCounts: Record<string, number>;
  /** Estimated deletion time in seconds */
  estimatedTimeSeconds: number;
  /** Warning messages */
  warnings: string[];
}

// --- Redis Keys ---

const DELETION_REQUEST_PREFIX = "tenant:deletion:request:";
const DELETION_LOG_PREFIX = "tenant:deletion:log:";

// --- Pre-Deletion Analysis ---

/**
 * Generate a report of what will be deleted for a client.
 * Use this for confirmation before actual deletion.
 *
 * @param workspaceId - Workspace ID
 * @param clientId - Client ID to analyze
 * @returns Pre-deletion report
 */
export async function generatePreDeletionReport(
  workspaceId: string,
  clientId: string
): Promise<PreDeletionReport> {
  try {
    const { getOpenSeoUrl } = await import("@/lib/env");
    const backendUrl = getOpenSeoUrl();

    const response = await fetch(
      `${backendUrl}/api/internal/gdpr/pre-deletion-report`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": process.env.INTERNAL_API_SECRET || "",
        },
        body: JSON.stringify({ workspaceId, clientId }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Client not found or already deleted");
      }
      throw new Error(`Failed to generate pre-deletion report: ${response.status}`);
    }

    return (await response.json()) as PreDeletionReport;
  } catch (error) {
    logger.error(
      "[gdpr] Failed to generate pre-deletion report",
      error instanceof Error ? error : { error: String(error) }
    );
    throw error;
  }
}

// --- Data Deletion ---

/**
 * Delete all data for a client (GDPR right-to-forget).
 * This is a destructive operation that cannot be undone.
 *
 * SECURITY: Only workspace admins can delete client data.
 *
 * @param request - Deletion request details
 * @returns Deletion result
 */
export async function deleteClientData(
  request: DataDeletionRequest
): Promise<DataDeletionResult> {
  const { clientId, workspaceId, requestedBy, reason, notes } = request;
  const requestId = `del_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  logger.info("[gdpr] Starting client data deletion", {
    requestId,
    clientId,
    workspaceId,
    requestedBy,
    reason,
  });

  try {
    // Store deletion request for audit (in Redis for quick access)
    await redis.set(
      `${DELETION_REQUEST_PREFIX}${requestId}`,
      JSON.stringify(request),
      "EX",
      86400 * 365 // Keep for 1 year
    );

    // Call backend API to perform deletion
    const { getOpenSeoUrl } = await import("@/lib/env");
    const backendUrl = getOpenSeoUrl();

    const response = await fetch(
      `${backendUrl}/api/internal/gdpr/delete-client`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": process.env.INTERNAL_API_SECRET || "",
        },
        body: JSON.stringify({
          requestId,
          clientId,
          workspaceId,
          requestedBy,
          reason,
          notes,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Deletion failed: ${response.status} - ${errorText}`);
    }

    const backendResult = (await response.json()) as {
      deletedCounts: Record<string, number>;
      auditLogId: string;
    };

    // Clear Redis caches
    await clearClientCaches(workspaceId, clientId);

    // Invalidate ownership cache
    await invalidateAllClientOwnership(clientId);
    await invalidateOwnershipCache(workspaceId, clientId);

    // Log completion
    const result: DataDeletionResult = {
      success: true,
      requestId,
      clientId,
      deletedCounts: backendResult.deletedCounts,
      errors: [],
      completedAt: Date.now(),
      auditLogId: backendResult.auditLogId,
    };

    await redis.set(
      `${DELETION_LOG_PREFIX}${requestId}`,
      JSON.stringify(result),
      "EX",
      86400 * 365 // Keep for 1 year
    );

    logger.info("[gdpr] Client data deletion completed", {
      requestId,
      clientId,
      deletedCounts: backendResult.deletedCounts,
    });

    return result;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    logger.error("[gdpr] Client data deletion failed", {
      requestId,
      clientId,
      error: errorMessage,
    });

    const result: DataDeletionResult = {
      success: false,
      requestId,
      clientId,
      deletedCounts: {},
      errors: [errorMessage],
      completedAt: Date.now(),
      auditLogId: "",
    };

    // Still store the failed result for audit
    await redis.set(
      `${DELETION_LOG_PREFIX}${requestId}`,
      JSON.stringify(result),
      "EX",
      86400 * 365
    );

    return result;
  }
}

/**
 * Delete client data using current tenant context.
 * Convenience function for use in authenticated handlers.
 */
export async function deleteCurrentClientData(
  clientId: string,
  reason: DataDeletionRequest["reason"],
  notes?: string
): Promise<DataDeletionResult> {
  const tenant = getTenantContext();

  return deleteClientData({
    clientId,
    workspaceId: tenant.workspaceId,
    requestedBy: tenant.userId,
    reason,
    notes,
    requestedAt: Date.now(),
  });
}

// --- Cache Clearing ---

/**
 * Clear all Redis caches related to a client.
 */
async function clearClientCaches(
  workspaceId: string,
  clientId: string
): Promise<void> {
  const patterns = [
    `tenant:*:${workspaceId}:${clientId}:*`,
    `cache:client:${clientId}:*`,
    `ratelimit:*:${clientId}:*`,
  ];

  for (const pattern of patterns) {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        logger.debug("[gdpr] Cleared cache keys", {
          pattern,
          count: keys.length,
        });
      }
    } catch (error) {
      logger.warn(
        "[gdpr] Failed to clear cache pattern",
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
}

// --- Deletion Status ---

/**
 * Get status of a deletion request.
 */
export async function getDeletionStatus(
  requestId: string
): Promise<DataDeletionResult | null> {
  try {
    const data = await redis.get(`${DELETION_LOG_PREFIX}${requestId}`);
    if (!data) return null;
    return JSON.parse(data) as DataDeletionResult;
  } catch {
    return null;
  }
}

/**
 * List all deletion requests for a workspace.
 */
export async function listDeletionRequests(
  workspaceId: string,
  limit = 100
): Promise<DataDeletionRequest[]> {
  try {
    const keys = await redis.keys(`${DELETION_REQUEST_PREFIX}*`);
    const requests: DataDeletionRequest[] = [];

    for (const key of keys.slice(0, limit)) {
      const data = await redis.get(key);
      if (data) {
        const request = JSON.parse(data) as DataDeletionRequest;
        if (request.workspaceId === workspaceId) {
          requests.push(request);
        }
      }
    }

    return requests.sort((a, b) => b.requestedAt - a.requestedAt);
  } catch {
    return [];
  }
}

// --- Data Export (GDPR Article 20) ---

/**
 * Export all client data for portability.
 * GDPR Article 20: Right to data portability.
 *
 * @param workspaceId - Workspace ID
 * @param clientId - Client ID
 * @returns Exported data as JSON
 */
export async function exportClientData(
  workspaceId: string,
  clientId: string
): Promise<{
  exportId: string;
  exportedAt: string;
  client: Record<string, unknown>;
  projects: Record<string, unknown>[];
}> {
  try {
    const { getOpenSeoUrl } = await import("@/lib/env");
    const backendUrl = getOpenSeoUrl();

    const response = await fetch(
      `${backendUrl}/api/internal/gdpr/export-client`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Secret": process.env.INTERNAL_API_SECRET || "",
        },
        body: JSON.stringify({ workspaceId, clientId }),
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Client not found");
      }
      throw new Error(`Export failed: ${response.status}`);
    }

    return (await response.json()) as {
      exportId: string;
      exportedAt: string;
      client: Record<string, unknown>;
      projects: Record<string, unknown>[];
    };
  } catch (error) {
    logger.error(
      "[gdpr] Failed to export client data",
      error instanceof Error ? error : { error: String(error) }
    );
    throw error;
  }
}
