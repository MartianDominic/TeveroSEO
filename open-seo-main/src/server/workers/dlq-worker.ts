/**
 * Dead Letter Queue (DLQ) Worker
 *
 * Processes jobs that have been moved to the DLQ after exhausting retries.
 * This worker provides:
 * - Logging and alerting for failed jobs
 * - Optional retry logic for recoverable failures
 * - Cleanup of very old DLQ jobs
 *
 * Jobs are NOT automatically retried by this worker. They are processed for:
 * 1. Logging/alerting - ensuring ops knows about persistent failures
 * 2. Investigation - preserving context for debugging
 * 3. Manual intervention - allowing ops to replay or discard
 *
 * @module dlq-worker
 */
import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { DLQ_QUEUE_NAME, type DLQJobData, getDLQQueue } from "@/server/queues/dlq";

const log = createLogger({ module: "dlq-worker" });

const LOCK_DURATION_MS = 60_000; // 1 minute
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 15_000;

// Alert threshold - log critical alert when DLQ depth exceeds this
const DLQ_DEPTH_ALERT_THRESHOLD = 50;

// Track last alert time to avoid spamming
let lastDepthAlertTime = 0;
const DEPTH_ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

let worker: Worker<DLQJobData> | null = null;

/**
 * Process a DLQ job.
 *
 * DLQ jobs are logged for investigation and optionally trigger alerts.
 * The job data contains the original failure context.
 */
async function processDLQJob(job: Job<DLQJobData>): Promise<void> {
  const { originalQueue, jobId, jobData, error, stack, failedAt } = job.data;

  const jobLog = createLogger({
    module: "dlq-worker",
    jobId: job.id,
    originalQueue,
    originalJobId: jobId,
  });

  jobLog.warn("Processing DLQ job", {
    originalQueue,
    originalJobId: jobId,
    error,
    failedAt,
    jobDataSummary: typeof jobData === "object" && jobData !== null
      ? Object.keys(jobData as Record<string, unknown>).join(", ")
      : typeof jobData,
  });

  // Log stack trace at debug level to avoid noise
  if (stack) {
    jobLog.debug("Original stack trace", { stack });
  }

  // Check DLQ depth and alert if threshold exceeded
  await checkDLQDepthAlert(jobLog);

  // Future enhancements:
  // - Send Slack notification for critical failures
  // - Send email digest of DLQ jobs
  // - Auto-retry for known recoverable error patterns
  // - Create incident tickets for repeated failures

  jobLog.info("DLQ job processed", { originalQueue, originalJobId: jobId });
}

/**
 * Check DLQ depth and log critical alert if threshold exceeded.
 */
async function checkDLQDepthAlert(
  jobLog: ReturnType<typeof createLogger>
): Promise<void> {
  const now = Date.now();
  if (now - lastDepthAlertTime < DEPTH_ALERT_COOLDOWN_MS) {
    return; // Still in cooldown period
  }

  try {
    const dlqQueue = getDLQQueue();
    const counts = await dlqQueue.getJobCounts("waiting", "active", "delayed");
    const totalDepth = counts.waiting + counts.active + counts.delayed;

    if (totalDepth >= DLQ_DEPTH_ALERT_THRESHOLD) {
      lastDepthAlertTime = now;
      log.error("DLQ depth threshold exceeded", undefined, {
        totalDepth,
        threshold: DLQ_DEPTH_ALERT_THRESHOLD,
        waiting: counts.waiting,
        active: counts.active,
        delayed: counts.delayed,
      });
    }
  } catch (err) {
    jobLog.debug("Failed to check DLQ depth", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Start the DLQ worker.
 */
export function startDLQWorker(): Worker<DLQJobData> {
  if (worker) return worker;

  worker = new Worker<DLQJobData>(DLQ_QUEUE_NAME, processDLQJob, {
    connection: getSharedBullMQConnection("worker:dlq"),
    lockDuration: LOCK_DURATION_MS,
    maxStalledCount: MAX_STALLED_COUNT,
    concurrency: 5, // DLQ processing is lightweight
  });

  worker.on("ready", () => {
    log.info("DLQ worker ready", { queue: DLQ_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    log.error("DLQ worker error", err instanceof Error ? err : new Error(String(err)));
  });

  worker.on("stalled", (jobId) => {
    log.warn("DLQ job stalled", { jobId });
  });

  worker.on("completed", (job) => {
    log.debug("DLQ job completed", {
      jobId: job.id,
      originalQueue: job.data.originalQueue,
    });
  });

  worker.on("failed", (job, err) => {
    // DLQ jobs should rarely fail since they're just logging
    // If they do fail, log but don't re-enqueue (would cause infinite loop)
    log.error("DLQ job processing failed", err instanceof Error ? err : new Error(String(err)), {
      jobId: job?.id,
      originalQueue: job?.data.originalQueue,
    });
  });

  log.info("DLQ worker started");

  return worker;
}

/**
 * Stop the DLQ worker gracefully.
 */
export async function stopDLQWorker(): Promise<void> {
  if (!worker) return;

  const current = worker;
  worker = null;

  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS)
  );
  const closed = current.close().then(() => "closed" as const);
  const result = await Promise.race([closed, timeout]);

  if (result === "timeout") {
    log.error("DLQ worker shutdown timeout, forcing close", undefined, {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    await current.close(true);
  }

  log.info("DLQ worker stopped");
}
