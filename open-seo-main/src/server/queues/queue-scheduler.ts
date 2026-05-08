/**
 * Centralized Queue Scheduler
 *
 * SCRAPE-02/SCRAPE-03 FIX: Consolidates all recurring job schedules in one place.
 * Jobs are staggered by 15-minute intervals to prevent:
 * - Connection pool exhaustion
 * - API quota collisions
 * - Resource contention
 *
 * Schedule (UTC):
 * - 2:00 AM - sitemap-refresh (lightweight)
 * - 2:15 AM - gsc-sync (Google Search Console)
 * - 2:30 AM - ga4-sync (Google Analytics 4)
 * - 2:45 AM - trend-calculation (also event-driven after GSC sync)
 * - 3:00 AM - analytics-sync (legacy sync-all-clients)
 * - 3:15 AM - cannibalization-detection
 * - 3:30 AM - content-audit-batch
 * - 4:00 AM - maintenance (cache cleanup)
 * - 4:30 AM - dlq-cleanup (BMQ-002 FIX: staggered from maintenance)
 */

import { Queue } from "bullmq";
import { format } from "date-fns";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "queue-scheduler" });

// ============================================================================
// Job Schedule Configuration
// ============================================================================

/**
 * Centralized schedule configuration for all recurring jobs.
 * Staggered by 15-minute intervals to prevent resource contention.
 */
export const SCHEDULED_JOBS = {
  "sitemap-refresh": {
    cron: "0 2 * * *", // 2:00 AM UTC
    queue: "sitemap",
    description: "Refresh sitemap index",
  },
  "gsc-sync": {
    cron: "15 2 * * *", // 2:15 AM UTC
    queue: "gsc-sync",
    description: "Google Search Console data sync",
  },
  "ga4-sync": {
    cron: "30 2 * * *", // 2:30 AM UTC
    queue: "ga4-sync",
    description: "Google Analytics 4 data sync",
  },
  "trend-calculation": {
    cron: "45 2 * * *", // 2:45 AM UTC
    queue: "trend-calculation",
    description: "Calculate position trends and anomaly detection",
  },
  "analytics-sync": {
    cron: "0 3 * * *", // 3:00 AM UTC (moved from 2:00 AM)
    queue: "analytics-sync",
    description: "Legacy analytics sync (fans out to per-client jobs)",
  },
  "cannibalization-detection": {
    cron: "15 3 * * *", // 3:15 AM UTC
    queue: "cannibalization",
    description: "Keyword cannibalization detection",
  },
  "content-audit-batch": {
    cron: "30 3 * * *", // 3:30 AM UTC
    queue: "audit",
    description: "Batch content audit processing",
  },
  "maintenance": {
    cron: "0 4 * * *", // 4:00 AM UTC (moved from 3:00 AM)
    queue: "maintenance",
    description: "Cache cleanup and system maintenance",
  },
  "dlq-cleanup": {
    cron: "30 4 * * *", // 4:30 AM UTC (BMQ-002 FIX: staggered from maintenance at 4:00)
    queue: "dead-letter-queue",
    description: "Dead letter queue cleanup",
  },
} as const;

export type ScheduledJobName = keyof typeof SCHEDULED_JOBS;

// ============================================================================
// Job Deduplication
// ============================================================================

/**
 * QUEUE-04 FIX: Generate deterministic job ID for deduplication.
 * BullMQ will reject jobs with duplicate IDs, preventing concurrent syncs.
 *
 * Format: `{queue}:{workspaceId}:{yyyy-MM-dd}`
 *
 * @param queue - Queue name
 * @param workspaceId - Workspace or client ID (use 'system' for system jobs)
 * @param date - Date for the job (defaults to now)
 * @returns Deterministic job ID
 *
 * @example
 * ```typescript
 * // System-level daily job
 * const jobId = generateDailyJobId('gsc-sync', 'system');
 * // => 'gsc-sync:system:2024-05-08'
 *
 * // Per-workspace job
 * const jobId = generateDailyJobId('gsc-sync', 'ws_abc123');
 * // => 'gsc-sync:ws_abc123:2024-05-08'
 * ```
 */
export function generateDailyJobId(
  queue: string,
  workspaceId: string,
  date: Date = new Date()
): string {
  const dateStr = format(date, "yyyy-MM-dd");
  return `${queue}:${workspaceId}:${dateStr}`;
}

/**
 * Generate job ID with hour precision for more frequent jobs.
 * Use for jobs that run multiple times per day.
 *
 * Format: `{queue}:{workspaceId}:{yyyy-MM-dd-HH}`
 */
export function generateHourlyJobId(
  queue: string,
  workspaceId: string,
  date: Date = new Date()
): string {
  const dateStr = format(date, "yyyy-MM-dd-HH");
  return `${queue}:${workspaceId}:${dateStr}`;
}

/**
 * Generate job ID with minute precision for high-frequency jobs.
 * Use for jobs that may run multiple times per hour.
 *
 * Format: `{queue}:{workspaceId}:{yyyy-MM-dd-HH-mm}`
 */
export function generateMinuteJobId(
  queue: string,
  workspaceId: string,
  date: Date = new Date()
): string {
  const dateStr = format(date, "yyyy-MM-dd-HH-mm");
  return `${queue}:${workspaceId}:${dateStr}`;
}

// ============================================================================
// Queue Registry
// ============================================================================

// Cache for queue instances to avoid creating duplicates
const queueCache = new Map<string, Queue>();

/**
 * Get or create a queue instance for a given queue name.
 */
