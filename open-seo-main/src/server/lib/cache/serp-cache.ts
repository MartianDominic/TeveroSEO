/**
 * SERP cache service with Redis TTL and in-memory L1 cache.
 * Caches SERP analysis results to reduce DataForSEO API costs.
 * Phase 36: Content Brief Generation
 *
 * Architecture:
 * - L1: In-memory BoundedCache (500 entries, 1h TTL) - fast lookups
 * - L2: Redis (24h TTL) - persistent across restarts
 */

import { redis } from "@/server/lib/redis";
import { BoundedCache } from "./bounded-cache";
import { CACHE_NS, safeJsonParse } from "./cache-keys";
import type { SerpAnalysisData } from "@/db/brief-schema";

// 24 hours in seconds for Redis
export const SERP_CACHE_TTL = 24 * 60 * 60;

// 1 hour in milliseconds for in-memory cache
const MEMORY_CACHE_TTL_MS = 60 * 60 * 1000;

/**
 * In-memory L1 cache for frequently accessed SERP data.
 * Bounded to 500 entries to prevent memory leaks.
 */
const serpMemoryCache = new BoundedCache<string, SerpAnalysisData>({
  maxSize: 500,
  defaultTTLMs: MEMORY_CACHE_TTL_MS,
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
 */
export async function getCachedSerp(
  key: string
): Promise<SerpAnalysisData | null> {
  // L1: Check in-memory cache first
  const memCached = serpMemoryCache.get(key);
  if (memCached) {
    return memCached;
  }

  // L2: Check Redis
  const cached = await redis.get(key);
  if (!cached) {
    return null;
  }

  // Safe parse - treat corrupted cache as cache miss
  const data = safeJsonParse<SerpAnalysisData>(cached, key);
  if (!data) {
    // Corrupted cache entry - delete it and return null
    await redis.del(key);
    return null;
  }

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
 */
export async function invalidateSerpCache(key: string): Promise<void> {
  // L1: Remove from memory
  serpMemoryCache.delete(key);

  // L2: Remove from Redis
  await redis.del(key);
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
