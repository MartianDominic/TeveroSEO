/**
 * BullMQ Queue definition for engagement workflow execution.
 * Phase 62-03: Engagement Workflow Engine
 *
 * - `workflowQueue` - primary queue for workflow jobs
 * - Handles step execution, snooze resumption, and weekly touch resets
 *
 * Job types:
 * - execute_step: Execute current step of a workflow instance
 * - unsnooze: Resume a snoozed workflow
 * - reset_weekly_touches: Reset touch counts for all active instances (Monday job)
 * - start_from_trigger: Start workflow from event trigger
 * - dlq:workflow: Dead-letter queue for failed jobs
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import type { EntityType } from "@/db";

const log = createLogger({ module: "workflowQueue" });

export const WORKFLOW_QUEUE_NAME = "engagement-workflow" as const;

/**
 * Job data types for workflow queue.
 */
export interface WorkflowJobData {
  type:
    | "execute_step"
    | "unsnooze"
    | "reset_weekly_touches"
    | "start_from_trigger";
  instanceId?: string;
  workspaceId?: string;
  templateId?: string;
  entityType?: EntityType;
  entityId?: string;
  context?: Record<string, unknown>;
}

/**
 * Dead-letter queue job data for failed workflow jobs.
 */
export interface WorkflowDLQJobData {
  originalJobId: string | undefined;
  originalJobName: string;
  data: WorkflowJobData;
  error: string;
  stack: string | undefined;
  failedAt: string;
  attemptsMade: number;
}

/**
 * Default job options.
 * 3 attempts with exponential backoff.
 * Longer timeout for workflow steps that may involve external calls.
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 10_000, // 10s, 20s, 40s
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

/**
 * Workflow queue.
 * Uses shared BullMQ connection for Redis.
 */
export const workflowQueue = new Queue<WorkflowJobData | WorkflowDLQJobData>(
  WORKFLOW_QUEUE_NAME,
  {
    connection: getSharedBullMQConnection("queue:workflow"),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  },
);

/**
 * Initialize the workflow queue with repeatable jobs.
 * - Weekly touch reset runs every Monday at 00:00 UTC
 */
export async function initWorkflowQueue(): Promise<void> {
  // Add weekly touch reset job
  await workflowQueue.add(
    "reset-weekly-touches",
    { type: "reset_weekly_touches" },
    {
      repeat: {
        pattern: "0 0 * * 1", // Every Monday at 00:00
      },
      jobId: "weekly-touch-reset",
    },
  );

  // Clean up old repeatable jobs
  const repeatableJobs = await workflowQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    if (job.id !== "weekly-touch-reset") {
      await workflowQueue.removeRepeatableByKey(job.key);
    }
  }

  log.info("Workflow queue initialized with weekly touch reset job");
}

/**
 * Enqueue a workflow step execution.
 *
 * @param instanceId - Workflow instance ID
 * @param stepIndex - Current step index (for job deduplication)
 * @param delay - Optional delay in milliseconds
 */
export async function enqueueStepExecution(
  instanceId: string,
  stepIndex: number,
  delay?: number,
): Promise<void> {
  await workflowQueue.add(
    "execute-step",
    { type: "execute_step", instanceId },
    {
      jobId: delay
        ? `step-${instanceId}-${stepIndex}-delayed`
        : `step-${instanceId}-${stepIndex}`,
      delay,
    },
  );
  log.debug("Step execution enqueued", { instanceId, stepIndex, delay });
}

/**
 * Enqueue workflow start from a trigger event.
 *
 * @param workspaceId - Workspace ID
 * @param templateId - Template to use
 * @param entityType - Entity type (proposal, contract, etc.)
 * @param entityId - Entity ID
 * @param context - Additional context for personalization
 */
export async function enqueueWorkflowStart(
  workspaceId: string,
  templateId: string,
  entityType: EntityType,
  entityId: string,
  context?: Record<string, unknown>,
): Promise<void> {
  await workflowQueue.add(
    "start-workflow",
    {
      type: "start_from_trigger",
      workspaceId,
      templateId,
      entityType,
      entityId,
      context,
    },
    {
      jobId: `start-${entityType}-${entityId}-${Date.now()}`,
    },
  );
  log.info("Workflow start enqueued", { workspaceId, templateId, entityType, entityId });
}

/**
 * Enqueue unsnooze for a workflow instance.
 *
 * @param instanceId - Workflow instance ID
 * @param delayMs - Delay until unsnooze
 */
export async function enqueueUnsnooze(
  instanceId: string,
  delayMs: number,
): Promise<void> {
  await workflowQueue.add(
    "unsnooze",
    { type: "unsnooze", instanceId },
    {
      delay: Math.max(delayMs, 0),
      jobId: `unsnooze-${instanceId}`,
    },
  );
  log.debug("Unsnooze enqueued", { instanceId, delayMs });
}

/**
 * Get queue metrics for monitoring.
 */
export async function getWorkflowQueueMetrics(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}> {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    workflowQueue.getWaitingCount(),
    workflowQueue.getActiveCount(),
    workflowQueue.getCompletedCount(),
    workflowQueue.getFailedCount(),
    workflowQueue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}
