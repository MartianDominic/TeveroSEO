/**
 * Backfill Worker
 * Phase 86-09: Backfill Pool + Learning
 *
 * BullMQ worker for background processing of backfill pool replenishment.
 * Runs at low priority to avoid impacting user-facing operations.
 */

import { Worker, Queue, Job } from 'bullmq';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { BackfillPoolService } from './BackfillPoolService';
import type { BackfillJobPayload, BackfillResult, BackfillConfig } from './types';
import { DEFAULT_BACKFILL_CONFIG } from './types';

export const BACKFILL_QUEUE_NAME = 'proposal-backfill';

/**
 * BullMQ worker for backfill pool replenishment.
 */
export class BackfillWorker {
  private worker: Worker | null = null;
  private queue: Queue;

  constructor(
    private db: PostgresJsDatabase,
    private redisConnection: { host: string; port: number },
    private config: BackfillConfig = DEFAULT_BACKFILL_CONFIG
  ) {
    this.queue = new Queue(BACKFILL_QUEUE_NAME, {
      connection: this.redisConnection,
    });
  }

  /**
   * Start the worker.
   */
  start(): void {
    if (this.worker) return;

    this.worker = new Worker(
      BACKFILL_QUEUE_NAME,
      async (job: Job<BackfillJobPayload>) => {
        return this.processJob(job);
      },
      {
        connection: this.redisConnection,
        concurrency: 2, // Low concurrency for background task
        limiter: {
          max: 10,
          duration: 60000, // Max 10 jobs per minute
        },
      }
    );

    this.worker.on('completed', (job, result) => {
      console.log(`Backfill job ${job.id} completed:`, result);
    });

    this.worker.on('failed', (job, error) => {
      console.error(`Backfill job ${job?.id} failed:`, error);
    });
  }

  /**
   * Stop the worker.
   */
  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    await this.queue.close();
  }

  /**
   * Add a backfill job to the queue.
   */
  async enqueueBackfill(payload: BackfillJobPayload): Promise<string> {
    const job = await this.queue.add('generate-backfill', payload, {
      priority: this.config.jobPriority,
      delay: this.config.jobDelay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: {
        age: 86400, // Keep completed jobs for 24h
        count: 100,
      },
      removeOnFail: {
        age: 604800, // Keep failed jobs for 7 days
      },
    });

    return job.id ?? '';
  }

  /**
   * Schedule backfill for off-peak hours (2-6 AM).
   */
  async scheduleOffPeakBackfill(payload: BackfillJobPayload): Promise<string> {
    const now = new Date();
    const hours = now.getHours();

    let delayMs = 0;
    // If outside 2-6 AM window, calculate delay
    if (hours >= 6 || hours < 2) {
      // Calculate hours until 2 AM
      const hoursUntil2AM = hours >= 6 ? 26 - hours : 2 - hours;
      delayMs = hoursUntil2AM * 60 * 60 * 1000;
    }

    const job = await this.queue.add('generate-backfill', payload, {
      priority: this.config.jobPriority,
      delay: delayMs,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    return job.id ?? '';
  }

  /**
   * Process a backfill job.
   */
  private async processJob(job: Job<BackfillJobPayload>): Promise<BackfillResult> {
    const startTime = Date.now();
    const { proposalId, targetCount } = job.data;

    const service = new BackfillPoolService(this.db, this.config);

    // Check current pool size
    const currentSize = await service.getPoolSize(proposalId);

    if (currentSize >= this.config.maxPoolSize) {
      return {
        proposalId,
        keywordsAdded: 0,
        totalPoolSize: currentSize,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Calculate how many keywords needed
    const needed = Math.min(
      targetCount || this.config.maxPoolSize,
      this.config.maxPoolSize - currentSize
    );

    await job.updateProgress(50);

    // TODO: Implement fetching from analysis_sessions table
    // This would query the analysis results and add unselected keywords
    // For now, log the intent
    console.log(`Backfill job: need to add ${needed} keywords to proposal ${proposalId}`);

    const finalSize = await service.getPoolSize(proposalId);

    return {
      proposalId,
      keywordsAdded: finalSize - currentSize,
      totalPoolSize: finalSize,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Get queue statistics.
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
    ]);

    return { waiting, active, completed, failed };
  }
}
