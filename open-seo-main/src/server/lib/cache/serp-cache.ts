/**
 * SERP cache service with Redis TTL and in-memory L1 cache.
 * Caches SERP analysis results to reduce DataForSEO API costs.
 * Phase 36: Content Brief Generation
 *
 * Architecture:
 * - L1: In-memory BoundedCache (500 entries, 1h TTL) - fast lookups
 * - L2: Redis (24h TTL) - persistent across restarts
 *
 * CRIT-CACHE-01 FIX: Cross-instance invalidation via Redis Pub/Sub.
 * When L1 cache is invalidated, a message is published to notify other
 * instances to clear their local L1 caches.
 */

import { redis } from "@/server/lib/redis";
import { createSerpMemoryCache } from "@tevero/utils";
import { CACHE_NS, safeJsonParse } from "./cache-keys";
import type { SerpAnalysisData } from "@/db/brief-schema";
import {
  publishInvalidation,
  registerInvalidationHandler,
  recordCacheHit,
  recordCacheMiss,
  recordCacheInvalidation,
} from "./pubsub-invalidation";

// 24 hours in seconds for Redis
export const SERP_CACHE_TTL = 24 * 60 * 60;

// 1 hour in milliseconds for in-memory cache
const MEMORY_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * In-memory L1 cache for frequently accessed SERP data.
 * Bounded to 500 entries to prevent memory leaks.
 * Uses consolidated BoundedCache from @tevero/utils.
 */
const serpMemoryCache = createSerpMemoryCache<SerpAnalysisData>();

// CRIT-CACHE-01 FIX: Register handler for cross-instance invalidation
registerInvalidationHandler((message) => {
  let cleared = 0;

  // Handle exact key invalidation
  for (const key of message.keys) {
    if (key.startsWith(CACHE_NS.SERP) && serpMemoryCache.delete(key)) {
      cleared++;
    }
  }

  // Handle pattern invalidation
  for (const pattern of message.patterns) {
    if (pattern.startsWith(CACHE_NS.SERP) || pattern.startsWith("osm:serp:")) {
      cleared += serpMemoryCache.clearPattern(pattern);
    }
  }

  return cleared;
});

/**
 * Build cache key from clientId, mappingId and keyword.
 * Format: osm:serp:{clientId}:{mappingId}:{keyword}
 *
 * Including clientId provides defense-in-depth for multi-tenant isolation,
 * ensuring cache entries are scoped to the owning client.
 *
 * @param clientId - Client ID for tenant isolation
 * @param mappingId - Keyword mapping ID
 * @param keyword - Target keyword
 */
export function buildSerpCacheKey(clientId: string, mappingId: string, keyword: string): string {
  return `${CACHE_NS.SERP}${clientId}:${mappingId}:${keyword}`;
}

/**
 * Get cached SERP analysis data.
 * Checks L1 (memory) first, then L2 (Redis).
 * Returns null if key does not exist.
 *
 * MED-CACHE-03 FIX: Records hit/miss metrics.
 */
export async function getCachedSerp(
  key: string
): Promise<SerpAnalysisData | null> {
  // L1: Check in-memory cache first
  const memCached = serpMemoryCache.get(key);
  if (memCached) {
    recordCacheHit("serp-l1");
    recordCacheHit("serp");
    return memCached;
  }
  recordCacheMiss("serp-l1");

  // L2: Check Redis
  const cached = await redis.get(key);
  if (!cached) {
    recordCacheMiss("serp-l2");
    recordCacheMiss("serp");
    return null;
  }
  recordCacheHit("serp-l2");

  // Safe parse - treat corrupted cache as cache miss
  const data = safeJsonParse<SerpAnalysisData>(cached, key);
  if (!data) {
    // Corrupted cache entry - delete it and return null
    await redis.del(key);
    recordCacheMiss("serp");
    return null;
  }

  recordCacheHit("serp");

  // Populate L1 cache for future lookups
  serpMemoryCache.set(key, data);

  return data;
}

/**
 * Cache SERP analysis data with 24h TTL in Redis and 1h in memory.
 */
export async function setCachedSerp(
  key: string,
  data: SerpAnalysisData
): Promise<void> {
  // L1: Set in-memory cache
  serpMemoryCache.set(key, data);

  // L2: Set Redis cache
  await redis.setex(key, SERP_CACHE_TTL, JSON.stringify(data));
}

/**
 * Invalidate cached SERP data from both L1 and L2.
 * Call when keyword is updated in mapping table.
 *
 * CRIT-CACHE-01 FIX: Publishes invalidation to other instances.
 */
export async function invalidateSerpCache(key: string): Promise<void> {
  // L1: Remove from memory
  serpMemoryCache.delete(key);

  // L2: Remove from Redis
  await redis.del(key);

  // Record metric
  recordCacheInvalidation("serp");

  // CRIT-CACHE-01: Notify other instances to clear their L1 caches
  await publishInvalidation([key], [], "serp_invalidate");
}

/**
 * Invalidate all SERP cache entries for a client.
 * Call when client is deleted or transferred.
 *
 * HIGH-CACHE-01 FIX: Workspace transfer invalidation.
 * HIGH-CACHE-02 FIX: Pattern-based invalidation.
 *
 * @param clientId - Client ID to invalidate caches for
 * @returns Number of Redis keys deleted
 */
export async function invalidateClientSerpCache(clientId: string): Promise<number> {
  const pattern = `${CACHE_NS.SERP}${clientId}:*`;

  // L1: Clear matching entries from memory
  const l1Cleared = serpMemoryCache.clearPattern(pattern);

  // L2: Use SCAN to find and delete matching Redis keys
  let cursor = "0";
  let deletedCount = 0;

  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
    cursor = nextCursor;

    if (keys.length > 0) {
      await redis.del(...keys);
      deletedCount += keys.length;
    }
  } while (cursor !== "0");

  // Record metrics
  recordCacheInvalidation("serp");

  // Notify other instances
  await publishInvalidation([], [pattern], "client_serp_invalidate");

  log.info("Invalidated client SERP cache", { clientId, l1Cleared, l2Deleted: deletedCount });

  return deletedCount;
}

/**
 * Get SERP cache statistics for monitoring.
 */
export function getSerpCacheStats(): { size: number; maxSize: number } {
  return serpMemoryCache.stats();
}

/**
 * Prune expired entries from in-memory cache.
 * Called periodically or on demand.
 */
export function pruneSerpCache(): number {
  return serpMemoryCache.prune();
}

// ============================================================================
// Periodic Prune Scheduler
// ============================================================================

import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "serp-cache" });

let pruneInterval: NodeJS.Timeout | null = null;

/**
 * Start periodic pruning of expired SERP cache entries.
 * Runs every 5 minutes to prevent memory accumulation.
 * Safe to call multiple times - will not create duplicate intervals.
 */
export function startSerpCachePruning(): void {
  if (pruneInterval) return;

  // Prune every 5 minutes
  pruneInterval = setInterval(() => {
    const pruned = serpMemoryCache.prune();
    if (pruned > 0) {
      log.debug("Pruned expired SERP cache entries", { count: pruned });
    }
  }, 5 * 60 * 1000);

  // Don't keep the process alive just for cleanup
  if (pruneInterval.unref) {
    pruneInterval.unref();
  }

  log.info("SERP cache prune scheduler started", { intervalMs: 5 * 60 * 1000 });
}

/**
 * Stop periodic pruning. Called during shutdown.
 */
export function stopSerpCachePruning(): void {
  if (pruneInterval) {
    clearInterval(pruneInterval);
    pruneInterval = null;
    log.info("SERP cache prune scheduler stopped");
  }
}
