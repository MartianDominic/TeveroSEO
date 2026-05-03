/**
 * Singleflight/coalescing utility for preventing cache stampede.
 *
 * When multiple concurrent requests need the same expensive data,
 * singleflight ensures only ONE request actually fetches the data
 * while all others wait for and share the result.
 *
 * This prevents cache stampede where N concurrent requests after
 * a cache miss would all hit the backend simultaneously.
 */

import { logger } from '@/lib/logger';

// In-flight requests map: cacheKey -> Promise
const inFlightRequests = new Map<string, Promise<unknown>>();

/**
 * Execute a function with singleflight deduplication.
 *
 * If a request for the same key is already in flight, waits for and returns
 * the existing promise instead of starting a new request.
 *
 * @param key - Unique identifier for this request (typically cache key)
 * @param fn - Async function to execute (only called if no in-flight request)
 * @returns Promise resolving to the function result
 *
 * @example
 * ```typescript
 * // Multiple concurrent calls with same key only execute fn once
 * const [a, b, c] = await Promise.all([
 *   singleflight("user:123", () => fetchUser("123")),
 *   singleflight("user:123", () => fetchUser("123")),
 *   singleflight("user:123", () => fetchUser("123")),
 * ]);
 * // fetchUser("123") is called exactly once, result shared by all three
 * ```
 */
export async function singleflight<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  // If request already in flight, wait for it
  const existing = inFlightRequests.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  // Start new request and track it
  const promise = fn().finally(() => {
    // Remove from in-flight once complete (success or failure)
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);
  return promise;
}

/**
 * Get cached value with singleflight protection for cache misses.
 *
 * Flow:
 * 1. Check cache - if hit, return immediately
 * 2. If miss, use singleflight to ensure only one fetch runs
 * 3. Cache the result and return
 *
 * This prevents cache stampede by coalescing concurrent cache misses
 * into a single backend request.
 *
 * @param cacheKey - Cache key for storage
 * @param ttlSeconds - Cache TTL in seconds
 * @param fetcher - Function to fetch data on cache miss
 * @param cacheGet - Cache get function (injected for flexibility)
 * @param cacheSet - Cache set function (injected for flexibility)
 * @param tags - Optional cache tags for invalidation
 * @returns Promise resolving to the data
 *
 * @example
 * ```typescript
 * import { cacheGet, cacheSet, cacheTags } from "@/lib/cache";
 *
 * const patterns = await getCachedWithSingleflight(
 *   `patterns:${workspaceId}`,
 *   300,
 *   async () => {
 *     const data = await fetchExpensivePatternData(workspaceId);
 *     return processPatterns(data);
 *   },
 *   cacheGet,
 *   cacheSet,
 *   [cacheTags.workspace(workspaceId)]
 * );
 * ```
 */
export async function getCachedWithSingleflight<T>(
  cacheKey: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
  cacheGet: (key: string) => Promise<T | null>,
  cacheSet: (key: string, value: T, options: { ttl: number; tags?: string[] }) => Promise<void>,
  tags: string[] = []
): Promise<T> {
  // Try cache first
  const cached = await cacheGet(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Singleflight the fetch - only one request per key
  const data = await singleflight(cacheKey, fetcher);

  // Cache the result (fire-and-forget)
  cacheSet(cacheKey, data, { ttl: ttlSeconds, tags }).catch((err) => {
    logger.error("[singleflight] Failed to cache result", err instanceof Error ? err : { error: String(err) });
  });

  return data;
}

/**
 * Get current count of in-flight requests.
 * Useful for monitoring and debugging.
 */
export function getInFlightCount(): number {
  return inFlightRequests.size;
}

/**
 * Get all in-flight request keys.
 * Useful for debugging.
 */
export function getInFlightKeys(): string[] {
  return Array.from(inFlightRequests.keys());
}
