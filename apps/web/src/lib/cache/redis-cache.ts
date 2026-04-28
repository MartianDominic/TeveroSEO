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

/**
 * Get a cached value by key.
 * Key is automatically namespaced with "tevero:cache:" prefix.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const cacheKey = buildKey(key);
  try {
    const data = await redis.get(cacheKey);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error("[redis-cache] Get error:", error);
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
    console.error("[redis-cache] Set error:", error);
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
    console.error("[redis-cache] Invalidate by tag error:", error);
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
    console.error("[redis-cache] Invalidate error:", error);
  }
}

/**
 * Invalidate cache entries matching a pattern.
 * Use with caution - KEYS command can be slow on large datasets.
 */
export async function cacheInvalidatePattern(pattern: string): Promise<number> {
  const fullPattern = `${CACHE_PREFIX}${pattern}`;
  try {
    const keys = await redis.keys(fullPattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return keys.length;
  } catch (error) {
    console.error("[redis-cache] Invalidate pattern error:", error);
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
