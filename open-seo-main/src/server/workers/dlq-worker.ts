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
import { getSharedBullMQConnection, WORKER_CONCURRENCY_LIMITS } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { DLQ_QUEUE_NAME, type DLQJobData, getDLQQueue } from "@/server/queues/dlq";

// QUEUE-H01: Optional Sentry integration for external alerting
// Type uses a minimal interface to avoid requiring @sentry/node as a dependency
interface SentryLike {
  captureMessage(
    message: string,
    options?: {
      level?: "warning" | "error" | "info" | "debug";
      tags?: Record<string, string>;
      extra?: Record<string, unknown>;
    }
  ): string | undefined;
}

let Sentry: SentryLike | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Sentry = require("@sentry/node") as SentryLike;
} catch {
  // Sentry not available - alerts will use webhook/logging only
}

// QUEUE-H01: Webhook URL for external alerts (Slack, PagerDuty, etc.)
const DLQ_ALERT_WEBHOOK_URL = process.env.DLQ_ALERT_WEBHOOK_URL;

const log = createLogger({ module: "dlq-worker" });

const LOCK_DURATION_MS = 60_000; // 1 minute
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 15_000;

// JOB-HIGH-03: Configurable alert thresholds via environment
const DLQ_DEPTH_ALERT_THRESHOLD = parseInt(
  process.env.DLQ_DEPTH_ALERT_THRESHOLD ?? "50",
  10
);
const DLQ_DEPTH_CRITICAL_THRESHOLD = parseInt(
  process.env.DLQ_DEPTH_CRITICAL_THRESHOLD ?? "200",
  10
);

// Track last alert time to avoid spamming
let lastDepthAlertTime = 0;
let lastCriticalAlertTime = 0;
const DEPTH_ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
const CRITICAL_ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes for critical

// JOB-HIGH-03: DLQ metrics for monitoring
interface DLQMetrics {
  processed: number;
  currentDepth: number;
  lastAlertAt: string | null;
  lastCriticalAt: string | null;
  alertCount: number;
  criticalCount: number;
}

const dlqMetrics: DLQMetrics = {
  processed: 0,
  currentDepth: 0,
  lastAlertAt: null,
  lastCriticalAt: null,
  alertCount: 0,
  criticalCount: 0,
};

let worker: Worker<DLQJobData> | null = null;

// QUEUE-H01: Track last webhook alert to rate-limit external notifications
let lastWebhookAlertTime = 0;
const WEBHOOK_ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * QUEUE-H01 FIX: Send external alert via webhook and/or Sentry.
 * Rate-limited to prevent alert fatigue.
 */