function getQueue(queueName: string): Queue {
  let queue = queueCache.get(queueName);
  if (!queue) {
    queue = new Queue(queueName, {
      connection: getSharedBullMQConnection(`scheduler:${queueName}`),
    });
    queueCache.set(queueName, queue);
  }
  return queue;
}

// ============================================================================
// Scheduler Initialization
// ============================================================================

/**
 * Initialize all recurring job schedules.
 * Uses BullMQ's upsertJobScheduler for idempotent cron setup.
 *
 * Call this once on application startup (typically in worker-entry.ts).
 *
 * @throws Error if scheduler initialization fails
 */
export async function initAllSchedulers(): Promise<void> {
  log.info("Initializing centralized job schedulers...");

  const results = await Promise.allSettled(
    Object.entries(SCHEDULED_JOBS).map(async ([name, config]) => {
      const queue = getQueue(config.queue);

      await queue.upsertJobScheduler(
        name,
        { pattern: config.cron },
        {
          name,
          data: { triggeredAt: new Date().toISOString() },
          opts: {
            removeOnComplete: { count: 30 },
            removeOnFail: { count: 100 },
          },
        }
      );

      log.info("Scheduler initialized", {
        name,
        queue: config.queue,
        cron: config.cron,
        description: config.description,
      });
    })
  );

  // Check for failures
  const failures = results.filter((r) => r.status === "rejected");
  if (failures.length > 0) {
    const errors = failures.map(
      (f) => (f as PromiseRejectedResult).reason
    );
    log.error("Some schedulers failed to initialize", new Error(errors.join("; ")));
  }

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  log.info("Scheduler initialization complete", {
    succeeded,
    failed: failures.length,
    total: Object.keys(SCHEDULED_JOBS).length,
  });
}

/**
 * Remove all scheduled jobs (for testing or cleanup).
 */
export async function removeAllSchedulers(): Promise<void> {
  log.info("Removing all job schedulers...");

  for (const [name, config] of Object.entries(SCHEDULED_JOBS)) {
    try {
      const queue = getQueue(config.queue);
      await queue.removeJobScheduler(name);
      log.debug("Scheduler removed", { name, queue: config.queue });
    } catch (err) {
      log.warn("Failed to remove scheduler", {
        name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

/**
 * Close all queue connections.
 * Call during graceful shutdown.
 */
export async function closeAllQueues(): Promise<void> {
  log.info("Closing scheduler queue connections...");

  for (const [name, queue] of queueCache) {
    try {
      await queue.close();
      log.debug("Queue closed", { name });
    } catch (err) {
      log.warn("Failed to close queue", {
        name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  queueCache.clear();
}

// ============================================================================
// Legacy Migration Helpers
// ============================================================================

/**
 * Remove legacy schedulers that have been consolidated.
 * Call this once during migration to clean up old repeatable jobs.
 */
export async function removeLegacySchedulers(): Promise<void> {
  log.info("Removing legacy schedulers...");

  // Legacy scheduler IDs that need to be removed
  const legacySchedulers = [
    { queue: "analytics-sync", schedulerId: "nightly-analytics-sync" },
    { queue: "gsc-sync", schedulerId: "gsc-full-sync-daily" },
    { queue: "maintenance", schedulerId: "cache-cleanup-daily" },
  ];

  for (const { queue: queueName, schedulerId } of legacySchedulers) {
    try {
      const queue = getQueue(queueName);
      await queue.removeJobScheduler(schedulerId);
      log.info("Legacy scheduler removed", { queue: queueName, schedulerId });
    } catch (err) {
      // Scheduler may not exist, which is fine
      log.debug("Legacy scheduler not found or already removed", {
        queue: queueName,
        schedulerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Also remove old repeatable jobs (pre-v5 BullMQ pattern)
  const legacyRepeatableJobs = [
    { queue: "gsc-sync", jobId: "gsc-full-sync-daily" },
    { queue: "maintenance", jobId: "cache-cleanup-daily" },
  ];

  for (const { queue: queueName, jobId } of legacyRepeatableJobs) {
    try {
      const queue = getQueue(queueName);
      const repeatableJobs = await queue.getRepeatableJobs();
      for (const job of repeatableJobs) {
        if (job.id === jobId || job.name === jobId) {
          await queue.removeRepeatableByKey(job.key);
          log.info("Legacy repeatable job removed", { queue: queueName, key: job.key });
        }
      }
    } catch (err) {
      log.debug("Failed to remove legacy repeatable job", {
        queue: queueName,
        jobId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

// ============================================================================
// Health Check
// ============================================================================

export interface SchedulerHealthReport {
  name: string;
  queue: string;
  cron: string;
  nextRun: string | null;
  active: boolean;
}

/**
 * Get health report for all schedulers.
 */
export async function getSchedulerHealthReport(): Promise<SchedulerHealthReport[]> {
  const reports: SchedulerHealthReport[] = [];

  for (const [name, config] of Object.entries(SCHEDULED_JOBS)) {
    try {
      const queue = getQueue(config.queue);
      const schedulers = await queue.getJobSchedulers();
      const scheduler = schedulers.find((s) => s.id === name);

      reports.push({
        name,
        queue: config.queue,
        cron: config.cron,
        nextRun: scheduler?.next ? new Date(scheduler.next).toISOString() : null,
        active: !!scheduler,
      });
    } catch (err) {
      reports.push({
        name,
        queue: config.queue,
        cron: config.cron,
        nextRun: null,
        active: false,
      });
    }
  }

  return reports;
}
