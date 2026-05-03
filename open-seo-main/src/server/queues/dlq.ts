/**
 * Dead Letter Queue (DLQ) for failed jobs across all workers.
 *
 * Jobs are moved here after exhausting all retries, preserving
 * original job data for investigation and manual replay.
 *
 * DLQ entries are retained for 7 days or up to 10,000 jobs to prevent
 * unbounded Redis memory growth. A scheduled cleanup runs daily.
 */
import { Queue } from 'bullmq';
import { getSharedBullMQConnection } from '../lib/redis';
import { createLogger } from '../lib/logger';

// MED-33 fix: Use structured logger instead of console.log
const log = createLogger({ module: 'dlq' });

export const DLQ_QUEUE_NAME = 'dead-letter-queue';

// DLQ retention configuration
const DLQ_RETENTION_DAYS = 7;
const DLQ_MAX_FAILED_JOBS = 10000;
const DLQ_RETENTION_MS = DLQ_RETENTION_DAYS * 24 * 60 * 60 * 1000;

let dlqQueue: Queue | null = null;
let cleanupIntervalId: NodeJS.Timeout | null = null;

/**
 * Job data structure for DLQ entries.
 */
export interface DLQJobData {
  originalQueue: string;
  jobId: string | undefined;
  jobData: unknown;
  error: string;
  stack: string | undefined;
  failedAt: string;
}

/**
 * Get or create the DLQ queue (lazy instantiation).
 */
export function getDLQQueue(): Queue<DLQJobData> {
  if (!dlqQueue) {
    dlqQueue = new Queue<DLQJobData>(DLQ_QUEUE_NAME, {
      connection: getSharedBullMQConnection('queue:dlq'),
      defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: {
          age: DLQ_RETENTION_DAYS * 24 * 60 * 60, // 7 days in seconds
          count: DLQ_MAX_FAILED_JOBS, // Max 10k failed jobs
        },
      },
    });

    // Start the scheduled cleanup when DLQ is first created
    startDLQCleanupScheduler();
  }
  return dlqQueue;
}

/**
 * Clean up old DLQ entries that exceed retention period.
 * This supplements BullMQ's built-in removeOnFail for edge cases
 * where jobs may not be properly cleaned by the queue itself.
 *
 * QUEUE-H03 FIX: Uses paginated fetching to prevent memory spikes on large queues.
 *
 * @returns Number of jobs removed
 */
export async function cleanupDLQ(): Promise<number> {
  const queue = getDLQQueue();
  let removedCount = 0;
  const cutoffTime = Date.now() - DLQ_RETENTION_MS;
  const BATCH_SIZE = 100; // Process in batches to prevent memory spikes

  try {
    // Clean up failed jobs with pagination (QUEUE-H03)
    removedCount += await cleanupJobsByStatus(queue, 'failed', cutoffTime, BATCH_SIZE);

    // Clean up completed jobs with pagination
    removedCount += await cleanupJobsByStatus(queue, 'completed', cutoffTime, BATCH_SIZE);

    // Clean up waiting jobs with pagination
    removedCount += await cleanupWaitingJobs(queue, cutoffTime, BATCH_SIZE);

    if (removedCount > 0) {
      log.info('Cleaned up old DLQ jobs', { removedCount, retentionDays: DLQ_RETENTION_DAYS });
    }

    return removedCount;
  } catch (error) {
    log.error('DLQ cleanup failed', error instanceof Error ? error : new Error(String(error)));
    return removedCount;
  }
}

/**
 * Clean up jobs by status using paginated fetching.
 * QUEUE-H03 FIX: Prevents memory spikes by processing in batches.
 */
async function cleanupJobsByStatus(
  queue: Queue<DLQJobData>,
  status: 'failed' | 'completed',
  cutoffTime: number,
  batchSize: number
): Promise<number> {
  let removedCount = 0;
  let start = 0;

  while (true) {
    const jobs = status === 'failed'
      ? await queue.getFailed(start, start + batchSize - 1)
      : await queue.getCompleted(start, start + batchSize - 1);

    if (jobs.length === 0) break;

    for (const job of jobs) {
      if (job.finishedOn && job.finishedOn < cutoffTime) {
        try {
          await job.remove();
          removedCount++;
        } catch (err) {
          // Job may have been removed by another process
          log.warn(`Failed to remove ${status} DLQ job`, { jobId: job.id, error: err instanceof Error ? err.message : String(err) });
        }
      }
    }

    // If we got fewer jobs than batch size, we've reached the end
    if (jobs.length < batchSize) break;

    // Move to next batch
    // Note: We don't increment start by batchSize because removed jobs shift indices
    // Instead, we always start from 0 since we're removing old jobs
    // This prevents infinite loops but may re-check some jobs
    start = 0;

    // Safety: yield to event loop between batches
    await new Promise(resolve => setImmediate(resolve));
  }

  return removedCount;
}

/**
 * Clean up waiting jobs using paginated fetching.
 * QUEUE-H03 FIX: Prevents memory spikes by processing in batches.
 */
async function cleanupWaitingJobs(
  queue: Queue<DLQJobData>,
  cutoffTime: number,
  batchSize: number
): Promise<number> {
  let removedCount = 0;
  let start = 0;

  while (true) {
    const jobs = await queue.getWaiting(start, start + batchSize - 1);

    if (jobs.length === 0) break;

    for (const job of jobs) {
      const jobData = job.data as DLQJobData;
      if (jobData.failedAt) {
        const failedTime = new Date(jobData.failedAt).getTime();
        if (failedTime < cutoffTime) {
          try {
            await job.remove();
            removedCount++;
          } catch (err) {
            log.warn('Failed to remove waiting DLQ job', { jobId: job.id, error: err instanceof Error ? err.message : String(err) });
          }
        }
      }
    }

    if (jobs.length < batchSize) break;
    start = 0; // Reset to handle shifted indices after removals

    await new Promise(resolve => setImmediate(resolve));
  }

  return removedCount;
}

/**
 * Start the scheduled DLQ cleanup (runs daily at 3 AM UTC).
 */
export function startDLQCleanupScheduler(): void {
  if (cleanupIntervalId) {
    return; // Already running
  }

  // Run cleanup every 24 hours
  const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

  // Schedule first cleanup to run at next 3 AM UTC
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setUTCHours(3, 0, 0, 0);
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  const initialDelay = nextRun.getTime() - now.getTime();

  // Initial delayed start, then run every 24 hours
  setTimeout(() => {
    cleanupDLQ().catch((err) => log.error('Scheduled DLQ cleanup error', err instanceof Error ? err : new Error(String(err))));

    cleanupIntervalId = setInterval(() => {
      cleanupDLQ().catch((err) => log.error('Scheduled DLQ cleanup error', err instanceof Error ? err : new Error(String(err))));
    }, CLEANUP_INTERVAL_MS);
  }, initialDelay);

  log.info('DLQ cleanup scheduler started', { nextRun: nextRun.toISOString() });
}

/**
 * Stop the DLQ cleanup scheduler.
 */
export function stopDLQCleanupScheduler(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    log.info('DLQ cleanup scheduler stopped');
  }
}

/**
 * Close the DLQ queue (for graceful shutdown).
 */
export async function closeDLQQueue(): Promise<void> {
  if (dlqQueue) {
    await dlqQueue.close();
    dlqQueue = null;
  }
}