async function sendExternalAlert(
  alertData: {
    type: "DLQ_JOB_ADDED" | "DLQ_DEPTH_WARNING" | "DLQ_DEPTH_CRITICAL";
    originalQueue?: string;
    jobId?: string;
    error?: string;
    depth?: number;
    threshold?: number;
  }
): Promise<void> {
  const now = Date.now();

  // Send Sentry event if available
  if (Sentry) {
    try {
      Sentry.captureMessage(`DLQ Alert: ${alertData.type}`, {
        level: alertData.type === "DLQ_DEPTH_CRITICAL" ? "error" : "warning",
        tags: {
          alertType: alertData.type,
          originalQueue: alertData.originalQueue ?? "unknown",
        },
        extra: alertData,
      });
    } catch (err) {
      log.debug("Failed to send Sentry alert", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Send webhook notification if configured and not in cooldown
  if (DLQ_ALERT_WEBHOOK_URL && now - lastWebhookAlertTime >= WEBHOOK_ALERT_COOLDOWN_MS) {
    lastWebhookAlertTime = now;

    const payload = {
      text: `DLQ Alert: ${alertData.type}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: alertData.type === "DLQ_DEPTH_CRITICAL"
              ? `:rotating_light: *CRITICAL: DLQ Depth at ${alertData.depth}* (threshold: ${alertData.threshold})`
              : alertData.type === "DLQ_DEPTH_WARNING"
              ? `:warning: *WARNING: DLQ Depth at ${alertData.depth}* (threshold: ${alertData.threshold})`
              : `:inbox_tray: Job moved to DLQ from \`${alertData.originalQueue}\``,
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `Service: open-seo-main | Time: ${new Date().toISOString()}`,
            },
          ],
        },
      ],
      attachments: alertData.error
        ? [{ color: "danger", text: `Error: ${alertData.error.slice(0, 500)}` }]
        : undefined,
    };

    try {
      const response = await fetch(DLQ_ALERT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        log.warn("Webhook alert failed", {
          status: response.status,
          statusText: response.statusText,
        });
      }
    } catch (err) {
      log.debug("Failed to send webhook alert", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

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

  // QUEUE-H01: Send external alert for new DLQ job
  await sendExternalAlert({
    type: "DLQ_JOB_ADDED",
    originalQueue,
    jobId,
    error,
  });

  // Update processed count
  dlqMetrics.processed++;

  jobLog.info("DLQ job processed", { originalQueue, originalJobId: jobId });
}

/**
 * JOB-HIGH-03: Check DLQ depth and log alerts if thresholds exceeded.
 * Enhanced with critical threshold and metrics tracking.
 */
async function checkDLQDepthAlert(
  jobLog: ReturnType<typeof createLogger>
): Promise<void> {
  const now = Date.now();

  try {
    const dlqQueue = getDLQQueue();
    const counts = await dlqQueue.getJobCounts("waiting", "active", "delayed");
    const totalDepth = counts.waiting + counts.active + counts.delayed;

    // Update metrics
    dlqMetrics.currentDepth = totalDepth;

    // Check critical threshold first (higher priority)
    if (
      totalDepth >= DLQ_DEPTH_CRITICAL_THRESHOLD &&
      now - lastCriticalAlertTime >= CRITICAL_ALERT_COOLDOWN_MS
    ) {
      lastCriticalAlertTime = now;
      dlqMetrics.lastCriticalAt = new Date().toISOString();
      dlqMetrics.criticalCount++;

      // CRITICAL level alert - immediate ops attention required
      log.error("CRITICAL: DLQ depth at critical level", undefined, {
        totalDepth,
        criticalThreshold: DLQ_DEPTH_CRITICAL_THRESHOLD,
        waiting: counts.waiting,
        active: counts.active,
        delayed: counts.delayed,
        alertType: "DLQ_CRITICAL",
        action: "IMMEDIATE_INVESTIGATION_REQUIRED",
      });

      // QUEUE-H01: Send external critical alert
      await sendExternalAlert({
        type: "DLQ_DEPTH_CRITICAL",
        depth: totalDepth,
        threshold: DLQ_DEPTH_CRITICAL_THRESHOLD,
      });
      return;
    }

    // Check warning threshold
    if (
      totalDepth >= DLQ_DEPTH_ALERT_THRESHOLD &&
      now - lastDepthAlertTime >= DEPTH_ALERT_COOLDOWN_MS
    ) {
      lastDepthAlertTime = now;
      dlqMetrics.lastAlertAt = new Date().toISOString();
      dlqMetrics.alertCount++;

      log.warn("DLQ depth threshold exceeded", {
        totalDepth,
        threshold: DLQ_DEPTH_ALERT_THRESHOLD,
        criticalThreshold: DLQ_DEPTH_CRITICAL_THRESHOLD,
        waiting: counts.waiting,
        active: counts.active,
        delayed: counts.delayed,
        alertType: "DLQ_WARNING",
      });

      // QUEUE-H01: Send external warning alert
      await sendExternalAlert({
        type: "DLQ_DEPTH_WARNING",
        depth: totalDepth,
        threshold: DLQ_DEPTH_ALERT_THRESHOLD,
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

  // QUEUE-H02: Use centralized concurrency limits
  worker = new Worker<DLQJobData>(DLQ_QUEUE_NAME, processDLQJob, {
    connection: getSharedBullMQConnection("worker:dlq"),
    lockDuration: LOCK_DURATION_MS,
    maxStalledCount: MAX_STALLED_COUNT,
    concurrency: WORKER_CONCURRENCY_LIMITS.dlq,
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

/**
 * JOB-HIGH-03: Get current DLQ metrics for monitoring/health checks.
 */
export function getDLQMetrics(): Readonly<DLQMetrics> {
  return { ...dlqMetrics };
}

/**
 * JOB-HIGH-03: Manually trigger a DLQ depth check.
 * Useful for health check endpoints.
 */
export async function checkDLQHealth(): Promise<{
  healthy: boolean;
  depth: number;
  status: "healthy" | "warning" | "critical";
}> {
  try {
    const dlqQueue = getDLQQueue();
    const counts = await dlqQueue.getJobCounts("waiting", "active", "delayed");
    const totalDepth = counts.waiting + counts.active + counts.delayed;

    let status: "healthy" | "warning" | "critical" = "healthy";
    if (totalDepth >= DLQ_DEPTH_CRITICAL_THRESHOLD) {
      status = "critical";
    } else if (totalDepth >= DLQ_DEPTH_ALERT_THRESHOLD) {
      status = "warning";
    }

    return {
      healthy: status !== "critical",
      depth: totalDepth,
      status,
    };
  } catch (err) {
    log.error(
      "Failed to check DLQ health",
      err instanceof Error ? err : new Error(String(err))
    );
    return {
      healthy: false,
      depth: -1,
      status: "critical",
    };
  }
}
