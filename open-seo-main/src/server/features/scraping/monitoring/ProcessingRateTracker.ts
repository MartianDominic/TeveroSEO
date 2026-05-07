/**
 * Processing Rate Tracker for Monitoring.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 *
 * Uses Redis sorted sets to track job completion timestamps
 * and calculate processing rates over sliding windows.
 */

import type Redis from "ioredis";
import type { ScrapeQueueName } from "../queue/queue.types";
import { SCRAPE_QUEUE_NAMES } from "../queue/queue.types";

/**
 * Processing rate statistics.
 */
export interface ProcessingRateStats {
  /** Jobs per second over the last minute */
  ratePerSecond: number;

  /** Jobs per minute over the last minute */
  ratePerMinute: number;

  /** Total jobs in window */
  totalInWindow: number;

  /** Window size in ms */
  windowMs: number;
}

/**
 * Processing statistics across all queues.
 */
export interface GlobalProcessingStats {
  /** Stats per queue */
  byQueue: Record<ScrapeQueueName, ProcessingRateStats>;

  /** Combined stats across all queues */
  total: ProcessingRateStats;

  /** Average processing time in ms */
  avgProcessingTimeMs: number;
}

/**
 * Tracks processing rates using Redis sorted sets.
 */
export class ProcessingRateTracker {
  private readonly redis: Redis;
  private readonly windowMs: number;
  private readonly processingTimesWindowMs: number;

  constructor(redis: Redis, windowMs: number = 60_000) {
    this.redis = redis;
    this.windowMs = windowMs;
    this.processingTimesWindowMs = 300_000; // 5 min for processing times
  }

  /**
   * Record a job completion.
   *
   * @param queue - Queue that processed the job
   * @param processingTimeMs - Time taken to process the job
   */
  async recordCompletion(queue: ScrapeQueueName, processingTimeMs: number): Promise<void> {
    const now = Date.now();
    const key = `metrics:processing_rate:${queue}`;
    const timesKey = `metrics:processing_times:${queue}`;

    const uniqueId = `${now}:${Math.random().toString(36).slice(2, 9)}`;

    // Use pipeline for atomic operations
    const pipeline = this.redis.multi();

    // Add completion timestamp
    pipeline.zadd(key, now.toString(), uniqueId);

    // Clean up old entries
    pipeline.zremrangebyscore(key, "-inf", (now - this.windowMs).toString());

    // Set expiry on the key
    pipeline.expire(key, Math.ceil(this.windowMs / 1000) * 2);

    // Track processing time
    pipeline.zadd(timesKey, now.toString(), `${now}:${processingTimeMs}`);
    pipeline.zremrangebyscore(timesKey, "-inf", (now - this.processingTimesWindowMs).toString());
    pipeline.expire(timesKey, Math.ceil(this.processingTimesWindowMs / 1000) * 2);

    // Execute the pipeline (Redis MULTI/EXEC)
    await pipeline.exec();
  }

  /**
   * Get processing rate for a specific queue.
   *
   * @param queue - Queue to get rate for
   * @returns Processing rate statistics
   */
  async getRate(queue: ScrapeQueueName): Promise<ProcessingRateStats> {
    const key = `metrics:processing_rate:${queue}`;
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Count jobs in window
    const count = await this.redis.zcount(key, windowStart.toString(), now.toString());

    const windowSeconds = this.windowMs / 1000;

    return {
      ratePerSecond: count / windowSeconds,
      ratePerMinute: (count / windowSeconds) * 60,
      totalInWindow: count,
      windowMs: this.windowMs,
    };
  }

  /**
   * Get global processing statistics across all queues.
   */
  async getGlobalStats(): Promise<GlobalProcessingStats> {
    const [priorityStats, standardStats, backgroundStats, avgProcessingTime] = await Promise.all([
      this.getRate(SCRAPE_QUEUE_NAMES.PRIORITY),
      this.getRate(SCRAPE_QUEUE_NAMES.STANDARD),
      this.getRate(SCRAPE_QUEUE_NAMES.BACKGROUND),
      this.getAverageProcessingTime(),
    ]);

    const totalCount =
      priorityStats.totalInWindow +
      standardStats.totalInWindow +
      backgroundStats.totalInWindow;

    const windowSeconds = this.windowMs / 1000;

    return {
      byQueue: {
        [SCRAPE_QUEUE_NAMES.PRIORITY]: priorityStats,
        [SCRAPE_QUEUE_NAMES.STANDARD]: standardStats,
        [SCRAPE_QUEUE_NAMES.BACKGROUND]: backgroundStats,
      },
      total: {
        ratePerSecond: totalCount / windowSeconds,
        ratePerMinute: (totalCount / windowSeconds) * 60,
        totalInWindow: totalCount,
        windowMs: this.windowMs,
      },
      avgProcessingTimeMs: avgProcessingTime,
    };
  }

  /**
   * Get average processing time across all queues.
   */
  async getAverageProcessingTime(): Promise<number> {
    let totalTime = 0;
    let count = 0;
    const now = Date.now();

    for (const queueName of Object.values(SCRAPE_QUEUE_NAMES)) {
      const key = `metrics:processing_times:${queueName}`;
      const entries = await this.redis.zrangebyscore(
        key,
        (now - this.processingTimesWindowMs).toString(),
        now.toString()
      );

      for (const entry of entries) {
        // Entry format: "timestamp:processingTime"
        const parts = entry.split(":");
        if (parts.length >= 2) {
          const processingTime = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(processingTime)) {
            totalTime += processingTime;
            count++;
          }
        }
      }
    }

    return count > 0 ? totalTime / count : 0;
  }

  /**
   * Get processing time percentiles.
   */
  async getProcessingTimePercentiles(): Promise<{
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  }> {
    const times: number[] = [];
    const now = Date.now();

    for (const queueName of Object.values(SCRAPE_QUEUE_NAMES)) {
      const key = `metrics:processing_times:${queueName}`;
      const entries = await this.redis.zrangebyscore(
        key,
        (now - this.processingTimesWindowMs).toString(),
        now.toString()
      );

      for (const entry of entries) {
        const parts = entry.split(":");
        if (parts.length >= 2) {
          const processingTime = parseInt(parts[parts.length - 1], 10);
          if (!isNaN(processingTime)) {
            times.push(processingTime);
          }
        }
      }
    }

    if (times.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0 };
    }

    times.sort((a, b) => a - b);

    return {
      p50: times[Math.floor(times.length * 0.5)],
      p90: times[Math.floor(times.length * 0.9)],
      p95: times[Math.floor(times.length * 0.95)],
      p99: times[Math.floor(times.length * 0.99)],
    };
  }

  /**
   * Clear all metrics (for testing).
   */
  async clear(): Promise<void> {
    for (const queueName of Object.values(SCRAPE_QUEUE_NAMES)) {
      await this.redis.del(`metrics:processing_rate:${queueName}`);
      await this.redis.del(`metrics:processing_times:${queueName}`);
    }
  }
}
