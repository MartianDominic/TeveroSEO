/**
 * Redis Key-Value Cache
 *
 * Simple Redis-based cache for general-purpose key-value storage.
 * Replaces the filesystem-based r2-cache for keyword research and similar use cases.
 *
 * This is a lightweight wrapper around Redis that:
 * - Provides consistent key generation with hashing
 * - Handles JSON serialization/deserialization
 * - Supports TTL-based expiration
 * - Uses the osm:kv: namespace to avoid collisions
 *
 * For HTML content caching, use the Phase 95 4-level cache instead.
 */

import { createHash, randomBytes } from "node:crypto";
import { sortBy } from "remeda";
import { redis } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "redis-kv-cache" });

/** Namespace prefix for all KV cache keys */
const CACHE_PREFIX = "osm:kv:";

/** Default TTL values in seconds */
export const CACHE_TTL = {
  /** Related keyword research results - 24 hours */
  researchResult: 86400,
  /** SERP analysis - 12 hours */
  serpAnalysis: 43200,
  /** Quick lookups - 1 hour */
  quickLookup: 3600,
} as const;

/**
 * Build a deterministic cache key from a prefix and parameters.
 * Parameters are sorted and hashed for consistent key generation.
 *
 * @param prefix - Key prefix (e.g., "kw:research")
 * @param params - Object of parameters to hash
 * @returns Cache key string
 */
export async function buildCacheKey(
  prefix: string,
  params: Record<string, unknown>
): Promise<string> {
  const sortedParams = Object.fromEntries(
    sortBy(Object.entries(params), ([key]) => key)
  );
  const raw = JSON.stringify(sortedParams);
  const hash = sha256Hex(raw);
  return `${CACHE_PREFIX}${prefix}:${hash}`;
}

/**
 * Get a cached value by key.
 *
 * @param key - Full cache key (including prefix)
 * @returns Cached value or null if not found/expired
 */
export async function getCached<T = unknown>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (!data) return null;

    const parsed = JSON.parse(data) as T;
    return parsed;
  } catch (error) {
    log.warn("Cache get error", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Set a cached value with TTL.
 *
 * @param key - Full cache key (including prefix)
 * @param data - Data to cache (will be JSON serialized)
 * @param ttlSeconds - Time to live in seconds
 */
export async function setCached<T>(
  key: string,
  data: T,
  ttlSeconds: number
): Promise<void> {
  try {
    await redis.setex(key, ttlSeconds, JSON.stringify(data));
  } catch (error) {
    log.warn("Cache set error", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
    // Don't throw - cache write failures shouldn't break the application
  }
}

/**
 * Delete a cached value.
 *
 * @param key - Full cache key
 */
export async function deleteCached(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    log.warn("Cache delete error", {
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Invalidate all cache entries matching a pattern.
 * Uses SCAN for production safety (non-blocking).
 *
 * @param pattern - Glob pattern (e.g., "kw:research:*")
 * @returns Number of keys deleted
 */
export async function invalidatePattern(pattern: string): Promise<number> {
  const fullPattern = `${CACHE_PREFIX}${pattern}`;
  let cursor = "0";
  let deletedCount = 0;

  try {
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        fullPattern,
        "COUNT",
        100
      );
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== "0");

    return deletedCount;
  } catch (error) {
    log.error(
      `Cache invalidate pattern error: ${pattern}`,
      error instanceof Error ? error : new Error(String(error))
    );
    return 0;
  }
}

/**
 * Get cache statistics for monitoring.
 * Returns count of keys matching the KV cache prefix.
 */
export async function getCacheStats(): Promise<{
  keyCount: number;
  memoryUsageBytes: number | null;
}> {
  try {
    // Count keys using SCAN
    let cursor = "0";
    let keyCount = 0;

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        `${CACHE_PREFIX}*`,
        "COUNT",
        1000
      );
      cursor = nextCursor;
      keyCount += keys.length;
    } while (cursor !== "0");

    // Try to get memory usage (may not be available in all Redis versions)
    let memoryUsageBytes: number | null = null;
    try {
      const info = await redis.info("memory");
      const match = info.match(/used_memory:(\d+)/);
      if (match) {
        memoryUsageBytes = parseInt(match[1], 10);
      }
    } catch {
      // Memory info not available
    }

    return { keyCount, memoryUsageBytes };
  } catch (error) {
    log.error(
      "Cache stats error",
      error instanceof Error ? error : new Error(String(error))
    );
    return { keyCount: 0, memoryUsageBytes: null };
  }
}

/**
 * Create a SHA256 hash of input string.
 */
function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

// =============================================================================
// Migration Helpers (from r2-cache filesystem)
// =============================================================================

/**
 * @deprecated Use getCached from this module instead of r2-cache.
 * This is a drop-in replacement that uses Redis instead of filesystem.
 */
export const getFilesystemCacheMigration = getCached;

/**
 * @deprecated Use setCached from this module instead of r2-cache.
 * This is a drop-in replacement that uses Redis instead of filesystem.
 */
export const setFilesystemCacheMigration = setCached;
