/**
 * Queue Manager for Scraping Jobs.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 *
 * Manages three BullMQ queues for different priority levels:
 * - scrape:priority - User-initiated, <5 min SLA
 * - scrape:standard - Paid features, <15 min SLA
 * - scrape:background - Cache warming, <1 hr SLA
 */

import { createHash } from "crypto";
import { Queue, type Job, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import type {
  ScrapeJobData,
  ScrapeJobResult,
  ScrapeJobInput,
  ScrapeJobBaseInput,
  EnqueueResult,
  JobStatus,
  BatchStatus,
  QueueMetrics,
  ScrapeQueueName,
  JobPriority,
  DlqJobData,
  DlqEnqueueResult,
  DlqJobStatus,
} from "./queue.types";
import { SCRAPE_QUEUE_NAMES, QUEUE_CONFIG, DLQ_QUEUE_NAME } from "./queue.types";
import { queueLogger } from "../logging";
import { assignPriority, selectQueue, toBullMQPriority } from "./PriorityAssigner";
import { DEFAULT_RETRY_CONFIG } from "./retry.config";
import type { IQueueManager } from "../interfaces/IQueueManager";

/**
 * Extract domain from URL.
 */
function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    // Fallback: try to extract manually
    const match = url.match(/^(?:https?:\/\/)?([^/:]+)/i);
    return match?.[1]?.toLowerCase() ?? url;
  }
}

/**
 * Generate deterministic job ID for URL deduplication.
 * BullMQ automatically rejects duplicate jobIds, preventing the same URL
 * from being queued multiple times within the dedup window.
 *
 * @param url - The URL to scrape
 * @param clientId - Optional client ID for multi-tenant isolation
 * @param dedupWindowMinutes - Time window for deduplication (default: 5 minutes).
 *                             Set to 0 for permanent deduplication (same URL never re-queued).
 */
function generateJobId(
  url: string,
  clientId?: string,
  dedupWindowMinutes: number = 5
): string {
  // Normalize URL for consistent hashing
  const normalizedUrl = url.toLowerCase().trim();

  // Build hash input with optional time window
  let input = clientId ? `${normalizedUrl}:${clientId}` : normalizedUrl;

  // Add time window for time-based deduplication
  // This allows the same URL to be re-scraped after the window expires
  if (dedupWindowMinutes > 0) {
    const window = Math.floor(Date.now() / (dedupWindowMinutes * 60 * 1000));
    input = `${input}:${window}`;
  }

  const hash = createHash("sha256").update(input).digest("hex").slice(0, 16);
  return `scrape-${hash}`;
}

/**
 * Generate unique batch ID.
 */
function generateBatchId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * DLQ retention period in milliseconds (30 days).
 */
const DLQ_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Queue Manager for coordinating scraping job queues.
 */
export class QueueManager implements IQueueManager {
  private readonly priorityQueue: Queue<ScrapeJobData, ScrapeJobResult>;
  private readonly standardQueue: Queue<ScrapeJobData, ScrapeJobResult>;
  private readonly backgroundQueue: Queue<ScrapeJobData, ScrapeJobResult>;
  private readonly dlqQueue: Queue<DlqJobData, void>;

  constructor() {
    // Create queues with dedicated connections
    this.priorityQueue = new Queue<ScrapeJobData, ScrapeJobResult>(
      SCRAPE_QUEUE_NAMES.PRIORITY,
      {
        connection: getSharedBullMQConnection("queue:scrape-priority"),
        defaultJobOptions: this.getDefaultOptions("critical"),
      }
    );

    this.standardQueue = new Queue<ScrapeJobData, ScrapeJobResult>(
      SCRAPE_QUEUE_NAMES.STANDARD,
      {
        connection: getSharedBullMQConnection("queue:scrape-standard"),
        defaultJobOptions: this.getDefaultOptions("normal"),
      }
    );

    this.backgroundQueue = new Queue<ScrapeJobData, ScrapeJobResult>(
      SCRAPE_QUEUE_NAMES.BACKGROUND,
      {
        connection: getSharedBullMQConnection("queue:scrape-background"),
        defaultJobOptions: this.getDefaultOptions("low"),
      }
    );

    // Dead Letter Queue - separate queue for failed jobs
    this.dlqQueue = new Queue<DlqJobData, void>(DLQ_QUEUE_NAME, {
      connection: getSharedBullMQConnection("queue:scraping-dlq"),
      defaultJobOptions: {
        // DLQ jobs are not processed automatically - they sit until replayed
        // Auto-delete after 30 days
        removeOnComplete: {
          age: DLQ_RETENTION_MS / 1000, // BullMQ uses seconds
        },
        removeOnFail: false, // Keep failed DLQ jobs for inspection
      },
    });
  }

