/**
 * Tenant Ownership Verification Module
 * Verifies that a workspace/user has access to a specific client.
 *
 * SECURITY: This is a critical security boundary. All client-scoped
 * operations MUST verify ownership before proceeding.
 */

import { logger } from "@/lib/logger";
import { redis } from "@/lib/redis/client";

// --- Types ---

interface OwnershipCacheEntry {
  hasAccess: boolean;
  cachedAt: number;
}

// --- Configuration ---

/**
 * Cache TTL for ownership verification results.
 * Short TTL (5 minutes) balances performance with security.
 */
const OWNERSHIP_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Redis key prefix for ownership cache.
 */
const OWNERSHIP_CACHE_PREFIX = "tenant:ownership:";

// --- Ownership Verification ---

/**
 * Verify that a workspace has access to a specific client.
 * Uses Redis caching to reduce database load.
 *
 * @param workspaceId - The workspace ID to check
 * @param clientId - The client ID to verify access to
 * @returns true if the workspace has access
 */
export async function verifyClientOwnership(
  workspaceId: string,
  clientId: string
): Promise<boolean> {
  const cacheKey = `${OWNERSHIP_CACHE_PREFIX}${workspaceId}:${clientId}`;

  try {
    // Check cache first
    const cached = await getOwnershipFromCache(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Verify ownership against database
    const hasAccess = await verifyOwnershipFromDatabase(workspaceId, clientId);

    // Cache the result
    await setOwnershipCache(cacheKey, hasAccess);

    return hasAccess;
  } catch (error) {
    logger.error(
      "[ownership] Failed to verify client ownership",
      error instanceof Error ? error : { error: String(error) }
    );

    // SECURITY: Fail closed on errors
    return false;
  }
}

/**
 * Get ownership status from Redis cache.
 */
async function getOwnershipFromCache(
  cacheKey: string
): Promise<boolean | null> {
  try {
    if (redis.status !== "ready") {
      return null;
    }

    const cached = await redis.get(cacheKey);
    if (!cached) return null;

    const entry: OwnershipCacheEntry = JSON.parse(cached);

    // Check if cache is still valid
    if (Date.now() - entry.cachedAt > OWNERSHIP_CACHE_TTL_MS) {
      await redis.del(cacheKey);
      return null;
    }

    return entry.hasAccess;
  } catch {
    return null;
  }
}

/**
 * Set ownership status in Redis cache.
 */
async function setOwnershipCache(
  cacheKey: string,
  hasAccess: boolean
): Promise<void> {
  try {
    if (redis.status !== "ready") {
      return;
    }

    const entry: OwnershipCacheEntry = {
      hasAccess,
      cachedAt: Date.now(),
    };

    await redis.set(cacheKey, JSON.stringify(entry), "PX", OWNERSHIP_CACHE_TTL_MS);
  } catch {
    // Cache write failure is non-critical
  }
}

/**
 * Verify ownership by querying the database.
 * This is the source of truth for access control.
 */
async function verifyOwnershipFromDatabase(
  workspaceId: string,
  clientId: string
): Promise<boolean> {
  // Import db dynamically to avoid circular dependencies
  // and ensure proper initialization order
  const { db } = await import("@/lib/db");
  const { clients } = await import("@/lib/db/schema");
  const { eq, and, isNull } = await import("drizzle-orm");

  try {
    const client = await db.query.clients.findFirst({
      where: and(
        eq(clients.id, clientId),
        eq(clients.workspaceId, workspaceId),
        // Exclude soft-deleted clients
        isNull(clients.softDeletedAt)
      ),
      columns: {
        id: true,
      },
    });

    return client !== undefined;
  } catch (error) {
    logger.error(
      "[ownership] Database query failed",
      error instanceof Error ? error : { error: String(error) }
    );
    // Fail closed on database errors
    return false;
  }
}

/**
 * Invalidate ownership cache for a client.
 * Call this when client ownership changes (e.g., client moved to different workspace).
 *
 * @param workspaceId - The workspace ID
 * @param clientId - The client ID
 */
export async function invalidateOwnershipCache(
  workspaceId: string,
  clientId: string
): Promise<void> {
  const cacheKey = `${OWNERSHIP_CACHE_PREFIX}${workspaceId}:${clientId}`;

  try {
    if (redis.status === "ready") {
      await redis.del(cacheKey);
    }
  } catch {
    // Cache invalidation failure is logged but not critical
    logger.warn("[ownership] Failed to invalidate cache", { cacheKey });
  }
}

/**
 * Invalidate all ownership cache entries for a client.
 * Use when a client is deleted or moved between workspaces.
 *
 * @param clientId - The client ID
 */
export async function invalidateAllClientOwnership(
  clientId: string
): Promise<void> {
  try {
    if (redis.status !== "ready") {
      return;
    }

    // Find and delete all cache entries for this client
    const pattern = `${OWNERSHIP_CACHE_PREFIX}*:${clientId}`;
    const keys = await redis.keys(pattern);

    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info("[ownership] Invalidated cache entries", {
        clientId,
        count: keys.length,
      });
    }
  } catch (error) {
    logger.warn(
      "[ownership] Failed to invalidate all client cache",
      error instanceof Error ? error : { error: String(error) }
    );
  }
}

/**
 * Batch verify ownership for multiple clients.
 * More efficient than individual calls for bulk operations.
 *
 * @param workspaceId - The workspace ID
 * @param clientIds - Array of client IDs to verify
 * @returns Map of clientId -> hasAccess
 */
export async function batchVerifyClientOwnership(
  workspaceId: string,
  clientIds: string[]
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  if (clientIds.length === 0) {
    return results;
  }

  // Check cache for all clients first
  const uncachedIds: string[] = [];

  await Promise.all(
    clientIds.map(async (clientId) => {
      const cacheKey = `${OWNERSHIP_CACHE_PREFIX}${workspaceId}:${clientId}`;
      const cached = await getOwnershipFromCache(cacheKey);

      if (cached !== null) {
        results.set(clientId, cached);
      } else {
        uncachedIds.push(clientId);
      }
    })
  );

  // Query database for uncached clients
  if (uncachedIds.length > 0) {
    try {
      const { db } = await import("@/lib/db");
      const { clients } = await import("@/lib/db/schema");
      const { eq, and, inArray, isNull } = await import("drizzle-orm");

      const ownedClients = await db.query.clients.findMany({
        where: and(
          inArray(clients.id, uncachedIds),
          eq(clients.workspaceId, workspaceId),
          isNull(clients.softDeletedAt)
        ),
        columns: {
          id: true,
        },
      });

      const ownedSet = new Set(ownedClients.map((c) => c.id));

      // Update results and cache
      await Promise.all(
        uncachedIds.map(async (clientId) => {
          const hasAccess = ownedSet.has(clientId);
          results.set(clientId, hasAccess);

          const cacheKey = `${OWNERSHIP_CACHE_PREFIX}${workspaceId}:${clientId}`;
          await setOwnershipCache(cacheKey, hasAccess);
        })
      );
    } catch (error) {
      logger.error(
        "[ownership] Batch verification failed",
        error instanceof Error ? error : { error: String(error) }
      );

      // Mark all uncached as denied (fail closed)
      uncachedIds.forEach((clientId) => {
        results.set(clientId, false);
      });
    }
  }

  return results;
}
