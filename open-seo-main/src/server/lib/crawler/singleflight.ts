/**
 * Redis-based Singleflight for Crawl Request Deduplication
 *
 * Per 64-RESEARCH.md Pattern 1: Uses Redis SET NX EX for atomic lock acquisition.
 * When multiple workers request the same URL simultaneously, only one crawl executes
 * and others receive the shared result.
 *
 * Key features:
 * - Atomic lock with SET key NX EX (not separate SETNX + EXPIRE)
 * - Pub/sub notification for fast wakeup
 * - Polling fallback to prevent lost wakeups
 * - Subscribe before check pattern (per Pitfall 4)
 *
 * @module singleflight
 */

import type Redis from "ioredis";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { recordSingleflight } from "@/server/lib/metrics/crawl-metrics";

/** Constants per 64-RESEARCH.md */
const LOCK_TTL_SECONDS = 300; // 5 minutes max for crawl
const RESULT_TTL_SECONDS = 3600; // 1 hour cache
const POLL_INTERVAL_MS = 100; // Waiter polling interval
const MAX_WAIT_MS = 300_000; // 5 minutes timeout

/**
 * Result of a singleflight execution.
 */
export interface SingleflightResult<T> {
  /** The result value */
  result: T;
  /** True if result came from cache or another leader */
  shared: boolean;
  /** Time spent waiting (0 for cache hits, >0 for followers) */
  waitTimeMs: number;
}

/**
 * Redis-based singleflight implementation for crawl deduplication.
 *
 * Ensures only one execution per unique key within the TTL window.
 * Concurrent requests for the same key receive the shared result.
 *
 * @example
 * ```typescript
 * const singleflight = new Singleflight<CrawlResult>("crawl");
 *
 * // Multiple concurrent calls with same URL
 * const results = await Promise.all([
 *   singleflight.execute("https://example.com", () => crawlPage("https://example.com")),
 *   singleflight.execute("https://example.com", () => crawlPage("https://example.com")),
 *   singleflight.execute("https://example.com", () => crawlPage("https://example.com")),
 * ]);
 *
 * // Only one crawl executed, all three got same result
 * ```
 */
export class Singleflight<T> {
  private redis: Redis;
  private keyPrefix: string;

  /**
   * Create a new Singleflight instance.
   *
   * @param keyPrefix - Prefix for Redis keys (e.g., "crawl" creates "crawl:lock:*")
   */
  constructor(keyPrefix: string) {
    this.redis = getSharedBullMQConnection("singleflight");
    this.keyPrefix = keyPrefix;
  }

  /**
   * Execute a function with singleflight deduplication.
   *
   * If result is cached, returns immediately.
   * If lock acquired, executes function and shares result.
   * If lock not acquired, waits for result from leader.
   *
   * @param key - Unique key for deduplication (e.g., URL hash)
   * @param fn - Function to execute (only called if we're the leader)
   * @returns Result with shared flag and wait time
   * @throws If leader fails or timeout exceeded
   */
  async execute(key: string, fn: () => Promise<T>): Promise<SingleflightResult<T>> {
    const lockKey = `${this.keyPrefix}:lock:${key}`;
    const resultKey = `${this.keyPrefix}:result:${key}`;
    const channel = `${this.keyPrefix}:done:${key}`;
    const startTime = Date.now();

    // Check cached result first (fastest path)
    const cached = await this.redis.get(resultKey);
    if (cached) {
      recordSingleflight(true); // Cache hit - record for metrics
      return {
        result: JSON.parse(cached) as T,
        shared: true,
        waitTimeMs: Date.now() - startTime,
      };
    }

    // Attempt to acquire lock atomically with TTL
    // Uses SET key value NX EX seconds (atomic, not separate SETNX + EXPIRE)
    // Cast to unknown first for ioredis 5.x compatibility with positional args
    const workerId = `${String(process.pid)}:${String(Date.now())}`;
    const acquired = await (this.redis as unknown as {
      set(key: string, value: string, nx: "NX", ex: "EX", ttl: number): Promise<string | null>;
    }).set(lockKey, workerId, "NX", "EX", LOCK_TTL_SECONDS);

    if (acquired === "OK") {
      // We are the leader - execute the function (miss - we do the work)
      recordSingleflight(false);
      return this.executeAsLeader(fn, lockKey, resultKey, channel, startTime);
    }

    // We are a follower - wait for result
    return this.waitForResult(resultKey, channel, startTime);
  }

