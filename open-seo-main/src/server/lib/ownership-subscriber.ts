/**
 * Ownership Cache Invalidation via Redis Pub/Sub
 *
 * Phase 68-02: Client Context Security
 * HIGH-02 FIX: Cache invalidation within 100ms of permission revocation
 *
 * Uses Redis Pub/Sub for real-time cache invalidation across all instances.
 * When ownership changes (user added/removed from workspace), publish an event
 * to invalidate cached ownership checks across the cluster.
 *
 * Channel: tevero:ownership:changes
 *
 * Message format:
 * {
 *   clientId: string;
 *   action: 'granted' | 'revoked';
 *   userId?: string;  // Optional: specific user affected
 *   timestamp: number;
 * }
 */

import Redis from "ioredis";
import { redis, getSharedBullMQConnection } from "./redis";
import { createLogger } from "./logger";

const log = createLogger({ module: "ownership-subscriber" });

/**
 * Redis Pub/Sub channel for ownership changes.
 */
export const OWNERSHIP_CHANNEL = "tevero:ownership:changes" as const;

/**
 * Actions that can trigger cache invalidation.
 */
export type OwnershipAction = "granted" | "revoked";

/**
 * Message format for ownership change events.
 */
export interface OwnershipChangeMessage {
  /** Client ID affected by the change */
  clientId: string;
  /** Type of change */
  action: OwnershipAction;
  /** Specific user affected (if applicable) */
  userId?: string;
  /** Timestamp of the change */
  timestamp: number;
}

/**
 * In-memory ownership cache for fast lookups.
 * Entries expire after TTL to ensure consistency.
 *
 * Note: This cache supplements the Redis cache in client-context.ts.
 * Both are invalidated together via pub/sub.
 */
interface CacheEntry {
  userId: string;
  expiresAt: number;
}

const ownershipCache = new Map<string, CacheEntry>();

/**
 * Cache TTL in milliseconds (30 seconds).
 * Matches the TTL in client-ownership.ts for consistency.
 */
const CACHE_TTL_MS = 30_000;

/**
 * Subscriber connection (separate from main connection per Redis best practices).
 */
let subscriberConnection: Redis | null = null;

/**
 * Flag to track if we're subscribed.
 */
let isSubscribed = false;

/**
 * Subscribe to ownership change events.
 * Call this at application startup to enable real-time cache invalidation.
 *
 * Uses a dedicated Redis connection for subscriptions as recommended by Redis.
 * Once a connection enters subscriber mode, it cannot be used for other commands.
 */
export async function subscribeToOwnershipChanges(): Promise<void> {
  if (isSubscribed) {
    log.debug("Already subscribed to ownership changes");
    return;
  }

  try {
    // Use a dedicated connection for subscriptions
    subscriberConnection = getSharedBullMQConnection("ownership-subscriber");

    await subscriberConnection.subscribe(OWNERSHIP_CHANNEL);
    isSubscribed = true;

    subscriberConnection.on("message", (channel, message) => {
      if (channel !== OWNERSHIP_CHANNEL) return;

      try {
        const data = JSON.parse(message) as OwnershipChangeMessage;
        handleOwnershipChange(data);
      } catch (err) {
        log.error("Failed to parse ownership change message", err instanceof Error ? err : undefined, { message });
      }
    });

    log.info("Subscribed to ownership changes", { channel: OWNERSHIP_CHANNEL });
  } catch (err) {
    log.error("Failed to subscribe to ownership changes", err instanceof Error ? err : undefined);
    throw err;
  }
}

/**
 * Handle an ownership change event.
 * Invalidates relevant cache entries.
 */
function handleOwnershipChange(data: OwnershipChangeMessage): void {
  const latency = Date.now() - data.timestamp;

  if (data.action === "revoked") {
    // Clear specific user-client pair if userId provided
    if (data.userId) {
      const cacheKey = buildCacheKey(data.userId, data.clientId);
      ownershipCache.delete(cacheKey);
      log.debug("Invalidated ownership cache entry", {
        userId: data.userId,
        clientId: data.clientId,
        latencyMs: latency,
      });
    } else {
      // Clear all entries for this client
      invalidateClientEntries(data.clientId);
      log.debug("Invalidated all ownership entries for client", {
        clientId: data.clientId,
        latencyMs: latency,
      });
    }

    // Also invalidate Redis cache entries
    invalidateRedisCacheAsync(data.clientId, data.userId);
  }

  // Log latency for monitoring (target: < 100ms)
  if (latency > 100) {
    log.warn("Ownership invalidation latency exceeded target", {
      latencyMs: latency,
      target: 100,
      clientId: data.clientId,
    });
  }
}

