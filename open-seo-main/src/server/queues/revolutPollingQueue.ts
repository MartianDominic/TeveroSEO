/**
 * BullMQ Queue for Revolut API polling.
 * Phase 101: Direct Proposal & Manual Deal Pipeline
 *
 * Implements D-03: Revolut polling every 15 minutes to catch missed webhooks.
 * Polls the Revolut Business API for completed transactions and ingests
 * them via PaymentIngestionService.
 *
 * Per 101-RESEARCH.md:
 * - Polling interval: 15 minutes (not 5 minutes like token refresh)
 * - Targets accounts with active Revolut integration
 * - Idempotent ingestion prevents duplicates
 */
import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { getStandardJobOptions } from "@/server/lib/queue-utils";

const log = createLogger({ module: "revolutPollingQueue" });

export const REVOLUT_POLLING_QUEUE_NAME = "revolut-polling" as const;

/**
 * Job data for the Revolut polling repeatable job.
 * Master job runs every 15 minutes to check all configured workspaces.
 */
export interface RevolutPollingJobData {
  type: "poll-transactions" | "poll-workspace";
  triggeredAt: string;
  workspaceId?: string;
  accountId?: string;
  lastPollTimestamp?: string; // ISO timestamp for incremental fetching
}

/**
 * Dead-letter queue job data for failed polling jobs.
 */
export interface RevolutPollingDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: RevolutPollingJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}

/**
 * Default job options for Revolut polling.
 * Uses standardized retry configuration: exponential backoff with 1s base, 60s max.
 * Higher retry count (5) for external API calls that may have transient failures.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = getStandardJobOptions({
  attempts: 5,
  removeOnComplete: { age: 3600 }, // 1 hour
  removeOnFail: { age: 86400 }, // 24 hours
});

export const revolutPollingQueue = new Queue<RevolutPollingJobData>(
  REVOLUT_POLLING_QUEUE_NAME,
  {
    connection: getSharedBullMQConnection("queue:revolut-polling"),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  }
);

/**
 * Get the Revolut polling queue instance.
 * Alternative accessor for consistency with other queue patterns.
 */
export function getRevolutPollingQueue(): Queue<RevolutPollingJobData> {
  return revolutPollingQueue;
}

/**
 * Initialize scheduler for Revolut polling.
 * Runs every 15 minutes per D-03.
 *
 * Uses upsertJobScheduler for idempotent cron setup.
 * Call once on worker startup.
 */
export async function initRevolutPollingScheduler(): Promise<void> {
  // JOBS-03 NOTE: Deduplication is handled by BullMQ's scheduler mechanism.
  // The scheduler ID "revolut-polling-scheduler" ensures only one scheduler exists.
  // BullMQ prevents duplicate jobs by tracking the scheduler's last run time.
  // If a job is still running when the next interval fires, BullMQ will either:
  // - Skip the new job (if using `immediately: false`)
  // - Or queue it to run after the current job completes
  // The attempts: 1 setting ensures failed master jobs don't retry and block the queue.
  await revolutPollingQueue.upsertJobScheduler(
    "revolut-polling-scheduler",
    { every: 15 * 60 * 1000 }, // 15 minutes in milliseconds
    {
      name: "poll-transactions",
      data: {
        type: "poll-transactions",
        triggeredAt: new Date().toISOString(),
      },
      opts: {
        attempts: 1, // Master job should not retry - individual workspace jobs handle retries
        removeOnComplete: { count: 30 },
      },
    }
  );
  log.info("Revolut polling scheduler initialized", { interval: "15 minutes" });
}

/**
 * Schedule a one-off poll for a specific workspace's Revolut account.
 * Used when:
 * - Workspace first configures Revolut integration
 * - Manual trigger from admin UI
 * - Catch-up after downtime
 *
 * @param workspaceId - Workspace to poll
 * @param accountId - Revolut account ID (optional, uses default if not specified)
 * @param lastPollTimestamp - Only fetch transactions after this time
 */
export async function scheduleWorkspacePoll(
  workspaceId: string,
  accountId?: string,
  lastPollTimestamp?: string
): Promise<string | undefined> {
  const job = await revolutPollingQueue.add(
    "poll-workspace",
    {
      type: "poll-workspace",
      triggeredAt: new Date().toISOString(),
      workspaceId,
      accountId,
      lastPollTimestamp,
    },
    {
      jobId: `revolut-poll:${workspaceId}:${Date.now()}`,
    }
  );
  log.info("Scheduled workspace Revolut poll", { workspaceId, jobId: job.id });
  return job.id;
}

/**
 * Manually trigger a full Revolut polling check.
 * Useful for testing or manual intervention.
 */
export async function triggerRevolutPollingCheck(): Promise<string | undefined> {
  const job = await revolutPollingQueue.add(
    "poll-transactions",
    {
      type: "poll-transactions",
      triggeredAt: new Date().toISOString(),
    },
    {
      jobId: `manual-revolut-poll-${Date.now()}`,
    }
  );
  log.info("Manual Revolut polling check triggered", { jobId: job.id });
  return job.id;
}
