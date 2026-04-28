/**
 * Redis cache utilities with namespacing, TTL, and type-safe serialization.
 * All cache keys are prefixed with CACHE_PREFIX to prevent collisions.
 */

import { z } from "zod";
import { redis } from "./client";

// Namespace prefix for all cache keys - prevents collisions with other Redis users
const CACHE_PREFIX = "tevero:cache:";

// Default TTL in seconds (5 minutes)
const DEFAULT_TTL = 300;

interface CacheOptions {
  ttl?: number; // Seconds, default 300 (5 min)
  tags?: string[];
}

/**
 * Build a namespaced cache key.
 * Format: tevero:cache:{namespace}:{key}
 */
function buildKey(namespace: string, key: string): string {
  return `${CACHE_PREFIX}${namespace}:${key}`;
}

/**
 * Build a tag key for invalidation tracking.
 * Format: tevero:cache:tag:{tag}
 */
function buildTagKey(tag: string): string {
  return `${CACHE_PREFIX}tag:${tag}`;
}

/**
 * Get a cached value with Zod schema validation.
 * Returns null if key doesn't exist or data is invalid.
 *
 * @param namespace - Cache namespace (e.g., "clients", "dashboard")
 * @param key - Unique key within namespace
 * @param schema - Zod schema to validate the cached data
 */
export async function cacheGet<T>(
  namespace: string,
  key: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  const cacheKey = buildKey(namespace, key);

  try {
    const raw = await redis.get(cacheKey);

    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const result = schema.safeParse(parsed);

    if (!result.success) {
      // Invalid cache data - delete and return null
      await redis.del(cacheKey);
      console.warn(`[redis-cache] Invalid cache data for ${cacheKey}:`, result.error.message);
      return null;
    }

    return result.data;
  } catch (error) {
    console.error(`[redis-cache] Get error for ${cacheKey}:`, error);
    return null;
  }
}

/**
 * Get a cached value without schema validation (legacy compatibility).
 * Prefer cacheGet with schema validation for type safety.
 */
export async function cacheGetUnsafe<T>(namespace: string, key: string): Promise<T | null> {
  const cacheKey = buildKey(namespace, key);

  try {
    const raw = await redis.get(cacheKey);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`[redis-cache] Get error for ${cacheKey}:`, error);
    return null;
  }
}

/**
 * Set a cached value with TTL and optional tags.
 *
 * @param namespace - Cache namespace
 * @param key - Unique key within namespace
 * @param value - Value to cache (must be JSON-serializable)
 * @param options - TTL and tags configuration
 */
export async function cacheSet<T>(
  namespace: string,
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  const cacheKey = buildKey(namespace, key);
  const ttl = options.ttl ?? DEFAULT_TTL;
  const tags = options.tags ?? [];

  try {
    // Set with TTL
    await redis.setex(cacheKey, ttl, JSON.stringify(value));

    // Track tags for invalidation
    for (const tag of tags) {
      const tagKey = buildTagKey(tag);
      await redis.sadd(tagKey, cacheKey);
      // Tag expiry should outlive the cached value
      await redis.expire(tagKey, ttl + 60);
    }
  } catch (error) {
    console.error(`[redis-cache] Set error for ${cacheKey}:`, error);
  }
}

/**
 * Delete a single cached value.
 */
export async function cacheDelete(namespace: string, key: string): Promise<void> {
  const cacheKey = buildKey(namespace, key);

  try {
    await redis.del(cacheKey);
  } catch (error) {
    console.error(`[redis-cache] Delete error for ${cacheKey}:`, error);
  }
}

/**
 * Invalidate cache entries by tag.
 * Deletes all keys associated with the given tag.
 */
export async function cacheInvalidateByTag(tag: string): Promise<number> {
  const tagKey = buildTagKey(tag);

  try {
    const keys = await redis.smembers(tagKey);
    if (keys.length > 0) {
      await redis.del(...keys);
      await redis.del(tagKey);
    }
    return keys.length;
  } catch (error) {
    console.error(`[redis-cache] Invalidate by tag error for ${tag}:`, error);
    return 0;
  }
}

/**
 * Invalidate cache entries matching a pattern.
 * Use with caution - KEYS command can be slow on large datasets.
 *
 * @param pattern - Glob-style pattern (e.g., "clients:*", "*:user123:*")
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
    console.error(`[redis-cache] Invalidate pattern error for ${pattern}:`, error);
    return 0;
  }
}

/**
 * Invalidate all cache for a specific client.
 * Clears any key containing the client ID.
 */
export async function invalidateClientCache(clientId: string): Promise<number> {
  return cacheInvalidatePattern(`*:${clientId}:*`);
}

/**
 * Invalidate all cache for a specific workspace.
 */
export async function invalidateWorkspaceCache(workspaceId: string): Promise<number> {
  return cacheInvalidatePattern(`*:${workspaceId}:*`);
}

// Re-export types
export { type CacheOptions };

// Cache key generators (namespaced)
export const cacheKeys = {
  dashboardMetrics: (workspaceId: string) => ({
    namespace: "dashboard",
    key: `metrics:${workspaceId}`,
  }),
  clientsPaginated: (workspaceId: string, hash: string) => ({
    namespace: "clients",
    key: `paginated:${workspaceId}:${hash}`,
  }),
  clientGoals: (clientId: string) => ({
    namespace: "client",
    key: `goals:${clientId}`,
  }),
  portfolioAggregates: (workspaceId: string) => ({
    namespace: "portfolio",
    key: `aggregates:${workspaceId}`,
  }),
  sparkline: (clientId: string, metric: string) => ({
    namespace: "sparkline",
    key: `${clientId}:${metric}`,
  }),
  patterns: (workspaceId: string) => ({
    namespace: "analytics",
    key: `patterns:${workspaceId}`,
  }),
  predictions: (workspaceId: string) => ({
    namespace: "analytics",
    key: `predictions:${workspaceId}`,
  }),
};

// Cache tag generators
export const cacheTags = {
  workspace: (workspaceId: string) => `workspace:${workspaceId}`,
  client: (clientId: string) => `client:${clientId}`,
  analytics: (workspaceId: string) => `analytics:${workspaceId}`,
};
