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
 * Default job options.
 * 3 attempts with exponential backoff.
 */
/**
 * Default job options for goal processing.
 * Job timeout is controlled via Worker lockDuration (set to 120s in goal-processor.ts).
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 5000,
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
};

/**
 * Goal processing queue.
 */
export const goalQueue = new Queue<GoalProcessorJobData>(GOAL_QUEUE_NAME, {
  connection: getSharedBullMQConnection("queue:goal-processor"),
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

/**
 * Initialize goal processing scheduler.
 * Runs every 5 minutes to process all goals.
 */
export async function initGoalProcessingScheduler(): Promise<void> {
  // Add repeatable job FIRST (safe if duplicate briefly exists)
  // This ensures the scheduler is never lost even if we crash during init
  await goalQueue.add(
    "process-all-goals",
    { triggeredAt: new Date().toISOString() },
    {
      repeat: {
        pattern: "*/5 * * * *", // Every 5 minutes
      },
      jobId: "goal-processor-scheduled",
    },
  );

  // THEN remove old duplicates (any repeatable jobs with different keys)
  const repeatableJobs = await goalQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    // Keep the one we just added, remove any stale ones
    if (job.id !== "goal-processor-scheduled") {
      await goalQueue.removeRepeatableByKey(job.key);
    }
  }

  log.info("Goal processing queue initialized with 5-minute repeatable job");
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
