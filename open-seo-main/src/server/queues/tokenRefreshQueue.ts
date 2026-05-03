/**
 * BullMQ Queue definitions for token refresh system.
 * Phase 61-06: Platform Integration Excellence
 *
 * Implements D-11: Token refresh runs every 15 minutes.
 * Targets tokens expiring within 30 minutes.
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { getStandardJobOptions } from "@/server/lib/queue-utils";

const log = createLogger({ module: "tokenRefreshQueue" });

export const TOKEN_REFRESH_QUEUE_NAME = "token-refresh" as const;

/**
 * Job data for the check-expiring-tokens repeatable job.
 * This is the master job that runs every 15 minutes.
 */
export interface CheckExpiringTokensJobData {
  triggeredAt: string;
}

/**
 * Default job options for token refresh.
 * Uses standardized retry configuration: exponential backoff with 1s base, 60s max.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = getStandardJobOptions({
  removeOnComplete: { age: 3600 }, // 1 hour
  removeOnFail: { age: 86400 }, // 24 hours
});

export const tokenRefreshQueue = new Queue<CheckExpiringTokensJobData>(
  TOKEN_REFRESH_QUEUE_NAME,
  {
    connection: getSharedBullMQConnection("queue:token-refresh"),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  }
);

/**
 * Get the token refresh queue instance.
 * Alternative accessor for consistency with other queue patterns.
 */
export function getTokenRefreshQueue(): Queue<CheckExpiringTokensJobData> {
  return tokenRefreshQueue;
}

/**
 * Initialize scheduler for token refresh.
 * Runs every 15 minutes per D-11.
 *
 * Uses upsertJobScheduler for idempotent cron setup.
 * Call once on worker startup.
 */
export async function initTokenRefreshScheduler(): Promise<void> {
  await tokenRefreshQueue.upsertJobScheduler(
    "token-refresh-scheduler",
    { every: 15 * 60 * 1000 }, // 15 minutes in milliseconds
    {
      name: "check-expiring-tokens",
      data: { triggeredAt: new Date().toISOString() },
      opts: {
        attempts: 1, // Master job should not retry
        removeOnComplete: { count: 30 },
      },
    }
  );
  log.info("Token refresh scheduler initialized", { interval: "15 minutes" });
}

/**
 * Manually trigger a token refresh check.
 * Useful for testing or manual intervention.
 */
export async function triggerTokenRefreshCheck(): Promise<string | undefined> {
  const job = await tokenRefreshQueue.add(
    "check-expiring-tokens",
    { triggeredAt: new Date().toISOString() },
    {
      jobId: `manual-refresh-${Date.now()}`,
    }
  );
  log.info("Manual token refresh check triggered", { jobId: job.id });
  return job.id;
}