  /**
   * Execute function as the leader, store result, notify waiters.
   */
  private async executeAsLeader(
    fn: () => Promise<T>,
    lockKey: string,
    resultKey: string,
    channel: string,
    startTime: number
  ): Promise<SingleflightResult<T>> {
    try {
      const result = await fn();

      // Store result and notify waiters atomically via pipeline
      const pipeline = this.redis.pipeline();
      pipeline.set(resultKey, JSON.stringify(result), "EX", RESULT_TTL_SECONDS);
      pipeline.del(lockKey);
      pipeline.publish(channel, "done");
      await pipeline.exec();

      return {
        result,
        shared: false,
        waitTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      // Clean up lock and notify waiters of failure
      await this.redis.del(lockKey);
      await this.redis.publish(channel, "fail");
      throw error;
    }
  }

  /**
   * Wait for result from leader via pub/sub + polling fallback.
   *
   * Per Pitfall 4: Subscribe BEFORE checking result to prevent lost wakeup.
   *
   * CRIT-PERF-01 Fix: Properly guard against race conditions by:
   * 1. Setting `resolved = true` FIRST in cleanup (before other operations)
   * 2. Checking `resolved` flag at the start of async handlers
   * 3. Using a single cleanup function that's idempotent
   */
  private async waitForResult(
    resultKey: string,
    channel: string,
    startTime: number
  ): Promise<SingleflightResult<T>> {
    // Create subscriber connection (ioredis requires separate connection for subscribe)
    const subscriber = this.redis.duplicate();

    try {
      // Subscribe BEFORE checking result (prevents lost wakeup race)
      await subscriber.subscribe(channel);

      // Check if result appeared while subscribing
      const cached = await this.redis.get(resultKey);
      if (cached) {
        recordSingleflight(true); // Follower got shared result
        await this.cleanupSubscriber(subscriber, channel);
        return {
          result: JSON.parse(cached) as T,
          shared: true,
          waitTimeMs: Date.now() - startTime,
        };
      }

      // Wait for notification with polling fallback
      const deadline = startTime + MAX_WAIT_MS;

      return new Promise<SingleflightResult<T>>((resolve, reject) => {
        let resolved = false;
        let pollTimer: ReturnType<typeof setInterval> | null = null;

        // M64-01 Fix: Set `resolved = true` FIRST to prevent race conditions
        // where handlers fire after cleanup starts but before disconnect completes
        const cleanup = () => {
          if (resolved) return; // Already cleaned up - idempotent
          resolved = true; // FIRST: Set flag before any async operations

          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
          subscriber.removeAllListeners("message");
          subscriber.unsubscribe(channel).catch(() => {});
          subscriber.disconnect();
        };

        const messageHandler = async (ch: string, message: string) => {
          // CRIT-PERF-01 Fix: Check resolved flag FIRST to prevent
          // processing after timeout/cleanup has occurred
          if (resolved) return;
          if (ch !== channel) return;

          if (message === "done") {
            // Double-check resolved hasn't changed during await
            if (resolved) return;

            const result = await this.redis.get(resultKey);

            // Check again after async operation
            if (resolved) return;

            if (result) {
              recordSingleflight(true); // Follower got shared result via pub/sub
              cleanup();
              resolve({
                result: JSON.parse(result) as T,
                shared: true,
                waitTimeMs: Date.now() - startTime,
              });
            }
          } else if (message === "fail") {
            if (resolved) return;
            cleanup();
            reject(new Error("Leader task failed"));
          }
        };

        // Polling fallback in case pub/sub message was lost
        pollTimer = setInterval(async () => {
          // CRIT-PERF-01 Fix: Early return if already resolved
          if (resolved) return;

          if (Date.now() > deadline) {
            cleanup();
            reject(new Error("Singleflight wait timeout"));
            return;
          }

          // Check if result appeared
          const result = await this.redis.get(resultKey);

          // Check again after async operation (may have resolved during await)
          if (resolved) return;

          if (result) {
            recordSingleflight(true); // Follower got shared result via polling
            cleanup();
            resolve({
              result: JSON.parse(result) as T,
              shared: true,
              waitTimeMs: Date.now() - startTime,
            });
          }
        }, POLL_INTERVAL_MS);

        subscriber.on("message", messageHandler);
      });
    } catch (error) {
      await this.cleanupSubscriber(subscriber, channel);
      throw error;
    }
  }

  /**
   * Clean up subscriber connection.
   */
  private async cleanupSubscriber(subscriber: Redis, channel: string): Promise<void> {
    try {
      await subscriber.unsubscribe(channel);
      subscriber.disconnect();
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Create a singleflight instance for crawl operations.
 *
 * Uses tenant-prefixed keys per T-64-01 threat mitigation.
 *
 * @param tenantId - Tenant ID for key isolation
 * @returns Singleflight instance scoped to tenant
 */
export function createCrawlSingleflight<T>(tenantId: string): Singleflight<T> {
  return new Singleflight<T>(`crawl:${tenantId}`);
}
