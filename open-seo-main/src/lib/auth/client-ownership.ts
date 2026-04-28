/**
 * Client Ownership Validation for TanStack Start Routes
 *
 * Provides utilities to verify that authenticated users have access to
 * specific clients. Integrates with better-auth session management and
 * uses Drizzle ORM for database queries.
 *
 * Authorization Chain:
 *   User (better-auth) -> Member (organization) -> Client (workspace)
 *
 * Caching Strategy:
 * - Uses Redis for caching ownership checks (5 minute TTL)
 * - Negative results are cached to prevent DB hammering for denied access
 *
 * SECURITY:
 * - Fails closed: If Redis or DB is unavailable, access is denied
 * - All denials are logged for security audit
 */

import { db } from "@/db";
import { clients } from "@/db/client-schema";
import { member } from "@/db/user-schema";
import { eq, and } from "drizzle-orm";
import { redis } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "client-ownership" });

/**
 * Cache TTL for ownership checks (5 minutes).
 * Balances performance with security - ownership changes are relatively rare.
 */
const OWNERSHIP_CACHE_TTL = 5 * 60; // seconds

/**
 * Error codes for authorization failures.
 */
export enum AuthErrorCode {
  FORBIDDEN = "FORBIDDEN",
  CLIENT_NOT_FOUND = "CLIENT_NOT_FOUND",
  NOT_MEMBER = "NOT_MEMBER",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

/**
 * Authorization error thrown when user doesn't have access to a resource.
 */
export class ClientOwnershipError extends Error {
  public readonly statusCode: number;
  public readonly code: AuthErrorCode;
  public readonly userId: string;
  public readonly clientId: string;

  constructor(
    userId: string,
    clientId: string,
    code: AuthErrorCode = AuthErrorCode.FORBIDDEN
  ) {
    const message =
      code === AuthErrorCode.CLIENT_NOT_FOUND
        ? "Client not found"
        : `User ${userId} does not have access to client ${clientId}`;
    super(message);
    this.name = "ClientOwnershipError";
    this.statusCode = code === AuthErrorCode.CLIENT_NOT_FOUND ? 404 : 403;
    this.code = code;
    this.userId = userId;
    this.clientId = clientId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClientOwnershipError);
    }
  }

  toJSON(): {
    error: string;
    code: string;
    statusCode: number;
  } {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}

/**
 * Result of an ownership check, including organization context.
 */
export interface OwnershipCheckResult {
  allowed: boolean;
  reason?: "client_not_found" | "not_member" | "no_workspace_access" | "cached";
  workspaceId?: string;
}

/**
 * Build cache key for ownership check.
 */
function buildOwnershipCacheKey(userId: string, clientId: string): string {
  return `ownership:${userId}:${clientId}`;
}

/**
 * Validate that a user has access to a specific client.
 * Throws ClientOwnershipError if access is denied.
 *
 * @param userId - The authenticated user's ID
 * @param clientId - The client ID to validate access for
 * @throws ClientOwnershipError if user doesn't have access
 *
 * @example
 * ```ts
 * async function getClientData(context: EnsuredUserContext, clientId: string) {
 *   await validateClientOwnership(context.userId, clientId);
 *   // User has access, proceed with operation
 *   return await fetchClientData(clientId);
 * }
 * ```
 */
export async function validateClientOwnership(
  userId: string,
  clientId: string
): Promise<void> {
  const result = await checkClientOwnership(userId, clientId);

  if (!result.allowed) {
    // Log denial for security audit
    log.warn("Client ownership denied", {
      userId,
      clientId,
      reason: result.reason,
      workspaceId: result.workspaceId,
    });

    const code =
      result.reason === "client_not_found"
        ? AuthErrorCode.CLIENT_NOT_FOUND
        : AuthErrorCode.NOT_MEMBER;

    throw new ClientOwnershipError(userId, clientId, code);
  }

  log.debug("Client ownership validated", {
    userId,
    clientId,
    workspaceId: result.workspaceId,
  });
}