  /**
   * Add a single scraping job to the appropriate queue.
   */
  async enqueue(input: ScrapeJobInput): Promise<EnqueueResult> {
    const priority = input.priority ?? assignPriority(input);
    // Use deterministic jobId for URL deduplication
    // BullMQ will reject duplicate jobIds, preventing redundant scrapes
    const dedupWindow = (input.metadata as Record<string, unknown> | undefined)?.dedupWindowMinutes as number | undefined;
    const jobId = generateJobId(input.url, input.clientId, dedupWindow);

    const jobData: ScrapeJobData = {
      jobId,
      url: input.url,
      domain: extractDomain(input.url),
      options: input.options ?? {},
      clientId: input.clientId,
      userId: input.userId,
      source: input.source,
      enqueuedAt: Date.now(),
      priority,
      retryCount: 0,
      metadata: input.metadata,
    };

    const queue = this.getQueue(selectQueue(priority, input.source));
    const jobOptions = this.getJobOptions(jobData);

    // BullMQ add returns Job<ScrapeJobData, ScrapeJobResult, string>
    const job = await queue.add(
      `scrape:${jobData.domain}`,
      jobData,
      jobOptions
    );

    // Get queue position
    const position = await this.getQueuePosition(queue, job.id!);

    return {
      jobId,
      queue: queue.name as ScrapeQueueName,
      priority,
      position,
    };
  }

  /**
   * Add multiple scraping jobs as a batch.
   */
  async enqueueBatch(
    urls: string[],
    baseInput: ScrapeJobBaseInput
  ): Promise<EnqueueResult[]> {
    const batchId = generateBatchId();
    const results: EnqueueResult[] = [];

    // Enqueue all jobs in parallel
    const promises = urls.map((url) =>
      this.enqueue({
        ...baseInput,
        url,
        metadata: {
          ...baseInput.metadata,
        },
      }).then((result) => ({
        ...result,
        batchId,
      }))
    );

    const enqueueResults = await Promise.all(promises);

    return enqueueResults;
  }

  /**
   * Get status of a specific job.
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    // Search across all queues
    for (const queue of [this.priorityQueue, this.standardQueue, this.backgroundQueue]) {
      const job = await this.findJobByJobId(queue, jobId);
      if (job) {
        const state = await job.getState();
        return {
          jobId,
          state: state as JobStatus["state"],
          progress: job.progress as number | undefined,
          result: job.returnvalue ?? undefined,
          error: job.failedReason ?? undefined,
          attempts: job.attemptsMade,
          maxAttempts: job.opts?.attempts ?? DEFAULT_RETRY_CONFIG.attempts,
          createdAt: job.timestamp,
          processedAt: job.processedOn ?? undefined,
          finishedAt: job.finishedOn ?? undefined,
        };
      }
    }
    return null;
  }

  /**
   * Get status of all jobs in a batch.
   */
  async getBatchStatus(batchId: string): Promise<BatchStatus> {
    let completed = 0;
    let failed = 0;
    let pending = 0;
    let active = 0;
    const jobs: Job<ScrapeJobData, ScrapeJobResult>[] = [];

    // Find all jobs with this batchId across queues
    for (const queue of [this.priorityQueue, this.standardQueue, this.backgroundQueue]) {
      const allJobs = await queue.getJobs(["waiting", "active", "completed", "failed"]);
      for (const job of allJobs) {
        if (job.data.batchId === batchId) {
          jobs.push(job);
          const state = await job.getState();
          switch (state) {
            case "completed":
              completed++;
              break;
            case "failed":
              failed++;
              break;
            case "active":
              active++;
              break;
            default:
              pending++;
          }
        }
      }
    }

    const totalJobs = jobs.length;
    const progress = totalJobs > 0 ? (completed + failed) / totalJobs : 0;

    return {
      batchId,
      totalJobs,
      completed,
      failed,
      pending,
      active,
      progress,
    };
  }

