/**
 * Crawl Metrics Collection Module
 *
 * H64-02 Fix: Migrated from in-memory counters to Redis-backed counters
 * for thread-safety in multi-worker deployments.
 *
 * Tracks metrics for cost savings visualization:
 * - Singleflight hits/misses (deduplication efficiency)
 * - Delta skips by layer L0/L1/L2 (change detection)
 * - Queue completions by lane (workload distribution)
 * - Cost savings calculation from skipped crawls
 *
 * Per 64-RESEARCH.md success criteria:
 * - 98% cost reduction from singleflight
 * - 80%+ skip rate from delta crawling
 *
 * @module crawl-metrics
 */

import { redis } from "@/server/lib/redis";

/** Redis hash key for crawl metrics */
const METRICS_KEY = "crawl:metrics";

/**
 * Cost estimate per crawl operation (self-hosted).
 * Based on CPU/memory/bandwidth overhead for a single crawl.
 */
export const COST_PER_CRAWL_DOLLAR = 0.0001;

/**
 * Crawl metrics structure matching 64-RESEARCH.md spec.
 */
export interface CrawlMetrics {
  /** Singleflight cache hits (request deduplicated) */
  singleflightHits: number;
  /** Singleflight cache misses (new request) */
  singleflightMisses: number;
  /** Delta L0 skips (sitemap lastmod unchanged) */
  deltaL0Skips: number;
  /** Delta L1 skips (HTTP 304 unchanged) */
  deltaL1Skips: number;
  /** Delta L2 skips (hash unchanged) */
  deltaL2Skips: number;
  /** Full L3 processing count */
  fullProcessed: number;
  /** FastAPI queue completions */
  fastApiCompleted: number;
  /** Heavy crawl queue completions */
  heavyCrawlCompleted: number;
  /** Estimated cost savings in dollars */
  costSavingsDollars: number;
}

/**
 * In-memory fallback metrics for when Redis is unavailable.
 * Also used for synchronous recording with async Redis write-through.
 */
const localMetrics: CrawlMetrics = {
  singleflightHits: 0,
  singleflightMisses: 0,
  deltaL0Skips: 0,
  deltaL1Skips: 0,
  deltaL2Skips: 0,
  fullProcessed: 0,
  fastApiCompleted: 0,
  heavyCrawlCompleted: 0,
  costSavingsDollars: 0,
};

/**
 * Record a singleflight event.
 * H64-02: Uses Redis HINCRBY for thread-safe multi-worker counting.
 *
 * @param hit - True if request was deduplicated (cache hit)
 */
export function recordSingleflight(hit: boolean): void {
  if (hit) {
    localMetrics.singleflightHits++;
    localMetrics.costSavingsDollars += COST_PER_CRAWL_DOLLAR;

    // Fire-and-forget Redis update
    redis.hincrby(METRICS_KEY, "singleflightHits", 1).catch(() => {});
    redis.hincrbyfloat(METRICS_KEY, "costSavingsDollars", COST_PER_CRAWL_DOLLAR).catch(() => {});
  } else {
    localMetrics.singleflightMisses++;
    redis.hincrby(METRICS_KEY, "singleflightMisses", 1).catch(() => {});
  }
}

/**
 * Delta layer type for skip tracking.
 */
export type DeltaLayer = "L0" | "L1" | "L2";

/**
 * Record a delta skip at a specific layer.
 * H64-02: Uses Redis HINCRBY for thread-safe multi-worker counting.
 *
 * @param layer - The layer that determined the skip (L0, L1, or L2)
 */
export function recordDeltaSkip(layer: DeltaLayer): void {
  const field = `delta${layer}Skips`;

  switch (layer) {
    case "L0":
      localMetrics.deltaL0Skips++;
      break;
    case "L1":
      localMetrics.deltaL1Skips++;
      break;
    case "L2":
      localMetrics.deltaL2Skips++;
      break;
  }
  localMetrics.costSavingsDollars += COST_PER_CRAWL_DOLLAR;

  // Fire-and-forget Redis update
  redis.hincrby(METRICS_KEY, field, 1).catch(() => {});
  redis.hincrbyfloat(METRICS_KEY, "costSavingsDollars", COST_PER_CRAWL_DOLLAR).catch(() => {});
}

/**
 * Record a full L3 processing event (no skip possible).
 * H64-02: Uses Redis HINCRBY for thread-safe multi-worker counting.
 */
export function recordFullProcess(): void {
  localMetrics.fullProcessed++;
  redis.hincrby(METRICS_KEY, "fullProcessed", 1).catch(() => {});
}

/**
 * Queue lane type for completion tracking.
 */
export type QueueLane = "fastApi" | "heavyCrawl";

/**
 * Record a queue job completion.
 * H64-02: Uses Redis HINCRBY for thread-safe multi-worker counting.
 *
 * @param lane - The queue lane (fastApi or heavyCrawl)
 */
export function recordQueueCompletion(lane: QueueLane): void {
  const field = lane === "fastApi" ? "fastApiCompleted" : "heavyCrawlCompleted";

  switch (lane) {
    case "fastApi":
      localMetrics.fastApiCompleted++;
      break;
    case "heavyCrawl":
      localMetrics.heavyCrawlCompleted++;
      break;
  }

  // Fire-and-forget Redis update
  redis.hincrby(METRICS_KEY, field, 1).catch(() => {});
}

