/**
 * BullMQ Queue definition for daily keyword ranking checks.
 *
 * - `rankingQueue` - primary queue for ranking jobs
 * - Runs daily at 03:00 UTC to check all tracking-enabled keywords
 *
 * Job types:
 * - check-keyword-rankings: Process all keywords needing rank checks
 * - dlq:keyword-ranking: Dead-letter queue for failed jobs
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "rankingQueue" });

export const RANKING_QUEUE_NAME = "keyword-ranking" as const;

/**
 * Job data for ranking check.
 */
export interface RankingJobData {
  triggeredAt: string; // ISO timestamp
  /** Checkpoint offset for resumable processing on retry */
  offset?: number;
}

/**
 * Dead-letter queue job data for failed ranking jobs.
 */
export interface RankingDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: RankingJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}

/**
 * Default job options.
 * 3 attempts with exponential backoff.
 */
/**
 * Default job options for ranking jobs.
 * Job timeout is controlled via Worker lockDuration (set to 300s in ranking-worker.ts).
 *
 * NOTE: Ranking queue intentionally uses longer retry delays (10s base) than the
 * standard configuration (1s base). This is because:
 * - Ranking checks call external APIs (DataForSEO, Google SERP) with rate limits
 * - External services need longer recovery windows after transient failures
 * - Batched keyword processing means each retry processes many keywords
 *
 * See queue-utils.ts for the standard retry configuration used by internal queues.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10_000, // 10s, 20s, 40s (longer delays for external API rate limits)
  },
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
};

/**
 * Ranking queue.
 * Uses shared BullMQ connection for Redis.
 */
export const rankingQueue = new Queue<RankingJobData | RankingDLQJobData>(
  RANKING_QUEUE_NAME,
  {
    connection: getSharedBullMQConnection("queue:ranking"),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  },
);

/**
 * Initialize the ranking queue.
 *
 * Phase 91: DISABLED automatic daily scheduling.
 * Reason: $100-300/month wasted checking ALL keywords daily when users don't look at rankings daily.
 *
 * Rankings are now ON-DEMAND only via triggerRankingCheck().
 * Add a "Refresh Rankings" button in UI to call this.
 */
export async function initRankingScheduler(): Promise<void> {
  // Phase 91: Remove any existing repeatable jobs (cleanup from previous versions)
  const repeatableJobs = await rankingQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await rankingQueue.removeRepeatableByKey(job.key).catch((err) => {
      log.warn("Failed to remove old repeatable job", { key: job.key, error: err.message });
    });
  }

  log.info("Ranking queue initialized (on-demand only, no automatic scheduling)");
}

/**
 * Manually trigger a ranking check.
 * Useful for testing or immediate ranking updates.
 */
export async function triggerRankingCheck(): Promise<void> {
  await rankingQueue.add(
    "check-keyword-rankings",
    { triggeredAt: new Date().toISOString() },
    {
      jobId: `manual-ranking-${Date.now()}`,
    },
  );
  log.info("Manual ranking check triggered");
}