/**
 * Build cache key for user-client pair.
 */
function buildCacheKey(userId: string, clientId: string): string {
  return `${userId}:${clientId}`;
}

/**
 * Invalidate all cache entries for a specific client.
 */
function invalidateClientEntries(clientId: string): void {
  const keysToDelete: string[] = [];
  ownershipCache.forEach((_, key) => {
    if (key.endsWith(`:${clientId}`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach((key) => ownershipCache.delete(key));
}

/**
 * Invalidate Redis cache entries asynchronously.
 * Fire-and-forget to avoid blocking the main invalidation flow.
 */
async function invalidateRedisCacheAsync(clientId: string, userId?: string): Promise<void> {
  try {
    if (userId) {
      // Delete specific user-client cache entry
      const key = `ownership:${userId}:${clientId}`;
      await redis.del(key);
    } else {
      // Delete all entries for this client using SCAN
      let cursor = "0";
      const pattern = `ownership:*:${clientId}`;

      do {
        const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = nextCursor;

        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== "0");
    }
  } catch (err) {
    log.warn("Failed to invalidate Redis cache", {
      error: err instanceof Error ? err.message : String(err),
      clientId,
      userId,
    });
  }
}

/**
 * Publish an ownership change event.
 * Call this when membership changes (user added/removed from workspace).
 *
 * @param clientId - The client whose ownership changed
 * @param action - Whether access was granted or revoked
 * @param userId - Optional specific user affected
 */
export async function publishOwnershipChange(
  clientId: string,
  action: OwnershipAction,
  userId?: string
): Promise<void> {
  const message: OwnershipChangeMessage = {
    clientId,
    action,
    userId,
    timestamp: Date.now(),
  };

  try {
    await redis.publish(OWNERSHIP_CHANNEL, JSON.stringify(message));
    log.debug("Published ownership change", { clientId, action, userId });
  } catch (err) {
    log.error("Failed to publish ownership change", err instanceof Error ? err : undefined, {
      clientId,
      action,
      userId,
    });
    throw err;
  }
}

/**
 * Get cached ownership for a user-client pair.
 * Returns null if not cached or expired.
 *
 * @param userId - The user ID
 * @param clientId - The client ID
 * @returns Cached ownership info or null
 */
export function getCachedOwnership(userId: string, clientId: string): { userId: string } | null {
  const cacheKey = buildCacheKey(userId, clientId);
  const entry = ownershipCache.get(cacheKey);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt < Date.now()) {
    ownershipCache.delete(cacheKey);
    return null;
  }

  return { userId: entry.userId };
}

/**
 * Set cached ownership for a user-client pair.
 *
 * @param userId - The user ID
 * @param clientId - The client ID
 */
export function setCachedOwnership(userId: string, clientId: string): void {
  const cacheKey = buildCacheKey(userId, clientId);
  ownershipCache.set(cacheKey, {
    userId,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

/**
 * Unsubscribe from ownership changes.
 * Call this during application shutdown.
 */
export async function unsubscribeFromOwnershipChanges(): Promise<void> {
  if (!isSubscribed || !subscriberConnection) {
    return;
  }

  try {
    await subscriberConnection.unsubscribe(OWNERSHIP_CHANNEL);
    isSubscribed = false;
    log.info("Unsubscribed from ownership changes");
  } catch (err) {
    log.error("Failed to unsubscribe from ownership changes", err instanceof Error ? err : undefined);
  }
}

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats(): { size: number; channel: string; subscribed: boolean } {
  return {
    size: ownershipCache.size,
    channel: OWNERSHIP_CHANNEL,
    subscribed: isSubscribed,
  };
}

/**
 * Clear the in-memory cache.
 * For testing purposes only.
 */
export function _clearCache(): void {
  ownershipCache.clear();
}