  /**
   * Cancel a pending job.
   */
  async cancelJob(jobId: string): Promise<boolean> {
    for (const queue of [this.priorityQueue, this.standardQueue, this.backgroundQueue]) {
      const job = await this.findJobByJobId(queue, jobId);
      if (job) {
        const state = await job.getState();
        if (state === "waiting" || state === "delayed") {
          await job.remove();
          return true;
        }
        // Can't cancel active/completed/failed jobs
        return false;
      }
    }
    return false;
  }

  /**
   * Cancel all jobs in a batch.
   */
  async cancelBatch(batchId: string): Promise<number> {
    let cancelledCount = 0;

    for (const queue of [this.priorityQueue, this.standardQueue, this.backgroundQueue]) {
      const jobs = await queue.getJobs(["waiting", "delayed"]);
      for (const job of jobs) {
        if (job.data.batchId === batchId) {
          await job.remove();
          cancelledCount++;
        }
      }
    }

    return cancelledCount;
  }

  /**
   * Get queue health metrics.
   */
  async getQueueMetrics(): Promise<QueueMetrics> {
    const [priorityStats, standardStats, backgroundStats] = await Promise.all([
      this.getQueueStats(this.priorityQueue),
      this.getQueueStats(this.standardQueue),
      this.getQueueStats(this.backgroundQueue),
    ]);

    const totalActive =
      priorityStats.active + standardStats.active + backgroundStats.active;

    return {
      queues: {
        [SCRAPE_QUEUE_NAMES.PRIORITY]: priorityStats,
        [SCRAPE_QUEUE_NAMES.STANDARD]: standardStats,
        [SCRAPE_QUEUE_NAMES.BACKGROUND]: backgroundStats,
      },
      global: {
        currentConcurrency: totalActive,
        maxConcurrency: 200, // Global concurrency limit
        processingRate: 0, // Would need ProcessingRateTracker
        avgProcessingTime: 0, // Would need metrics collection
        blockedDomains: 0, // Would need BlockedDomainTracker
      },
    };
  }

  /**
   * Pause a queue.
   */
  async pauseQueue(queueName: ScrapeQueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
  }

  /**
   * Resume a queue.
   */
  async resumeQueue(queueName: ScrapeQueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
  }

  /**
   * Get queue by name.
   */
  getQueue(name: ScrapeQueueName): Queue<ScrapeJobData, ScrapeJobResult> {
    switch (name) {
      case SCRAPE_QUEUE_NAMES.PRIORITY:
        return this.priorityQueue;
      case SCRAPE_QUEUE_NAMES.STANDARD:
        return this.standardQueue;
      case SCRAPE_QUEUE_NAMES.BACKGROUND:
        return this.backgroundQueue;
    }
  }

  /**
   * Close all queues.
   */
  async close(): Promise<void> {
    await Promise.all([
      this.priorityQueue.close(),
      this.standardQueue.close(),
      this.backgroundQueue.close(),
      this.dlqQueue.close(),
    ]);
  }

  // =========================================================================
  // Dead Letter Queue Methods
  // =========================================================================

