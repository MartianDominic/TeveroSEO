/**
 * BullMQ Queue definition for goal processing.
 * Phase 22: Goal-Based Metrics System
 *
 * - Runs every 5 minutes to compute all goal progress
 * - Supports immediate processing for single goals/clients
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { getStandardJobOptions } from "@/server/lib/queue-utils";

const log = createLogger({ module: "goalQueue" });

export const GOAL_QUEUE_NAME = "goal-processor" as const;

/**
 * Job data for goal processing.
 */
export interface GoalProcessorJobData {
  clientId?: string; // Process specific client, or all if omitted
  goalId?: string; // Process specific goal
  triggeredAt?: string; // ISO timestamp
}

/**
 * Dead-letter queue job data for failed goal processing jobs.
 * HIGH-52 fix: Standardized DLQ pattern with inline prefix.
 */
export interface GoalDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: GoalProcessorJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}

/**
 * Default job options for goal processing.
 * Job timeout is controlled via Worker lockDuration (set to 120s in goal-processor.ts).
 * Uses standardized retry configuration: exponential backoff with 1s base, 60s max.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = getStandardJobOptions({
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
});

/**
 * Goal processing queue.
 * HIGH-52 fix: Queue type includes DLQ jobs for inline prefix pattern.
 */
export const goalQueue = new Queue<GoalProcessorJobData | GoalDLQJobData>(GOAL_QUEUE_NAME, {
  connection: getSharedBullMQConnection("queue:goal-processor"),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Initialize goal processing scheduler.
 * MED-36 fix: Uses upsertJobScheduler() instead of deprecated repeat option.
 * Runs every 5 minutes to process all goals.
 */
export async function initGoalProcessingScheduler(): Promise<void> {
  // Use upsertJobScheduler for idempotent cron setup (BullMQ v5 pattern)
  await goalQueue.upsertJobScheduler(
    "goal-processor-scheduled", // Scheduler ID
    { pattern: "*/5 * * * *" }, // Every 5 minutes
    {
      name: "process-all-goals",
      data: { triggeredAt: new Date().toISOString() },
      opts: {
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 50 },
      },
    },
  );

  log.info("Goal processing queue initialized with 5-minute scheduler", { pattern: "*/5 * * * *" });
}

/**
 * Process a single client's goals immediately.
 */
export async function processClientGoals(clientId: string): Promise<void> {
  await goalQueue.add(
    "process-client-goals",
    { clientId, triggeredAt: new Date().toISOString() },
    { priority: 1 },
  );
  log.info("Client goal processing queued", { clientId });
}

/**
 * Process a single goal immediately (after create/update).
 */
export async function processGoalImmediate(goalId: string): Promise<void> {
  await goalQueue.add(
    "process-single-goal",
    { goalId, triggeredAt: new Date().toISOString() },
    { priority: 1 },
  );
  log.info("Single goal processing queued", { goalId });
}