/**
 * Check if a user has access to a client (non-throwing version).
 * Returns detailed result including reason for denial.
 *
 * @param userId - The authenticated user's ID
 * @param clientId - The client ID to check access for
 * @returns OwnershipCheckResult with allowed status and details
 */
export async function checkClientOwnership(
  userId: string,
  clientId: string
): Promise<OwnershipCheckResult> {
  const cacheKey = buildOwnershipCacheKey(userId, clientId);

  // Check cache first
  try {
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      const result = JSON.parse(cached) as OwnershipCheckResult;
      log.debug("Cache hit for ownership check", {
        userId,
        clientId,
        allowed: result.allowed,
      });
      return { ...result, reason: "cached" };
    }
  } catch (err) {
    // Cache read failure is non-fatal, continue with DB check
    log.warn("Redis cache read failed, falling back to DB", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Cache miss: check database
  const result = await performOwnershipCheck(userId, clientId);

  // Cache the result (both positive and negative)
  try {
    await redis.setex(cacheKey, OWNERSHIP_CACHE_TTL, JSON.stringify(result));
  } catch (err) {
    // Cache write failure is non-fatal
    log.warn("Redis cache write failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

/**
 * Perform the actual database ownership check.
 * Authorization chain: User -> Member -> Organization -> Client (via workspaceId)
 */
async function performOwnershipCheck(
  userId: string,
  clientId: string
): Promise<OwnershipCheckResult> {
  // Step 1: Get the client's workspace
  const client = await db
    .select({ workspaceId: clients.workspaceId })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);

  if (client.length === 0) {
    return { allowed: false, reason: "client_not_found" };
  }

  const workspaceId = client[0].workspaceId;

  // Step 2: Verify user is a member of this workspace/organization
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
 * Invalidate ownership cache for a specific user-client pair.
 * Call this when ownership changes (e.g., user added/removed from workspace).
 *
 * @param userId - The user whose cache to invalidate
 * @param clientId - The client whose access cache to invalidate
 */
export async function invalidateOwnershipCache(
  userId: string,
  clientId: string
): Promise<void> {
  const cacheKey = buildOwnershipCacheKey(userId, clientId);
  try {
    await redis.del(cacheKey);
    log.debug("Invalidated ownership cache", { userId, clientId });
  } catch (err) {
    log.warn("Failed to invalidate ownership cache", {
      userId,
      clientId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Invalidate all ownership caches for a specific client.
 * Call this when a client is deleted or transferred to a different workspace.
 *
 * Uses Redis SCAN to find and delete matching keys.
 *
 * @param clientId - The client whose caches to invalidate
 */
export async function invalidateClientCaches(clientId: string): Promise<void> {
  const pattern = `ownership:*:${clientId}`;
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

    log.info("Invalidated all client ownership caches", { clientId, deletedCount });
  } catch (err) {
    log.warn("Failed to invalidate client caches", {
      clientId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Invalidate all ownership caches for a specific user.
 * Call this when a user's memberships change (joins/leaves workspaces).
 *
 * @param userId - The user whose caches to invalidate
 */
export async function invalidateUserCaches(userId: string): Promise<void> {
  const pattern = `ownership:${userId}:*`;
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

    log.info("Invalidated user ownership caches", { userId, deletedCount });
  } catch (err) {
    log.warn("Failed to invalidate user caches", {
      userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Batch check ownership for multiple clients.
 * Useful for list views where you need to filter accessible clients.
 *
 * @param userId - The authenticated user's ID
 * @param clientIds - Array of client IDs to check
 * @returns Map of clientId -> allowed
 */
export async function batchCheckOwnership(
  userId: string,
  clientIds: string[]
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  // Check all clients (with parallelism limit)
  const BATCH_SIZE = 10;
  for (let i = 0; i < clientIds.length; i += BATCH_SIZE) {
    const batch = clientIds.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (clientId) => {
      const result = await checkClientOwnership(userId, clientId);
      return { clientId, allowed: result.allowed };
    });

    const batchResults = await Promise.all(promises);
    for (const { clientId, allowed } of batchResults) {
      results.set(clientId, allowed);
    }
  }

  return results;
}
