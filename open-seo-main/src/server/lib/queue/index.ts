/**
 * Queue utilities for multi-tenant fair scheduling.
 *
 * Exports:
 * - DRRQueueManager: Deficit Round Robin queue manager for fair client scheduling
 * - DRRConfig: Configuration interface for DRR manager
 * - DRRBucket: Bucket state interface
 * - DRRStats: Statistics interface
 * - DRRJobResult: Job result interface
 *
 * @module queue
 */

export {
  DRRQueueManager,
  type DRRConfig,
  type DRRBucket,
  type DRRStats,
  type DRRJobResult,
  type BucketStats,
} from "./drr-queue";
