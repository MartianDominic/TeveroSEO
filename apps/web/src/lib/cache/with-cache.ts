/**
 * Cache wrapper for server actions.
 * Provides a HOF to wrap async functions with Redis caching.
 */

import crypto from "crypto";
import { cacheGet, cacheSet, type CacheOptions } from "./redis-cache";

interface WithCacheOptions extends CacheOptions {
  key: string;
}

/**
 * Wrap a function with Redis caching.
 * The getOptions function receives the same arguments as the wrapped function
 * and returns cache configuration including the key.
 */
export function withCache<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  getOptions: (...args: TArgs) => WithCacheOptions
) {
  return async (...args: TArgs): Promise<TResult> => {
    const options = getOptions(...args);

    // Check cache first
    const cached = await cacheGet<TResult>(options.key);
    if (cached !== null) {
      return cached;
    }

    // Execute function
    const result = await fn(...args);

    // Cache result
    await cacheSet(options.key, result, options);

    return result;
  };
}

/**
 * Hash function for complex query params.
 * Creates a short, deterministic hash from an object for use in cache keys.
 */
export function hashParams(params: object): string {
  return crypto
    .createHash("md5")
    .update(JSON.stringify(params))
    .digest("hex")
    .slice(0, 12);
}
