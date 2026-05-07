/**
 * Global Concurrency Limiter using Redis Sorted Sets.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 *
 * Features:
 * - 200 concurrent requests max (configurable)
 * - Distributed semaphore via Redis sorted sets
 * - Automatic stale entry cleanup (5 min TTL)
 * - Race condition protection via verify-after-add
 */

import type Redis from "ioredis";

/**
 * Result of acquiring a concurrency slot.
 */
export interface AcquireResult {
  /** Whether the slot was successfully acquired */
  acquired: boolean;

  /** Time spent waiting for the slot in ms */
  waitedMs: number;

  /** Position in the queue when acquired (0-indexed) */
  position: number;
}

/**
 * Current load statistics.
 */
export interface LoadStats {
  /** Current number of concurrent requests */
  current: number;

  /** Maximum allowed concurrent requests */
  max: number;

  /** Utilization percentage (0-1) */
  utilization: number;
}

/**
 * Configuration for global concurrency limiter.
 */
export interface GlobalConcurrencyConfig {
  /** Maximum concurrent requests (default: 200) */
  maxConcurrent: number;

  /** Default timeout for acquiring a slot in ms (default: 30000) */
  defaultTimeoutMs: number;

  /** Time after which entries are considered stale in ms (default: 300000 = 5 min) */
  staleThresholdMs: number;

  /** Interval between retry attempts in ms (default: 100) */
  retryIntervalMs: number;
}

/**
 * Default global concurrency configuration.
 */
const DEFAULT_CONFIG: GlobalConcurrencyConfig = {
  maxConcurrent: 200,
  defaultTimeoutMs: 30_000,
  staleThresholdMs: 300_000, // 5 minutes
  retryIntervalMs: 100,
};

/**
 * Sleep utility for async delays.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Global concurrency limiter using Redis sorted sets.
 *
 * Implements a distributed semaphore pattern:
 * - Each request adds itself to a sorted set with current timestamp as score
 * - If count exceeds max, request waits and retries
 * - Requests release their slot on completion
 * - Stale entries (>5 min) are automatically cleaned up
 */
export class GlobalConcurrencyLimiter {
  private readonly redis: Redis;
  private readonly config: GlobalConcurrencyConfig;
  private readonly key = "scrape:concurrency:global";

  constructor(redis: Redis, config: Partial<GlobalConcurrencyConfig> = {}) {
    this.redis = redis;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Acquire a global concurrency slot.
   *
   * @param requestId - Unique identifier for this request
   * @param timeoutMs - Maximum time to wait for a slot (default: config.defaultTimeoutMs)
   * @returns AcquireResult indicating success and wait time
   */
  async acquire(requestId: string, timeoutMs?: number): Promise<AcquireResult> {
    const timeout = timeoutMs ?? this.config.defaultTimeoutMs;
    const startTime = Date.now();

    while (true) {
      const now = Date.now();

      // Clean up stale entries (older than threshold)
      const staleThreshold = now - this.config.staleThresholdMs;
      await this.redis.zremrangebyscore(this.key, "-inf", staleThreshold.toString());

      // Try to acquire
      const count = await this.redis.zcard(this.key);

      if (count < this.config.maxConcurrent) {
        // Add our request with current timestamp as score
        await this.redis.zadd(this.key, now.toString(), requestId);

        // Verify we got in (race condition protection)
        const rank = await this.redis.zrank(this.key, requestId);
        if (rank !== null && rank < this.config.maxConcurrent) {
          // Successfully acquired
          return {
            acquired: true,
            waitedMs: Date.now() - startTime,
            position: rank,
          };
        }

        // We didn't make the cut, remove and retry
        await this.redis.zrem(this.key, requestId);
      }

      // Check timeout
      if (Date.now() - startTime > timeout) {
        return {
          acquired: false,
          waitedMs: Date.now() - startTime,
          position: count,
        };
      }

      // Wait before retry (with jitter to prevent thundering herd)
      const jitter = Math.random() * this.config.retryIntervalMs;
      await sleep(this.config.retryIntervalMs + jitter);
    }
  }

  /**
   * Release a global concurrency slot.
   *
   * @param requestId - The request ID that was acquired
   */
  async release(requestId: string): Promise<void> {
    await this.redis.zrem(this.key, requestId);
  }

  /**
   * Get current load statistics.
   */
  async getCurrentLoad(): Promise<LoadStats> {
    // Clean up stale entries first
    const now = Date.now();
    const staleThreshold = now - this.config.staleThresholdMs;
    await this.redis.zremrangebyscore(this.key, "-inf", staleThreshold.toString());

    const current = await this.redis.zcard(this.key);
    return {
      current,
      max: this.config.maxConcurrent,
      utilization: current / this.config.maxConcurrent,
    };
  }

  /**
   * Check if the system is at capacity.
   */
  async isAtCapacity(): Promise<boolean> {
    const load = await this.getCurrentLoad();
    return load.current >= load.max;
  }

  /**
   * Get the number of available slots.
   */
  async getAvailableSlots(): Promise<number> {
    const load = await this.getCurrentLoad();
    return Math.max(0, load.max - load.current);
  }

  /**
   * Get all active request IDs.
   */
  async getActiveRequests(): Promise<string[]> {
    return this.redis.zrange(this.key, 0, -1);
  }

  /**
   * Force release all slots (use with caution, for maintenance).
   */
  async forceReleaseAll(): Promise<number> {
    const count = await this.redis.zcard(this.key);
    await this.redis.del(this.key);
    return count;
  }

  /**
   * Get the current configuration.
   */
  getConfig(): GlobalConcurrencyConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (for testing or dynamic adjustment).
   */
  updateConfig(updates: Partial<GlobalConcurrencyConfig>): void {
    Object.assign(this.config, updates);
  }

  /**
   * Execute a function with automatic slot acquisition and release.
   *
   * @param requestId - Unique identifier for this request
   * @param fn - Function to execute while holding the slot
   * @param timeoutMs - Maximum time to wait for a slot
   * @returns Result of the function
   * @throws Error if slot cannot be acquired
   */
  async withSlot<T>(
    requestId: string,
    fn: () => Promise<T>,
    timeoutMs?: number
  ): Promise<T> {
    const result = await this.acquire(requestId, timeoutMs);

    if (!result.acquired) {
      throw new Error(
        `Failed to acquire concurrency slot after ${result.waitedMs}ms (position: ${result.position})`
      );
    }

    try {
      return await fn();
    } finally {
      await this.release(requestId);
    }
  }
}
