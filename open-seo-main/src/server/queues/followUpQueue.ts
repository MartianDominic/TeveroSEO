/**
 * BullMQ Queue definition for follow-up processing.
 * Phase 62-02: Follow-up system with rules engine
 *
 * Job types:
 * - create_scheduled: Create follow-up after delay
 * - process_due: Process all due follow-ups (recurring)
 * - evaluate_rules: Re-evaluate rules for an entity
 *
 * Threat mitigations:
 * - T-62-02-03: Rate limit via queue backpressure and job deduplication
 */
import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { getStandardJobOptions } from "@/server/lib/queue-utils";
import type { EntityType } from "@/db/follow-up-schema";

const log = createLogger({ module: "followUpQueue" });

export const FOLLOW_UP_QUEUE_NAME = "follow-up" as const;

/**
 * Job data for follow-up operations.
 */
export interface FollowUpJobData {
  type: "create_scheduled" | "process_due" | "evaluate_rules";
  workspaceId: string;
  ruleId?: string;
  entityType?: EntityType;
  entityId?: string;
  followUpData?: {
    followUpType: string;
    title: string;
    description?: string;
    priority: string;
    assignedTo?: string;
  };
}

/**
 * Dead-letter queue job data for failed follow-up jobs.
 */
export interface FollowUpDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: FollowUpJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}

/**
 * Default job options.
 * Uses standardized retry configuration: exponential backoff with 1s base, 60s max.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = getStandardJobOptions({
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
});

/**
 * Follow-up queue.
 * Uses shared BullMQ connection for Redis.
 */
export const followUpQueue = new Queue<FollowUpJobData | FollowUpDLQJobData>(
  FOLLOW_UP_QUEUE_NAME,
  {
    connection: getSharedBullMQConnection("queue:follow-up"),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  }
);

/**
 * Schedule recurring job to process due follow-ups.
 * Runs every 5 minutes.
 */
export async function scheduleFollowUpProcessing(): Promise<void> {
  // Add repeatable job
  await followUpQueue.add(
    "process-due",
    { type: "process_due", workspaceId: "all" },
    {
      repeat: {
        every: 5 * 60 * 1000, // 5 minutes
      },
      jobId: "follow-up-due-processor",
    }
  );

  // Remove any stale repeatable jobs
  const repeatableJobs = await followUpQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.id !== "follow-up-due-processor") {
      await followUpQueue.removeRepeatableByKey(job.key);
    }
  }

  log.info("Follow-up queue initialized with 5-minute repeatable job");
}

/**
 * Add a scheduled follow-up creation job.
 */
export async function addScheduledFollowUpJob(
  data: FollowUpJobData,
  delayMs: number
): Promise<void> {
  const jobId = `scheduled-${data.ruleId}-${data.entityId}`;

  await followUpQueue.add("create_scheduled", data, {
    delay: delayMs,
    jobId,
    removeOnComplete: { age: 86400 }, // 1 day
    removeOnFail: { age: 604800 }, // 7 days
  });

  log.info("Scheduled follow-up job added", {
    jobId,
    ruleId: data.ruleId,
    entityId: data.entityId,
    delayMs,
  });
}

/**
 * Add a rule evaluation job.
 * Used when an entity status changes.
 */
export async function addRuleEvaluationJob(
  workspaceId: string,
  entityType: EntityType,
  entityId: string
): Promise<void> {
  const jobId = `evaluate-${entityType}-${entityId}-${Date.now()}`;

  await followUpQueue.add(
    "evaluate_rules",
    {
      type: "evaluate_rules",
      workspaceId,
      entityType,
      entityId,
    },
    {
      jobId,
      removeOnComplete: { age: 3600 }, // 1 hour
      removeOnFail: { age: 86400 }, // 1 day
    }
  );

  log.debug("Rule evaluation job added", {
    jobId,
    workspaceId,
    entityType,
    entityId,
  });
}
