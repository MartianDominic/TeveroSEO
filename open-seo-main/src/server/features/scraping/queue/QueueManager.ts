/**
 * Queue Manager for Scraping Jobs.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 *
 * Manages three BullMQ queues for different priority levels:
 * - scrape:priority - User-initiated, <5 min SLA
 * - scrape:standard - Paid features, <15 min SLA
 * - scrape:background - Cache warming, <1 hr SLA
 */

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
} from "./queue.types";
import { SCRAPE_QUEUE_NAMES, QUEUE_CONFIG } from "./queue.types";
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
 * Generate unique job ID.
 */
function generateJobId(): string {
  return `scrape-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Generate unique batch ID.
 */
function generateBatchId(): string {
  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Queue Manager for coordinating scraping job queues.
 */
export class QueueManager implements IQueueManager {
  private readonly priorityQueue: Queue<ScrapeJobData, ScrapeJobResult>;
  private readonly standardQueue: Queue<ScrapeJobData, ScrapeJobResult>;
  private readonly backgroundQueue: Queue<ScrapeJobData, ScrapeJobResult>;

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
  }

  /**
   * Add a single scraping job to the appropriate queue.
   */
  async enqueue(input: ScrapeJobInput): Promise<EnqueueResult> {
    const priority = input.priority ?? assignPriority(input);
    const jobId = generateJobId();

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
    ]);
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
