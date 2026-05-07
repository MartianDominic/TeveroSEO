/**
 * Queue Manager Interface.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 */

import type {
  ScrapeJobInput,
  ScrapeJobBaseInput,
  EnqueueResult,
  JobStatus,
  BatchStatus,
  QueueMetrics,
  ScrapeQueueName,
} from "../queue/queue.types";

/**
 * Queue manager interface for coordinating scraping jobs.
 */
export interface IQueueManager {
  /**
   * Add a single scraping job to the appropriate queue.
   */
  enqueue(data: ScrapeJobInput): Promise<EnqueueResult>;

  /**
   * Add multiple scraping jobs as a batch.
   */
  enqueueBatch(urls: string[], baseData: ScrapeJobBaseInput): Promise<EnqueueResult[]>;

  /**
   * Get status of a specific job.
   */
  getJobStatus(jobId: string): Promise<JobStatus | null>;

  /**
   * Get status of all jobs in a batch.
   */
  getBatchStatus(batchId: string): Promise<BatchStatus>;

  /**
   * Cancel a pending job.
   */
  cancelJob(jobId: string): Promise<boolean>;

  /**
   * Cancel all jobs in a batch.
   */
  cancelBatch(batchId: string): Promise<number>;

  /**
   * Get queue health metrics.
   */
  getQueueMetrics(): Promise<QueueMetrics>;

  /**
   * Pause/resume queues.
   */
  pauseQueue(queueName: ScrapeQueueName): Promise<void>;
  resumeQueue(queueName: ScrapeQueueName): Promise<void>;
}
