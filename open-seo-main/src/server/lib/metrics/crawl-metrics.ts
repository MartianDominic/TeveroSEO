/**
 * Crawl Metrics Collection Module
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
 * Internal mutable metrics state.
 * Use getMetrics() for safe read access.
 */
const metrics: CrawlMetrics = {
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
 *
 * @param hit - True if request was deduplicated (cache hit)
 */
export function recordSingleflight(hit: boolean): void {
  if (hit) {
    metrics.singleflightHits++;
    metrics.costSavingsDollars += COST_PER_CRAWL_DOLLAR;
  } else {
    metrics.singleflightMisses++;
  }
}

/**
 * Delta layer type for skip tracking.
 */
export type DeltaLayer = "L0" | "L1" | "L2";

/**
 * Record a delta skip at a specific layer.
 *
 * @param layer - The layer that determined the skip (L0, L1, or L2)
 */
export function recordDeltaSkip(layer: DeltaLayer): void {
  switch (layer) {
    case "L0":
      metrics.deltaL0Skips++;
      break;
    case "L1":
      metrics.deltaL1Skips++;
      break;
    case "L2":
      metrics.deltaL2Skips++;
      break;
  }
  metrics.costSavingsDollars += COST_PER_CRAWL_DOLLAR;
}

/**
 * Record a full L3 processing event (no skip possible).
 */
export function recordFullProcess(): void {
  metrics.fullProcessed++;
}

/**
 * Queue lane type for completion tracking.
 */
export type QueueLane = "fastApi" | "heavyCrawl";

/**
 * Record a queue job completion.
 *
 * @param lane - The queue lane (fastApi or heavyCrawl)
 */
export function recordQueueCompletion(lane: QueueLane): void {
  switch (lane) {
    case "fastApi":
      metrics.fastApiCompleted++;
      break;
    case "heavyCrawl":
      metrics.heavyCrawlCompleted++;
      break;
  }
}

/**
 * Get singleflight deduplication ratio.
 *
 * @returns Ratio of hits to total (0.0-1.0), or 0 if no events
 */
export function getSingleflightRatio(): number {
  const total = metrics.singleflightHits + metrics.singleflightMisses;
  if (total === 0) return 0;
  return metrics.singleflightHits / total;
}

/**
 * Get delta skip ratio across all layers.
 *
 * @returns Ratio of skips to total (0.0-1.0), or 0 if no events
 */
export function getDeltaSkipRatio(): number {
  const skips = metrics.deltaL0Skips + metrics.deltaL1Skips + metrics.deltaL2Skips;
  const total = skips + metrics.fullProcessed;
  if (total === 0) return 0;
  return skips / total;
}

/**
 * Get immutable snapshot of current metrics.
 *
 * @returns Copy of metrics (mutations do not affect internal state)
 */
export function getMetrics(): Readonly<CrawlMetrics> {
  return { ...metrics };
}

/**
 * Reset all metrics to zero.
 * Used for testing and metrics collection window reset.
 */
export function resetMetrics(): void {
  metrics.singleflightHits = 0;
  metrics.singleflightMisses = 0;
  metrics.deltaL0Skips = 0;
  metrics.deltaL1Skips = 0;
  metrics.deltaL2Skips = 0;
  metrics.fullProcessed = 0;
  metrics.fastApiCompleted = 0;
  metrics.heavyCrawlCompleted = 0;
  metrics.costSavingsDollars = 0;
}
