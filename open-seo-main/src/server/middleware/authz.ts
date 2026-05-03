/**
 * Authorization helpers for verifying client access.
 * Phase 40: Gap Closure - CRITICAL security fix.
 *
 * This module provides authorization checks to verify that an authenticated user
 * has permission to access a specific client's data. The authorization chain is:
 *
 *   User -> member -> organization -> client (via workspaceId)
 *
 * Includes Redis caching for performance since user-client mappings rarely change.
 *
 * CRIT-SYNC-01: Integrated lazy client sync from AI-Writer. When a client is not
 * found locally, we attempt to sync from AI-Writer before returning "not found".
 */

import { db } from "@/db";
import { clients } from "@/db/client-schema";
import { member, organization } from "@/db/user-schema";
import { eq, and } from "drizzle-orm";
import { redis } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { ClientSyncService } from "@/server/services/client-sync";

const log = createLogger({ module: "authz" });

// Cache TTL: 5 minutes (user-client mappings are stable but not immutable)
const ACCESS_CACHE_TTL = 5 * 60;

/**
 * Build Redis cache key for user-client access check.
 * Format: authz:client:{userId}:{clientId}
 */
function buildAccessCacheKey(userId: string, clientId: string): string {
  return `authz:client:${userId}:${clientId}`;
}

/**
 * Result of an authorization check, including the reason for denial if applicable.
 */
export interface AuthzResult {
  allowed: boolean;
  reason?: "client_not_found" | "not_member" | "no_workspace_access";
  workspaceId?: string;
}

/**
 * Check if a user has access to a specific client.
 *
 * Authorization chain:
 * 1. Look up the client to get its workspaceId (organizationId)
 * 2. Verify user is a member of that workspace/organization
 *
 * Results are cached in Redis for 5 minutes.
 *
 * @param userId - The authenticated user's ID
 * @param clientId - The client ID being accessed
 * @returns Promise<boolean> - True if user has access, false otherwise
 */
export async function checkClientAccess(
  userId: string,
  clientId: string
): Promise<boolean> {
  const result = await checkClientAccessWithReason(userId, clientId);
  return result.allowed;
}

/**
 * Check client access with detailed reason for denial.
 * Used for debugging and audit logging.
 *
 * @param userId - The authenticated user's ID
 * @param clientId - The client ID being accessed
 * @returns Promise<AuthzResult> - Detailed result including denial reason
 */
