/**
 * Redis cache utilities for dashboard data caching.
 * Uses ioredis with tag-based invalidation for related cache clearing.
 */

import Redis from "ioredis";

function getRedisUrl(): string {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    throw new Error(
      "Missing required environment variable: REDIS_URL. " +
        "Set it in .env or the deployment environment before starting."
    );
  }
  return url;
}

const redis = new Redis(getRedisUrl(), {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: true,
});

redis.on("error", (err) => {
  console.error("[redis-cache] Connection error:", err);
});

interface CacheOptions {
  ttl?: number; // Seconds
  tags?: string[];
}

const DEFAULT_TTL = 300; // 5 minutes

/**
 * Get a cached value by key.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data) as T;
  } catch (error) {
    console.error("[redis-cache] Get error:", error);
    return null;
  }
}

/**
 * Set a cached value with optional TTL and tags.
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<void> {
  const { ttl = DEFAULT_TTL, tags = [] } = options;

  try {
    await redis.setex(key, ttl, JSON.stringify(value));

    // Track tags for invalidation
    for (const tag of tags) {
      await redis.sadd(`tag:${tag}`, key);
      await redis.expire(`tag:${tag}`, ttl + 60);
    }
  } catch (error) {
    console.error("[redis-cache] Set error:", error);
  }
}

/**
 * Invalidate all cache keys associated with a tag.
 */
export async function cacheInvalidateByTag(tag: string): Promise<void> {
  try {
    const keys = await redis.smembers(`tag:${tag}`);
    if (keys.length > 0) {
      await redis.del(...keys);
      await redis.del(`tag:${tag}`);
    }
  } catch (error) {
    console.error("[redis-cache] Invalidate by tag error:", error);
  }
}

/**
 * Invalidate a single cache key.
 */
export async function cacheInvalidate(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (error) {
    console.error("[redis-cache] Invalidate error:", error);
  }
}

// Cache key generators
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
