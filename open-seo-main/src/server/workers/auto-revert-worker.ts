/**
 * Auto-Revert Worker
 * Phase 33: Auto-Fix System
 *
 * BullMQ worker that periodically checks rollback triggers and
 * automatically reverts changes when conditions are met.
 *
 * Pattern: Lazy queue/worker instantiation via start/stop functions.
 * Uses sandboxed processor for isolation from main event loop.
 */
import { Worker, Queue } from 'bullmq';
import { fileURLToPath } from 'node:url';
import { getSharedBullMQConnection } from '@/server/lib/redis';
import { createLogger } from '@/server/lib/logger';
import { getDLQQueue } from '@/server/queues/dlq';

const workerLogger = createLogger({ module: 'auto-revert-worker' });

const QUEUE_NAME = 'auto-revert';
const LOCK_DURATION_MS = 10 * 60 * 1000; // 10 minutes - allows time for trigger evaluation and reverts
const STALLED_INTERVAL_MS = 60 * 1000; // Check for stalled jobs every minute
const MAX_STALLED_COUNT = 2; // Mark job as failed after 2 stalls
const SHUTDOWN_TIMEOUT_MS = 25_000; // 25 seconds graceful shutdown

// URL-based resolution for sandboxed processor
const PROCESSOR_PATH = fileURLToPath(
  new URL('./processors/auto-revert-processor.js', import.meta.url),
);

/**
 * Job data for auto-revert check.
 */
interface AutoRevertJobData {
  type: 'check_all_triggers' | 'check_client_triggers';
  clientId?: string;
}

/**
 * Result of processing auto-revert job.
 */
interface AutoRevertJobResult {
  triggersChecked: number;
  triggersFired: number;
  revertsExecuted: number;
  errors: string[];
}

// Lazy singleton instances
let queue: Queue<AutoRevertJobData, AutoRevertJobResult> | null = null;
let worker: Worker<AutoRevertJobData, AutoRevertJobResult> | null = null;

/**
 * Get or create the auto-revert queue (lazy instantiation).
 */
function getAutoRevertQueue(): Queue<AutoRevertJobData, AutoRevertJobResult> {
  if (!queue) {
    queue = new Queue<AutoRevertJobData, AutoRevertJobResult>(QUEUE_NAME, {
      connection: getSharedBullMQConnection('queue:auto-revert'),
      // Job timeout controlled via Worker lockDuration (LOCK_DURATION_MS = 10 min)
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return queue;
}

/**
 * Start the auto-revert worker.
 * Initializes the queue and worker with proper event handlers.
 */
export async function startAutoRevertWorker(): Promise<Worker<AutoRevertJobData, AutoRevertJobResult>> {
  if (worker) return worker;

  // Ensure queue is initialized
  const autoRevertQueue = getAutoRevertQueue();

  // Schedule the hourly check
  await scheduleAutoRevertCheck();

  worker = new Worker<AutoRevertJobData, AutoRevertJobResult>(
    QUEUE_NAME,
    PROCESSOR_PATH,
    {
      connection: getSharedBullMQConnection('worker:auto-revert'),
      concurrency: 1, // Only one auto-revert check at a time
      lockDuration: LOCK_DURATION_MS,
      stalledInterval: STALLED_INTERVAL_MS,
      maxStalledCount: MAX_STALLED_COUNT,
    }
  );

  worker.on('ready', () => {
    workerLogger.info('Worker ready', { queue: QUEUE_NAME });
  });

  worker.on('completed', (job, result) => {
    const jobLogger = createLogger({
      module: 'auto-revert-worker',
      jobId: job.id,
    });
    jobLogger.info('Job completed', {
      triggersChecked: result.triggersChecked,
      triggersFired: result.triggersFired,
      revertsExecuted: result.revertsExecuted,
      errorCount: result.errors.length,
      durationMs: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : undefined,
    });
  });

  worker.on('failed', async (job, err) => {
    const error = err instanceof Error ? err : new Error(String(err));
    const jobLogger = createLogger({
      module: 'auto-revert-worker',
      jobId: job?.id,
    });

    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      // Move to DLQ after all retries exhausted
      try {
        const dlq = getDLQQueue();
        await dlq.add('auto-revert-failed', {
          originalQueue: 'auto-revert',
          jobId: job.id,
          jobData: job.data,
          error: error.message,
          stack: error.stack,
          failedAt: new Date().toISOString(),
        });
        jobLogger.error('Auto-revert job moved to DLQ', error);
      } catch (dlqErr) {
        jobLogger.error('Failed to move auto-revert job to DLQ', dlqErr instanceof Error ? dlqErr : new Error(String(dlqErr)));
      }
    } else {
      jobLogger.warn('Job failed, will retry', {
        attempt: job?.attemptsMade,
        maxAttempts: job?.opts.attempts ?? 1,
        error: error.message,
      });
    }
  });

  worker.on('error', (error) => {
    workerLogger.error('Worker error', error);
  });

  return worker;
}

/**
 * Stop the auto-revert worker with graceful shutdown.
 * Waits up to 25 seconds for in-progress jobs to complete.
 */
export async function stopAutoRevertWorker(): Promise<void> {
  if (!worker) return;

  const current = worker;
  worker = null;

  const timeout = new Promise<'timeout'>((resolve) =>
    setTimeout(() => resolve('timeout'), SHUTDOWN_TIMEOUT_MS)
  );
  const closed = current.close().then(() => 'closed' as const);
  const result = await Promise.race([closed, timeout]);

  if (result === 'timeout') {
    workerLogger.error('Graceful shutdown timeout exceeded, forcing close', undefined, {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    await current.close(true);
  }

  // Close the queue as well
  if (queue) {
    await queue.close();
    queue = null;
  }

  workerLogger.info('Worker shut down');
}

/**
 * Schedule the auto-revert check to run every hour.
 */
export async function scheduleAutoRevertCheck(): Promise<void> {
  const autoRevertQueue = getAutoRevertQueue();

  // Add repeatable job FIRST (safe if duplicate briefly exists)
  // This ensures the scheduler is never lost even if we crash during init
  await autoRevertQueue.add(
    'hourly-check',
    { type: 'check_all_triggers' },
    {
      repeat: {
        pattern: '0 * * * *', // Every hour on the hour
      },
      jobId: 'auto-revert-hourly',
    }
  );

  // THEN remove old duplicates (any repeatable jobs with different keys)
  const repeatableJobs = await autoRevertQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    // Keep the one we just added, remove any stale ones
    if (job.id !== 'auto-revert-hourly') {
      await autoRevertQueue.removeRepeatableByKey(job.key);
    }
  }

  workerLogger.info('Scheduled hourly trigger checks');
}

/**
 * Manually trigger a check for a specific client.
 */
export async function triggerClientCheck(clientId: string): Promise<string> {
  const autoRevertQueue = getAutoRevertQueue();
  const job = await autoRevertQueue.add('manual-check', {
    type: 'check_client_triggers',
    clientId,
  });
  return job.id ?? '';
}
