/**
 * Request deduplication utilities for expensive server actions.
 *
 * Prevents duplicate processing when the same request is sent multiple times
 * (e.g., double-clicks, network retries, concurrent components making same call).
 *
 * Uses Redis for distributed deduplication across server instances.
 */

import { redis } from "@/lib/redis/client";
import crypto from "crypto";

/** Default dedup window in seconds */
const DEDUP_TTL = 60;

/** Processing marker value */
const PROCESSING_MARKER = "__processing__";

/**
 * Sleep helper for polling.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Deduplicate an expensive request operation.
 *
 * If another request with the same key is already processing,
 * waits for and returns its result instead of processing again.
 *
 * If a completed result exists within the TTL window,
 * returns the cached result immediately.
 *
 * @param key - Unique identifier for this request (use createRequestHash for params)
 * @param operation - The expensive operation to execute
 * @param ttlSeconds - How long to cache the result (default: 60s)
 * @returns Promise resolving to the operation result
 *
 * @example
 * ```typescript
 * const hash = createRequestHash({ clientId, options });
 * return deduplicateRequest(`predictions:${hash}`, async () => {
 *   return runExpensiveML(clientId, options);
 * });
 * ```
 */
export async function deduplicateRequest<T>(
  key: string,
  operation: () => Promise<T>,
  ttlSeconds: number = DEDUP_TTL
): Promise<T> {
  const lockKey = `dedup:${key}`;

  try {
    // Try to get existing result
    const existing = await redis.get(lockKey);
    if (existing && existing !== PROCESSING_MARKER) {
      return JSON.parse(existing) as T;
    }

    // Try to acquire processing lock
    const acquired = await redis.set(
      lockKey,
      PROCESSING_MARKER,
      "EX",
      ttlSeconds,
      "NX"
    );

    if (!acquired) {
      // Another request is processing, wait and poll for result
      const maxWaitMs = ttlSeconds * 1000;
      const pollIntervalMs = 100;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        await sleep(pollIntervalMs);

        const result = await redis.get(lockKey);
        if (result && result !== PROCESSING_MARKER) {
          return JSON.parse(result) as T;
        }

        // If lock was deleted (failed operation), allow retry
        if (result === null) {
          break;
        }
      }

      // Timeout waiting for result, execute operation ourselves
      // This handles edge cases where the original processor failed silently
    }

    // Execute the operation
    try {
      const result = await operation();
      // Store result for deduplication window
      await redis.setex(lockKey, ttlSeconds, JSON.stringify(result));
      return result;
    } catch (error) {
      // Clean up lock on error so retries can proceed
      await redis.del(lockKey);
      throw error;
    }
  } catch (error) {
    // If Redis fails, fall back to executing operation directly
    // Better to allow potential duplicates than to fail completely
    if (
      error instanceof Error &&
      (error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND"))
    ) {
      console.error("[dedup] Redis unavailable, executing operation directly");
      return operation();
    }
    throw error;
  }
}

/**
 * Create a hash from request parameters for deduplication keys.
 *
 * Produces a consistent hash regardless of object property order.
 *
 * @param params - Request parameters to hash
 * @returns 16-character hex hash
 *
 * @example
 * ```typescript
 * const hash = createRequestHash({ clientId: "123", type: "growth" });
 * // hash: "a1b2c3d4e5f67890"
 * ```
 */
export function createRequestHash(params: Record<string, unknown>): string {
  // Sort keys for consistent hashing regardless of property order
  const sortedParams = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = params[key];
        return acc;
      },
      {} as Record<string, unknown>
    );

  return crypto
    .createHash("sha256")
    .update(JSON.stringify(sortedParams))
    .digest("hex")
    .substring(0, 16);
}

/**
 * Check if a request is currently being processed.
 *
 * Useful for UI feedback (e.g., showing "processing" state).
 *
 * @param key - Request key to check
 * @returns True if request is currently processing
 */
export async function isRequestProcessing(key: string): Promise<boolean> {
  const lockKey = `dedup:${key}`;
  const value = await redis.get(lockKey);
  return value === PROCESSING_MARKER;
}

/**
 * Clear a dedup cache entry.
 *
 * Useful for forcing a fresh operation on next request.
 *
 * @param key - Request key to clear
 */
export async function clearDedupCache(key: string): Promise<void> {
  const lockKey = `dedup:${key}`;
  await redis.del(lockKey);
}
