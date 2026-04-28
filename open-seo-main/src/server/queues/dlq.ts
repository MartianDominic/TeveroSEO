/**
 * Dead Letter Queue (DLQ) for failed jobs across all workers.
 *
 * Jobs are moved here after exhausting all retries, preserving
 * original job data for investigation and manual replay.
 */
import { Queue } from 'bullmq';
import { getSharedBullMQConnection } from '../lib/redis';

export const DLQ_QUEUE_NAME = 'dead-letter-queue';

let dlqQueue: Queue | null = null;

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
        removeOnFail: false, // Keep failed jobs in DLQ for investigation
      },
    });
  }
  return dlqQueue;
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
