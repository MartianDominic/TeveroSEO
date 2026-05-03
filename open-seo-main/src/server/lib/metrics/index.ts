/**
 * Metrics Module
 *
 * Centralized metrics collection for cost savings visualization.
 *
 * @module metrics
 */

export {
  recordSingleflight,
  recordDeltaSkip,
  recordFullProcess,
  recordQueueCompletion,
  getMetrics,
  getSingleflightRatio,
  getDeltaSkipRatio,
  resetMetrics,
  COST_PER_CRAWL_DOLLAR,
  type CrawlMetrics,
  type DeltaLayer,
  type QueueLane,
} from "./crawl-metrics";