  /**
   * Move a failed job to the Dead Letter Queue.
   * Called when a job has exhausted all retry attempts.
   *
   * @param job - The failed BullMQ job
   * @param error - The final error that caused the failure
   * @param failureHistory - History of all failure attempts
   */
  async moveToDlq(
    job: Job<ScrapeJobData, ScrapeJobResult>,
    error: Error,
    failureHistory: Array<{ error: string; timestamp: number; attemptNumber: number }> = []
  ): Promise<DlqEnqueueResult> {
    const sourceQueue = job.queueName as Exclude<ScrapeQueueName, "scraping-dlq">;

    const dlqData: DlqJobData = {
      originalJobId: job.data.jobId,
      sourceQueue,
      jobData: job.data,
      error: error.message,
      stackTrace: error.stack,
      attemptsMade: job.attemptsMade,
      failedAt: Date.now(),
      failureHistory,
    };

    const dlqJobId = `dlq-${job.data.jobId}-${Date.now()}`;

    await this.dlqQueue.add("dead-letter", dlqData, {
      jobId: dlqJobId,
    });

    // Log the DLQ addition for alerting
    queueLogger.warn(
      {
        originalJobId: job.data.jobId,
        dlqJobId,
        sourceQueue,
        url: job.data.url,
        attemptsMade: job.attemptsMade,
        error: error.message,
      },
      "Job moved to Dead Letter Queue after exhausting retries"
    );

    return {
      dlqJobId,
      originalJobId: job.data.jobId,
      sourceQueue,
    };
  }

  /**
   * Get all jobs in the Dead Letter Queue.
   *
   * @param limit - Maximum number of jobs to return (default: 100)
   * @param offset - Number of jobs to skip (default: 0)
   */
  async getDlqJobs(limit = 100, offset = 0): Promise<DlqJobStatus[]> {
    // DLQ jobs are stored as "waiting" since they're not processed automatically
    const jobs = await this.dlqQueue.getJobs(["waiting", "delayed"], offset, offset + limit - 1);

    return jobs.map((job) => ({
      dlqJobId: job.id!,
      originalJobId: job.data.originalJobId,
      sourceQueue: job.data.sourceQueue,
      jobData: job.data.jobData,
      error: job.data.error,
      attemptsMade: job.data.attemptsMade,
      failedAt: job.data.failedAt,
    }));
  }

  /**
   * Get a specific DLQ job by ID.
   */
  async getDlqJob(dlqJobId: string): Promise<DlqJobStatus | null> {
    const job = await this.dlqQueue.getJob(dlqJobId);
    if (!job) {
      return null;
    }

    return {
      dlqJobId: job.id!,
      originalJobId: job.data.originalJobId,
      sourceQueue: job.data.sourceQueue,
      jobData: job.data.jobData,
      error: job.data.error,
      attemptsMade: job.data.attemptsMade,
      failedAt: job.data.failedAt,
    };
  }

  /**
   * Get count of jobs in the DLQ.
   */
  async getDlqCount(): Promise<number> {
    return this.dlqQueue.getWaitingCount();
  }

  /**
   * Replay a job from the Dead Letter Queue.
   * Re-enqueues the original job data to the original queue with fresh retry count.
   *
   * @param dlqJobId - ID of the DLQ job to replay
   * @returns The new job's enqueue result, or null if DLQ job not found
   */
  async replayDlqJob(dlqJobId: string): Promise<EnqueueResult | null> {
    const dlqJob = await this.dlqQueue.getJob(dlqJobId);
    if (!dlqJob) {
      queueLogger.warn({ dlqJobId }, "DLQ job not found for replay");
      return null;
    }

    const { jobData, sourceQueue, originalJobId } = dlqJob.data;

    // Re-enqueue to original queue with fresh state
    const result = await this.enqueue({
      url: jobData.url,
      clientId: jobData.clientId,
      userId: jobData.userId,
      source: jobData.source,
      priority: jobData.priority,
      options: jobData.options,
      metadata: {
        ...jobData.metadata,
        replayedFromDlq: true,
        originalDlqJobId: dlqJobId,
        previousFailedAt: dlqJob.data.failedAt,
      },
    });

    // Remove the DLQ job after successful replay
    await dlqJob.remove();

    queueLogger.info(
      {
        dlqJobId,
        originalJobId,
        newJobId: result.jobId,
        sourceQueue,
        targetQueue: result.queue,
      },
      "DLQ job replayed successfully"
    );

    return result;
  }

