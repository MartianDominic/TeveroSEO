/**
 * BullMQ Queue definitions for the autonomous pipeline orchestration.
 *
 * - phaseQueue — phase-level jobs (parent)
 * - planQueue — plan-level jobs (children of phase)
 * - pipelineFlowProducer — creates parent-child job trees atomically
 *
 * Flow Producer enables parallel execution of independent plans within a phase
 * while ensuring phase jobs wait for all child plan jobs to complete.
 */
import { Queue, FlowProducer, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { getStandardJobOptions } from "@/server/lib/queue-utils";

export const PHASE_QUEUE_NAME = "pipeline-phase" as const;
export const PLAN_QUEUE_NAME = "pipeline-plan" as const;

/**
 * Data for phase-level jobs.
 * Phase jobs are parents that wait for all child plan jobs to complete.
 */
export interface PhaseJobData {
  phaseNumber: number;
  phaseName: string;
  phaseSlug: string;
  workspaceId: string;
  planIds: string[]; // e.g., ["38-01", "38-02", "38-03"]
  startedAt: string;
}

/**
 * Data for plan-level jobs.
 * Plan jobs execute individual plans via gsd-executor agent.
 */
export interface PlanJobData {
  planId: string; // e.g., "38-01"
  phaseNumber: number;
  phaseName: string;
  workspaceId: string;
  planPath: string; // e.g., ".planning/phases/38-autonomous-pipeline-orchestration/38-01-PLAN.md"
  step: PlanStep; // Current execution step
}

/**
 * Step enum drives step-level resume semantics.
 * Worker inspects `job.data.step` and resumes from last persisted step on retry.
 */
export const PLAN_STEP = {
  INITIAL: "initial",
  EXECUTING: "executing",
  VERIFYING: "verifying",
  COMPLETE: "complete",
} as const;

export type PlanStep = (typeof PLAN_STEP)[keyof typeof PLAN_STEP];

/**
 * Default job options for plan jobs.
 * Plans retry up to 3 times with exponential backoff on failure.
 * Job timeout is controlled via Worker lockDuration in plan-worker.ts.
 * Uses standardized retry configuration: exponential backoff with 1s base, 60s max.
 */
const DEFAULT_PLAN_JOB_OPTIONS: JobsOptions = getStandardJobOptions({
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 500 },
});

/**
 * Default job options for phase jobs.
 * Phase jobs don't retry — individual plans retry instead.
 * If all child plans complete, phase completes. If any fail after retries, phase fails.
 */
const DEFAULT_PHASE_JOB_OPTIONS: JobsOptions = {
  attempts: 1, // Phase jobs don't retry; individual plans retry
  removeOnComplete: { count: 50 },
  removeOnFail: { count: 100 },
};

/**
 * Queue for phase-level jobs.
 * Phase jobs are parents that orchestrate child plan jobs.
 */
export const phaseQueue = new Queue<PhaseJobData>(PHASE_QUEUE_NAME, {
  connection: getSharedBullMQConnection("queue:pipeline-phase"),
  defaultJobOptions: DEFAULT_PHASE_JOB_OPTIONS,
});

/**
 * Queue for plan-level jobs.
 * Plan jobs are children that execute individual plans via gsd-executor.
 */
export const planQueue = new Queue<PlanJobData>(PLAN_QUEUE_NAME, {
  connection: getSharedBullMQConnection("queue:pipeline-plan"),
  defaultJobOptions: DEFAULT_PLAN_JOB_OPTIONS,
});

/**
 * Flow Producer for creating parent-child job trees atomically.
 * Enables phase jobs to wait for all child plan jobs to complete.
 *
 * @example
 * await pipelineFlowProducer.add({
 *   name: 'phase-38',
 *   queueName: PHASE_QUEUE_NAME,
 *   data: { phaseNumber: 38, ... },
 *   children: [
 *     { name: 'plan-38-01', queueName: PLAN_QUEUE_NAME, data: { ... } },
 *     { name: 'plan-38-02', queueName: PLAN_QUEUE_NAME, data: { ... } },
 *   ]
 * });
 */
export const pipelineFlowProducer = new FlowProducer({
  connection: getSharedBullMQConnection("flow:pipeline"),
});

/**
 * Close the FlowProducer connection.
 * Call this during application shutdown to prevent connection leaks.
 */
export async function closePipelineFlowProducer(): Promise<void> {
  await pipelineFlowProducer.close();
}