/**
 * Get singleflight deduplication ratio from Redis.
 * H64-02: Reads from Redis for accurate multi-worker aggregation.
 *
 * @returns Ratio of hits to total (0.0-1.0), or 0 if no events
 */
export async function getSingleflightRatio(): Promise<number> {
  try {
    const [hits, misses] = await Promise.all([
      redis.hget(METRICS_KEY, "singleflightHits"),
      redis.hget(METRICS_KEY, "singleflightMisses"),
    ]);
    const hitsNum = parseInt(hits ?? "0", 10);
    const missesNum = parseInt(misses ?? "0", 10);
    const total = hitsNum + missesNum;
    if (total === 0) return 0;
    return hitsNum / total;
  } catch {
    // Fallback to local metrics
    const total = localMetrics.singleflightHits + localMetrics.singleflightMisses;
    if (total === 0) return 0;
    return localMetrics.singleflightHits / total;
  }
}

/**
 * Get delta skip ratio across all layers from Redis.
 * H64-02: Reads from Redis for accurate multi-worker aggregation.
 *
 * @returns Ratio of skips to total (0.0-1.0), or 0 if no events
 */
export async function getDeltaSkipRatio(): Promise<number> {
  try {
    const [l0, l1, l2, full] = await Promise.all([
      redis.hget(METRICS_KEY, "deltaL0Skips"),
      redis.hget(METRICS_KEY, "deltaL1Skips"),
      redis.hget(METRICS_KEY, "deltaL2Skips"),
      redis.hget(METRICS_KEY, "fullProcessed"),
    ]);
    const skips =
      parseInt(l0 ?? "0", 10) +
      parseInt(l1 ?? "0", 10) +
      parseInt(l2 ?? "0", 10);
    const fullNum = parseInt(full ?? "0", 10);
    const total = skips + fullNum;
    if (total === 0) return 0;
    return skips / total;
  } catch {
    // Fallback to local metrics
    const skips =
      localMetrics.deltaL0Skips +
      localMetrics.deltaL1Skips +
      localMetrics.deltaL2Skips;
    const total = skips + localMetrics.fullProcessed;
    if (total === 0) return 0;
    return skips / total;
  }
}

/**
 * Get metrics snapshot from Redis.
 * H64-02: Reads from Redis for accurate multi-worker aggregation.
 *
 * @returns Metrics from Redis (aggregated across all workers)
 */
export async function getMetrics(): Promise<Readonly<CrawlMetrics>> {
  try {
    const data = await redis.hgetall(METRICS_KEY);
    return {
      singleflightHits: parseInt(data.singleflightHits ?? "0", 10),
      singleflightMisses: parseInt(data.singleflightMisses ?? "0", 10),
      deltaL0Skips: parseInt(data.deltaL0Skips ?? "0", 10),
      deltaL1Skips: parseInt(data.deltaL1Skips ?? "0", 10),
      deltaL2Skips: parseInt(data.deltaL2Skips ?? "0", 10),
      fullProcessed: parseInt(data.fullProcessed ?? "0", 10),
      fastApiCompleted: parseInt(data.fastApiCompleted ?? "0", 10),
      heavyCrawlCompleted: parseInt(data.heavyCrawlCompleted ?? "0", 10),
      costSavingsDollars: parseFloat(data.costSavingsDollars ?? "0"),
    };
  } catch {
    // Fallback to local metrics
    return { ...localMetrics };
  }
}

/**
 * Get local (in-process) metrics snapshot.
 * Useful for testing or when Redis is unavailable.
 *
 * @returns Copy of local metrics (mutations do not affect internal state)
 */
export function getLocalMetrics(): Readonly<CrawlMetrics> {
  return { ...localMetrics };
}

/**
 * Reset all metrics to zero.
 * H64-02: Resets both Redis and local metrics.
 * Used for testing and metrics collection window reset.
 */
export async function resetMetrics(): Promise<void> {
  // Reset local metrics
  localMetrics.singleflightHits = 0;
  localMetrics.singleflightMisses = 0;
  localMetrics.deltaL0Skips = 0;
  localMetrics.deltaL1Skips = 0;
  localMetrics.deltaL2Skips = 0;
  localMetrics.fullProcessed = 0;
  localMetrics.fastApiCompleted = 0;
  localMetrics.heavyCrawlCompleted = 0;
  localMetrics.costSavingsDollars = 0;

  // Reset Redis metrics
  try {
    await redis.del(METRICS_KEY);
  } catch {
    // Ignore Redis errors during reset
  }
}

/**
 * Reset local metrics only (synchronous version for testing).
 */
export function resetLocalMetrics(): void {
  localMetrics.singleflightHits = 0;
  localMetrics.singleflightMisses = 0;
  localMetrics.deltaL0Skips = 0;
  localMetrics.deltaL1Skips = 0;
  localMetrics.deltaL2Skips = 0;
  localMetrics.fullProcessed = 0;
  localMetrics.fastApiCompleted = 0;
  localMetrics.heavyCrawlCompleted = 0;
  localMetrics.costSavingsDollars = 0;
}
