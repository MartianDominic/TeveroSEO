/**
 * Request deduplication utilities for expensive server actions.
 *
 * Prevents duplicate processing when the same request is sent multiple times
 * (e.g., double-clicks, network retries, concurrent components making same call).
 *
 * Uses Redis for distributed deduplication across server instances.
 */

import crypto from "crypto";

import { logger } from '@/lib/logger';
import { redis } from "@/lib/redis/client";

import type { ZodLikeSchema } from "./utils/type-guards";

/** Default dedup window in seconds */
const DEDUP_TTL = 60;

/** Processing marker value */
const PROCESSING_MARKER = "__processing__";

/** Maximum entries in the in-memory LRU cache */
const IN_MEMORY_CACHE_MAX_SIZE = 1000;

/** Maximum size per cache entry in bytes (100KB) */
const MAX_ENTRY_SIZE_BYTES = 100 * 1024;

/** Total memory budget for cache in bytes (100MB) */
const TOTAL_MEMORY_BUDGET_BYTES = 100 * 1024 * 1024;

/** Cleanup interval in milliseconds (5 minutes) */
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Simple in-memory LRU cache for deduplication fallback when Redis is unavailable.
 * Stores cached results with TTL-based expiration.
 *
 * Includes memory protection:
 * - Per-entry size limit (100KB)
 * - Total memory budget (100MB)
 * - Automatic eviction when limits exceeded
 * - Periodic cleanup timer to prevent unbounded memory growth
 */
class InMemoryDedupCache {
  private cache = new Map<string, { value: string; expiresAt: number; sizeBytes: number }>();
  private readonly maxSize: number;
  private readonly maxEntrySize: number;
  private readonly memoryBudget: number;
  private currentMemoryUsage = 0;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(
    maxSize = IN_MEMORY_CACHE_MAX_SIZE,
    maxEntrySize = MAX_ENTRY_SIZE_BYTES,
    memoryBudget = TOTAL_MEMORY_BUDGET_BYTES
  ) {
    this.maxSize = maxSize;
    this.maxEntrySize = maxEntrySize;
    this.memoryBudget = memoryBudget;
    this.startPeriodicCleanup();
  }

  /**
   * Start periodic cleanup timer to remove expired entries.
   * Prevents unbounded memory growth from stale entries.
   */
  private startPeriodicCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL_MS);

    // Don't prevent Node.js from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Remove all expired entries from the cache.
   */
  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        keysToDelete.push(key);
        this.currentMemoryUsage -= entry.sizeBytes;
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.log(
        `[dedup] Periodic cleanup removed ${keysToDelete.length} expired entries, ` +
        `${this.cache.size} remaining, ${Math.round(this.currentMemoryUsage / 1024)}KB used`
      );
    }
  }

  /**
   * Stop the periodic cleanup timer and release resources.
   * Call this when shutting down the application.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    this.currentMemoryUsage = 0;
  }

  /**
   * Estimate size of a string in bytes (UTF-8).
   */
  private estimateSize(value: string): number {
    // Rough estimate: 2 bytes per character for UTF-16 internal representation
    // Plus overhead for the entry structure (~100 bytes)
    return value.length * 2 + 100;
  }

  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.currentMemoryUsage -= entry.sizeBytes;
      this.cache.delete(key);
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: string, ttlSeconds: number): boolean {
    const sizeBytes = this.estimateSize(value);

    // Reject entries that exceed per-entry size limit
    if (sizeBytes > this.maxEntrySize) {
      logger.warn(`[dedup] Rejecting oversized cache entry: ${sizeBytes} bytes exceeds ${this.maxEntrySize} byte limit`);
      return false;
    }

    // Remove existing entry if present (to update memory tracking)
    const existing = this.cache.get(key);
    if (existing) {
      this.currentMemoryUsage -= existing.sizeBytes;
      this.cache.delete(key);
    }

    // Evict entries until we have room in memory budget
    while (
      this.currentMemoryUsage + sizeBytes > this.memoryBudget ||
      this.cache.size >= this.maxSize
    ) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        const evicted = this.cache.get(oldestKey);
        if (evicted) {
          this.currentMemoryUsage -= evicted.sizeBytes;
        }
        this.cache.delete(oldestKey);
      } else {
        break;
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
      sizeBytes,
    });
    this.currentMemoryUsage += sizeBytes;
    return true;
  }

  /**
   * Attempt to set only if key doesn't exist (NX behavior).
   * Returns true if set, false if key already exists.
   */
  setNX(key: string, value: string, ttlSeconds: number): boolean {
    const existing = this.get(key);
    if (existing !== null) return false;

    return this.set(key, value, ttlSeconds);
  }

  delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentMemoryUsage -= entry.sizeBytes;
    }
    this.cache.delete(key);
  }

  /**
   * Get current memory usage statistics.
   */
  getStats(): { entryCount: number; memoryUsageBytes: number; memoryBudgetBytes: number } {
    return {
      entryCount: this.cache.size,
      memoryUsageBytes: this.currentMemoryUsage,
      memoryBudgetBytes: this.memoryBudget,
    };
  }
}

