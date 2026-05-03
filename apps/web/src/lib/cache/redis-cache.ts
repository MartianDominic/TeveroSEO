/**
 * Redis cache utilities for dashboard data caching.
 *
 * MIGRATION NOTE: This file is a backward-compatibility layer.
 * New code should import from @/lib/redis directly for:
 * - Type-safe caching with Zod validation
 * - Namespaced keys (tevero:cache: prefix)
 * - Pattern-based invalidation
 * - Pub/Sub utilities
 *
 * @deprecated Import from @/lib/redis for new code
 */

// Re-export Redis client from new module
export {
  redis,
  closeRedis,
  ensureRedisConnected,
  checkRedisHealth,
} from "@/lib/redis/client";

import { redis } from "@/lib/redis/client";
import type { ZodLikeSchema } from "@/lib/utils/type-guards";

import { logger } from '@/lib/logger';
// Namespace prefix for all cache keys - prevents collisions
const CACHE_PREFIX = "tevero:cache:";

interface CacheOptions {
  ttl?: number; // Seconds
  tags?: string[];
}

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Build a namespaced cache key.
 * @internal
 */
function buildKey(key: string): string {
  // If key already has prefix, don't double-prefix
  if (key.startsWith(CACHE_PREFIX)) {
    return key;
  }
  return `${CACHE_PREFIX}${key}`;
}

/**
 * Build a tag key for invalidation tracking.
 * @internal
 */
function buildTagKey(tag: string): string {
  return `${CACHE_PREFIX}tag:${tag}`;
}

export interface CacheGetOptions<T> {
  /** Optional Zod schema for validating cached data */
  schema?: ZodLikeSchema<T>;
}

/**
 * Get a cached value by key.
 * Key is automatically namespaced with "tevero:cache:" prefix.
 *
 * @param key - Cache key (will be prefixed automatically)
 * @param options - Optional configuration including schema validation
 * @returns Cached value or null if not found/invalid
 */
export async function cacheGet<T>(
  key: string,
  options?: CacheGetOptions<T>
): Promise<T | null> {
  const cacheKey = buildKey(key);
  try {
    const data = await redis.get(cacheKey);
    if (!data) return null;

    const parsed: unknown = JSON.parse(data);

    // If schema provided, validate the cached data
    if (options?.schema) {
      const result = options.schema.safeParse(parsed);
      if (!result.success) {
        console.warn(`[redis-cache] Cached data validation failed for key "${key}": ${result.error.message}`);
        // Invalidate corrupted cache entry
        await redis.del(cacheKey);
        return null;
      }
      return result.data;
    }

    // Without schema, return as T (maintains backward compatibility)
    return parsed as T;
  } catch (error) {
    logger.error("[redis-cache] Get error", error instanceof Error ? error : { error: String(error) });
    return null;
  }
}

/**
 * Set a cached value with TTL and optional tags.
 * Key is automatically namespaced with "tevero:cache:" prefix.
 * Default TTL is 5 minutes.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  const cacheKey = buildKey(key);
  const { ttl = DEFAULT_TTL, tags = [] } = options;

  try {
    // Always use TTL to prevent memory bloat
    await redis.setex(cacheKey, ttl, JSON.stringify(value));

    // Track tags for invalidation
    for (const tag of tags) {
      const tagKey = buildTagKey(tag);
      await redis.sadd(tagKey, cacheKey);
      // Tag expiry should outlive the cached value
      await redis.expire(tagKey, ttl + 60);
    }
  } catch (error) {
    logger.error("[redis-cache] Set error", error instanceof Error ? error : { error: String(error) });
  }
}

/**
 * Invalidate all cache keys associated with a tag.
 */
export async function cacheInvalidateByTag(tag: string): Promise<void> {
  const tagKey = buildTagKey(tag);
  try {
    const keys = await redis.smembers(tagKey);
    if (keys.length > 0) {
      await redis.del(...keys);
      await redis.del(tagKey);
    }
  } catch (error) {
    logger.error("[redis-cache] Invalidate by tag error", error instanceof Error ? error : { error: String(error) });
  }
}

/**
 * Invalidate a single cache key.
 */
export async function cacheInvalidate(key: string): Promise<void> {
  const cacheKey = buildKey(key);
  try {
    await redis.del(cacheKey);
  } catch (error) {
    logger.error("[redis-cache] Invalidate error", error instanceof Error ? error : { error: String(error) });
  }
}

/**
 * HIGH-CACHE-02 FIX: Invalidate cache entries matching a pattern.
 * Uses SCAN instead of KEYS for production safety.
 *
 * @param pattern - Glob pattern to match (e.g., "*:client-123:*")
 * @returns Number of keys deleted
 */
export async function cacheInvalidatePattern(pattern: string): Promise<number> {
  const fullPattern = `${CACHE_PREFIX}${pattern}`;
  let cursor = "0";
  let deletedCount = 0;

  try {
    // HIGH-CACHE-02: Use SCAN instead of KEYS for large datasets
    do {
      const [nextCursor, keys] = await redis.scan(cursor, "MATCH", fullPattern, "COUNT", 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
        deletedCount += keys.length;
      }
    } while (cursor !== "0");

    return deletedCount;
  } catch (error) {
    logger.error("[redis-cache] Invalidate pattern error", error instanceof Error ? error : { error: String(error) });
    return 0;
  }
}

/**
 * Invalidate all cache for a specific client.
 */
export async function invalidateClientCache(clientId: string): Promise<number> {
  return cacheInvalidatePattern(`*:${clientId}:*`);
}

// Cache key generators (these return strings for backward compatibility)
export const cacheKeys = {
  dashboardMetrics: (workspaceId: string) => `dashboard:metrics:${workspaceId}`,
  clientsPaginated: (workspaceId: string, hash: string) =>
    `clients:paginated:${workspaceId}:${hash}`,
  clientGoals: (clientId: string) => `client:goals:${clientId}`,
  portfolioAggregates: (workspaceId: string) =>
    `portfolio:aggregates:${workspaceId}`,
  sparkline: (clientId: string, metric: string) =>
    `sparkline:${clientId}:${metric}`,
};

// Cache tag generators
export const cacheTags = {
  workspace: (workspaceId: string) => `workspace:${workspaceId}`,
  client: (clientId: string) => `client:${clientId}`,
};

export { type CacheOptions };
