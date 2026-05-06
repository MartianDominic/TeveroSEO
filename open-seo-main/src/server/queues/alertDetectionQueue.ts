/**
 * BullMQ Queue definition for alert detection.
 * Phase 62-07: Smart Alert Detection
 *
 * - `alertDetectionQueue` - primary queue for alert detection jobs
 * - Handles single workspace detection and batch detection for all workspaces
 * - Scheduled detection every 5 minutes per DESIGN.md
 *
 * Job types:
 * - detect_workspace: Detect alerts for a single workspace
 * - detect_all: Run detection for all active workspaces
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { getStandardJobOptions } from "@/server/lib/queue-utils";

const log = createLogger({ module: "alertDetectionQueue" });

export const ALERT_DETECTION_QUEUE_NAME = "alert-detection" as const;

/**
 * Job data types for alert detection queue.
 */
export interface AlertDetectionJobData {
  type: "detect_workspace" | "detect_all";
  workspaceId?: string;
}

/**
 * Default job options.
 * Uses standardized retry configuration: exponential backoff with 1s base, 60s max.
 * Alert detection is idempotent so retries are safe.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = getStandardJobOptions({
  attempts: 2,
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
});

/**
 * Alert detection queue.
 * Uses shared BullMQ connection for Redis.
 */
export const alertDetectionQueue = new Queue<AlertDetectionJobData>(
  ALERT_DETECTION_QUEUE_NAME,
  {
  connection: getSharedBullMQConnection("queue:alert-detection"),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Initialize the alert detection queue.
 *
 * Phase 91: DISABLED automatic 5-minute polling.
 * Reason: Polling every 5 minutes wastes resources — metrics don't change that often.
 *
 * Alert detection is now ON-DEMAND only:
 * - Call enqueueWorkspaceAlertDetection() after metrics update completes
 * - Chain from metrics refresh workers/endpoints
 */
export async function initAlertDetectionQueue(): Promise<void> {
  // Phase 91: Remove any existing repeatable jobs (cleanup from previous versions)
  const repeatableJobs = await alertDetectionQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await alertDetectionQueue.removeRepeatableByKey(job.key).catch((err) => {
      log.warn("Failed to remove old repeatable job", { key: job.key, error: err.message });
    });
  }

  log.info("Alert detection queue initialized (on-demand only, no automatic polling)");
}

/**
 * Schedule alert detection (called from startup).
 */
export async function scheduleAlertDetection(): Promise<void> {
  await initAlertDetectionQueue();
}

/**
 * Enqueue alert detection for a single workspace.
 * Used when metrics change or on-demand.
 *
 * @param workspaceId - Workspace to detect alerts for
 */
export async function enqueueWorkspaceAlertDetection(
  workspaceId: string
): Promise<void> {
  await alertDetectionQueue.add(
    "detect-workspace",
    { type: "detect_workspace", workspaceId },
    {
      jobId: `detect-${workspaceId}-${Date.now()}`,
    }
  );
  log.debug("Workspace alert detection enqueued", { workspaceId });
}

/**
 * Enqueue detection for all workspaces.
 * Used by scheduled job.
 */
export async function enqueueAlertDetectionAll(): Promise<void> {
  await alertDetectionQueue.add(
    "detect-all",
    { type: "detect_all" },
    {
      jobId: `detect-all-${Date.now()}`,
    }
  );
  log.debug("Alert detection for all workspaces enqueued");
}

/**
 * Get queue metrics for monitoring.
 */
export async function getAlertDetectionQueueMetrics(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    alertDetectionQueue.getWaitingCount(),
    alertDetectionQueue.getActiveCount(),
    alertDetectionQueue.getCompletedCount(),
    alertDetectionQueue.getFailedCount(),
    alertDetectionQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}