/** In-memory fallback cache for when Redis is unavailable */
const inMemoryDedupCache = new InMemoryDedupCache();

/**
 * Sleep helper for polling.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface DeduplicateRequestOptions<T> {
  /** How long to cache the result in seconds (default: 60s) */
  ttlSeconds?: number;
  /** Optional Zod schema for validating cached results */
  schema?: ZodLikeSchema<T>;
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
 * @param options - Configuration options including TTL and optional schema
 * @returns Promise resolving to the operation result
 *
 * @example
 * ```typescript
 * const hash = createRequestHash({ clientId, options });
 * return deduplicateRequest(`predictions:${hash}`, async () => {
 *   return runExpensiveML(clientId, options);
 * }, { schema: PredictionResultSchema });
 * ```
 */
export async function deduplicateRequest<T>(
  key: string,
  operation: () => Promise<T>,
  options: DeduplicateRequestOptions<T> | number = DEDUP_TTL
): Promise<T> {
  // Support legacy signature where third param was just ttlSeconds
  const { ttlSeconds = DEDUP_TTL, schema } = typeof options === 'number'
    ? { ttlSeconds: options, schema: undefined }
    : options;
  const lockKey = `dedup:${key}`;

  try {
    // Try to get existing result
    const existing = await redis.get(lockKey);
    if (existing && existing !== PROCESSING_MARKER) {
      const parsed: unknown = JSON.parse(existing);
      if (schema) {
        const result = schema.safeParse(parsed);
        if (!result.success) {
          console.warn(`[dedup] Cached result validation failed for key "${key}": ${result.error.message}`);
          // Invalidate corrupted cache entry and re-execute
          await redis.del(lockKey);
        } else {
          return result.data;
        }
      } else {
        return parsed as T;
      }
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

        const cachedResult = await redis.get(lockKey);
        if (cachedResult && cachedResult !== PROCESSING_MARKER) {
          const parsed: unknown = JSON.parse(cachedResult);
          if (schema) {
            const validationResult = schema.safeParse(parsed);
            if (!validationResult.success) {
              console.warn(`[dedup] Polled result validation failed for key "${key}": ${validationResult.error.message}`);
              // Break out and re-execute if validation fails
              break;
            }
            return validationResult.data;
          }
          return parsed as T;
        }

        // If lock was deleted (failed operation), allow retry
        if (cachedResult === null) {
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
    // If Redis fails, fall back to in-memory cache for deduplication
    if (
      error instanceof Error &&
      (error.message.includes("ECONNREFUSED") ||
        error.message.includes("ENOTFOUND") ||
        error.message.includes("ETIMEDOUT") ||
        error.message.includes("Redis"))
    ) {
      logger.warn("[dedup] Redis unavailable, using in-memory fallback");
      return deduplicateRequestInMemory(key, operation, { ttlSeconds, schema });
    }
    throw error;
  }
}

/**
 * In-memory fallback for deduplication when Redis is unavailable.
 * Uses a simple LRU cache with TTL-based expiration.
 */
async function deduplicateRequestInMemory<T>(
  key: string,
  operation: () => Promise<T>,
  options: { ttlSeconds: number; schema?: ZodLikeSchema<T> }
): Promise<T> {
  const { ttlSeconds, schema } = options;
  const lockKey = `dedup:${key}`;

  // Try to get existing result
  const existing = inMemoryDedupCache.get(lockKey);
  if (existing && existing !== PROCESSING_MARKER) {
    const parsed: unknown = JSON.parse(existing);
    if (schema) {
      const result = schema.safeParse(parsed);
      if (!result.success) {
        console.warn(`[dedup] In-memory cached result validation failed for key "${key}": ${result.error.message}`);
        inMemoryDedupCache.delete(lockKey);
      } else {
        return result.data;
      }
    } else {
      return parsed as T;
    }
  }

  // Try to acquire processing lock
  const acquired = inMemoryDedupCache.setNX(lockKey, PROCESSING_MARKER, ttlSeconds);

  if (!acquired) {
    // Another request is processing, wait and poll for result
    const maxWaitMs = ttlSeconds * 1000;
    const pollIntervalMs = 100;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      await sleep(pollIntervalMs);

      const cachedResult = inMemoryDedupCache.get(lockKey);
      if (cachedResult && cachedResult !== PROCESSING_MARKER) {
        const parsed: unknown = JSON.parse(cachedResult);
        if (schema) {
          const validationResult = schema.safeParse(parsed);
          if (!validationResult.success) {
            console.warn(`[dedup] In-memory polled result validation failed for key "${key}": ${validationResult.error.message}`);
            break;
          }
          return validationResult.data;
        }
        return parsed as T;
      }

      // If lock was deleted (failed operation), allow retry
      if (cachedResult === null) {
        break;
      }
    }
  }

  // Execute the operation
  try {
    const result = await operation();
    inMemoryDedupCache.set(lockKey, JSON.stringify(result), ttlSeconds);
    return result;
  } catch (error) {
    inMemoryDedupCache.delete(lockKey);
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