export async function checkClientAccessWithReason(
  userId: string,
  clientId: string
): Promise<AuthzResult> {
  const cacheKey = buildAccessCacheKey(userId, clientId);

  // Check cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      const result = JSON.parse(cached) as AuthzResult;
      log.debug("Cache hit for client access check", { userId, clientId, allowed: result.allowed });
      return result;
    }
  } catch (err) {
    // Cache read failure is non-fatal, continue with DB check
    log.warn("Redis cache read failed, falling back to DB", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Cache miss: check database
  const result = await performAccessCheck(userId, clientId);

  // Cache the result
  try {
    await redis.setex(cacheKey, ACCESS_CACHE_TTL, JSON.stringify(result));
  } catch (err) {
    // Cache write failure is non-fatal
    log.warn("Redis cache write failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

/**
 * Perform the actual database authorization check.
 * Internal function, not cached.
 *
 * CRIT-SYNC-01: If client is not found locally, attempts lazy sync from AI-Writer.
 */
async function performAccessCheck(
  userId: string,
  clientId: string
): Promise<AuthzResult> {
  // Step 1: Get the client's workspace
  let client = await db
    .select({ workspaceId: clients.workspaceId })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  // CRIT-SYNC-01: If client not found locally, attempt lazy sync from AI-Writer
  if (client.length === 0) {
    log.debug("Client not found locally, attempting lazy sync from AI-Writer", {
      userId,
      clientId,
    });

    // Get user's workspace(s) to determine where to sync the client
    const userWorkspaces = await db
      .select({ organizationId: member.organizationId })
      .from(member)
      .where(eq(member.userId, userId))
      .limit(1);

    if (userWorkspaces.length > 0) {
      const workspaceId = userWorkspaces[0].organizationId;

      // Attempt to sync client from AI-Writer
      const syncedClient = await ClientSyncService.ensureClient(
        clientId,
        workspaceId
      );

      if (syncedClient) {
        log.info("Client synced from AI-Writer during auth check", {
          userId,
          clientId,
          workspaceId,
        });
        // Re-query to get the synced client
        client = await db
          .select({ workspaceId: clients.workspaceId })
          .from(clients)
          .where(eq(clients.id, clientId))
          .limit(1);
      }
    }
  }

  if (client.length === 0) {
    return { allowed: false, reason: "client_not_found" };
  }

  const workspaceId = client[0].workspaceId;

  // Step 2: Verify user is a member of this workspace
  const membership = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.userId, userId), eq(member.organizationId, workspaceId)))
    .limit(1);

  if (membership.length === 0) {
    return { allowed: false, reason: "not_member", workspaceId };
  }

  return { allowed: true, workspaceId };
}

/**
 * Authorization error thrown when user doesn't have access to a resource.
 */
export class AuthorizationError extends Error {
  public readonly statusCode = 403;
  public readonly code = "FORBIDDEN";
  public readonly userId: string;
  public readonly clientId: string;
  public readonly reason: string;

  constructor(
    userId: string,
    clientId: string,
    reason: AuthzResult["reason"] = "no_workspace_access"
  ) {
    super(`User ${userId} does not have access to client ${clientId}`);
    this.name = "AuthorizationError";
    this.userId = userId;
    this.clientId = clientId;
    this.reason = reason ?? "no_workspace_access";
  }
}

/**
 * Require client access or throw AuthorizationError.
 * Logs access denials for security audit trail.
 *
 * @param userId - The authenticated user's ID
 * @param clientId - The client ID being accessed
 * @throws AuthorizationError if user doesn't have access
 *
 * @example
 * ```ts
 * async function getClientData(context: EnsuredUserContext, clientId: string) {
 *   await requireClientAccess(context.userId, clientId);
 *   // User has access, proceed with operation
 *   return await fetchClientData(clientId);
 * }
 * ```
 */
export async function requireClientAccess(
  userId: string,
  clientId: string
): Promise<void> {
  const result = await checkClientAccessWithReason(userId, clientId);

  if (!result.allowed) {
    // Log access denial for security audit
    log.warn("Client access denied", {
      userId,
      clientId,
      reason: result.reason,
      workspaceId: result.workspaceId,
    });

    throw new AuthorizationError(userId, clientId, result.reason);
  }

  log.debug("Client access granted", {
    userId,
    clientId,
    workspaceId: result.workspaceId,
  });
}

/**
 * Invalidate cached access for a user-client pair.
 * Call when membership or client ownership changes.
 *
 * @param userId - The user whose cache to invalidate
 * @param clientId - The client whose access cache to invalidate
 */
export async function invalidateClientAccessCache(
  userId: string,
  clientId: string
): Promise<void> {
  const cacheKey = buildAccessCacheKey(userId, clientId);
  try {
    await redis.del(cacheKey);
    log.debug("Invalidated client access cache", { userId, clientId });
  } catch (err) {
    log.warn("Failed to invalidate client access cache", {
      userId,
      clientId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Invalidate all cached access for a specific client.
 * Call when a client is deleted or transferred to a different workspace.
 *
 * Note: This uses SCAN to find keys, which is safe for production but
 * may be slow with large key counts. Use sparingly.
 *
 * @param clientId - The client whose access caches to invalidate
 */
export async function invalidateAllClientAccessCaches(
  clientId: string
): Promise<void> {
  const pattern = `authz:client:*:${clientId}`;
  let cursor = "0";
  let deletedCount = 0;

  try {
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== "0");

    log.info("Invalidated all client access caches", { clientId, deletedCount });
  } catch (err) {
    log.warn("Failed to invalidate all client access caches", {
      clientId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Invalidate all cached access for a specific user.
 * Call when a user's membership changes (joins/leaves workspaces).
 *
 * @param userId - The user whose access caches to invalidate
 */
export async function invalidateUserAccessCaches(userId: string): Promise<void> {
  const pattern = `authz:client:${userId}:*`;
  let cursor = "0";
  let deletedCount = 0;

  try {
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        100
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== "0");

    log.info("Invalidated user access caches", { userId, deletedCount });
  } catch (err) {
    log.warn("Failed to invalidate user access caches", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