  /**
   * Replay multiple DLQ jobs.
   *
   * @param dlqJobIds - Array of DLQ job IDs to replay
   * @returns Array of replay results (null for jobs that weren't found)
   */
  async replayDlqJobs(dlqJobIds: string[]): Promise<Array<EnqueueResult | null>> {
    const results = await Promise.all(
      dlqJobIds.map((id) => this.replayDlqJob(id))
    );
    return results;
  }

  /**
   * Delete a job from the DLQ without replaying.
   *
   * @param dlqJobId - ID of the DLQ job to delete
   * @returns True if deleted, false if not found
   */
  async deleteDlqJob(dlqJobId: string): Promise<boolean> {
    const dlqJob = await this.dlqQueue.getJob(dlqJobId);
    if (!dlqJob) {
      return false;
    }

    await dlqJob.remove();

    queueLogger.info(
      { dlqJobId, originalJobId: dlqJob.data.originalJobId },
      "DLQ job deleted"
    );

    return true;
  }

  /**
   * Clear all jobs from the DLQ.
   * Use with caution - this permanently removes all failed jobs.
   */
  async clearDlq(): Promise<number> {
    const jobs = await this.dlqQueue.getJobs(["waiting", "delayed"]);
    const count = jobs.length;

    await Promise.all(jobs.map((job) => job.remove()));

    queueLogger.warn({ count }, "DLQ cleared");

    return count;
  }

  /**
   * Get the DLQ queue instance (for worker setup).
   */
  getDlqQueue(): Queue<DlqJobData, void> {
    return this.dlqQueue;
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  private getDefaultOptions(priority: JobPriority): JobsOptions {
    const removeAge = priority === "low" ? 3600 : 86400; // 1h for background, 24h for others
    const removeCount = priority === "low" ? 100 : 1000;

    return {
      attempts: DEFAULT_RETRY_CONFIG.attempts,
      backoff: {
        type: DEFAULT_RETRY_CONFIG.backoff.type,
        delay: DEFAULT_RETRY_CONFIG.backoff.delay,
      },
      removeOnComplete: {
        age: removeAge,
        count: removeCount,
      },
      removeOnFail: {
        age: 604800, // 7 days
        count: 5000,
      },
    };
  }

  private getJobOptions(data: ScrapeJobData): JobsOptions {
    return {
      priority: toBullMQPriority(data.priority),
      jobId: data.jobId, // Enables deduplication
      delay: 0,
    };
  }

  private async getQueuePosition(
    queue: Queue<ScrapeJobData, ScrapeJobResult>,
    jobId: string
  ): Promise<number> {
    try {
      const waitingJobs = await queue.getWaiting();
      const index = waitingJobs.findIndex((j) => j.id === jobId);
      return index >= 0 ? index : waitingJobs.length;
    } catch {
      return 0;
    }
  }

  private async findJobByJobId(
    queue: Queue<ScrapeJobData, ScrapeJobResult>,
    jobId: string
  ): Promise<Job<ScrapeJobData, ScrapeJobResult> | null> {
    // First try direct lookup (jobId is used as BullMQ job ID)
    const job = await queue.getJob(jobId);
    if (job) {
      return job;
    }

    // Fallback: search through jobs by data.jobId
    const jobs = await queue.getJobs(["waiting", "active", "completed", "failed", "delayed"]);
    for (const j of jobs) {
      if (j.data.jobId === jobId) {
        return j;
      }
    }

    return null;
  }

  private async getQueueStats(
    queue: Queue<ScrapeJobData, ScrapeJobResult>
  ): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    paused: boolean;
  }> {
    const [waiting, active, completed, failed, delayed, isPaused] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      paused: isPaused,
    };
  }
}

/**
 * Singleton instance for the queue manager.
 */
let queueManagerInstance: QueueManager | null = null;

/**
 * Get the singleton QueueManager instance.
 */
export function getQueueManager(): QueueManager {
  if (!queueManagerInstance) {
    queueManagerInstance = new QueueManager();
  }
  return queueManagerInstance;
}
