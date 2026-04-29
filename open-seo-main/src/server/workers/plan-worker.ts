/**
 * BullMQ Worker for plan-level pipeline jobs.
 *
 * Executes individual plans by spawning the gsd-executor agent.
 * Uses step-enum pattern for durable execution across retries.
 *
 * Step progression:
 * 1. INITIAL -> Start execution
 * 2. EXECUTING -> Run gsd-executor on plan file
 * 3. VERIFYING -> Verification (part of executor output)
 * 4. COMPLETE -> Done
 *
 * On retry, the worker resumes from the last saved step.
 *
 * @module plan-worker
 */
import { Worker, type Job } from "bullmq";
import { spawn } from "child_process";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  PLAN_QUEUE_NAME,
  PLAN_STEP,
  type PlanJobData,
  type PlanStep,
} from "@/server/queues/pipelineQueue";
import { getDLQQueue } from "@/server/queues/dlq";

const log = createLogger({ module: "plan-worker" });

const LOCK_DURATION_MS = 600_000; // 10 minutes per plan
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 30_000;

// Validate planPath to prevent path traversal (T-38-03)
const VALID_PLAN_PATH_REGEX = /^\.planning\/phases\/[\w-]+\/[\w-]+-PLAN\.md$/;

let worker: Worker<PlanJobData> | null = null;

/**
 * Execute a plan job through all steps.
 * Uses step-enum pattern for durable execution.
 *
 * @param job - The BullMQ job containing plan data
 */
async function executePlan(job: Job<PlanJobData>): Promise<void> {
  const jobLog = createLogger({
    module: "plan-worker",
    jobId: job.id,
    planId: job.data.planId,
  });

  // Validate planPath to prevent path traversal (T-38-03)
  if (!VALID_PLAN_PATH_REGEX.test(job.data.planPath)) {
    throw new Error(
      `Invalid planPath format: ${job.data.planPath}. Must start with .planning/phases/`
    );
  }

  let step = job.data.step;

  while (step !== PLAN_STEP.COMPLETE) {
    switch (step) {
      case PLAN_STEP.INITIAL:
        jobLog.info("Starting plan execution", { planPath: job.data.planPath });
        await job.updateData({ ...job.data, step: PLAN_STEP.EXECUTING });
        step = PLAN_STEP.EXECUTING;
        break;

      case PLAN_STEP.EXECUTING:
        await runGsdExecutor(job.data.planPath, jobLog);
        await job.updateData({ ...job.data, step: PLAN_STEP.VERIFYING });
        step = PLAN_STEP.VERIFYING;
        break;

      case PLAN_STEP.VERIFYING:
        // Verification is part of gsd-executor output
        // Future: could run separate verification step
        await job.updateData({ ...job.data, step: PLAN_STEP.COMPLETE });
        step = PLAN_STEP.COMPLETE;
        break;

      default:
        throw new Error(`Unknown plan step: ${step}`);
    }
  }

  jobLog.info("Plan execution completed");
}

/**
 * Run the GSD executor CLI on a plan file.
 * Spawns claude CLI with gsd-execute-plan workflow.
 *
 * @param planPath - Path to the plan file
 * @param jobLog - Logger instance for this job
 */
async function runGsdExecutor(
  planPath: string,
  jobLog: ReturnType<typeof createLogger>
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Spawn claude CLI with gsd-execute-plan workflow
    // Note: shell: false for security (T-38-05)
    const proc = spawn("claude", ["--workflow", "gsd-execute-plan", planPath], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        jobLog.info("GSD executor completed", { planPath });
        resolve();
      } else {
        jobLog.error(
          "GSD executor failed",
          new Error(stderr || `Exit code ${code}`),
          { planPath, code }
        );
        reject(new Error(`GSD executor failed with code ${code}: ${stderr}`));
      }
    });

    proc.on("error", (err) => {
      jobLog.error("Failed to spawn GSD executor", err);
      reject(err);
    });
  });
}

/**
 * Start the plan worker.
 * Returns existing worker if already started.
 *
 * @returns The BullMQ Worker instance
 */
export function startPlanWorker(): Worker<PlanJobData> {
  if (worker) return worker;

  worker = new Worker<PlanJobData>(PLAN_QUEUE_NAME, executePlan, {
    connection: getSharedBullMQConnection("worker:pipeline-plan"),
    lockDuration: LOCK_DURATION_MS,
    maxStalledCount: MAX_STALLED_COUNT,
    concurrency: 2, // Can run 2 plans in parallel
  });

  worker.on("ready", () => {
    log.info("Plan worker ready", { queue: PLAN_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    log.error(
      "Plan worker error",
      err instanceof Error ? err : new Error(String(err))
    );
  });

  worker.on("completed", (job) => {
    log.info("Plan completed", { planId: job.data.planId });
  });

  worker.on("stalled", (jobId) => {
    log.warn("Plan job stalled", { jobId, queue: PLAN_QUEUE_NAME });
  });

  worker.on("failed", async (job, err) => {
    const error = err instanceof Error ? err : new Error(String(err));

    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      // Move to DLQ after all retries exhausted
      try {
        const dlq = getDLQQueue();
        await dlq.add('plan-worker-failed', {
          originalQueue: 'pipeline-plan',
          jobId: job.id,
          jobData: job.data,
          error: error.message,
          stack: error.stack,
          failedAt: new Date().toISOString(),
        });
        log.error('Plan job moved to DLQ', error, { jobId: job.id, planId: job.data.planId });
      } catch (dlqErr) {
        log.error('Failed to move plan job to DLQ', dlqErr instanceof Error ? dlqErr : new Error(String(dlqErr)), { jobId: job.id });
      }
    } else {
      log.warn('Plan job failed, will retry', {
        jobId: job?.id,
        planId: job?.data.planId,
        attempt: job?.attemptsMade,
        error: error.message,
      });
    }
  });

  return worker;
}

/**
 * Stop the plan worker gracefully.
 * Waits up to SHUTDOWN_TIMEOUT_MS for in-flight jobs to complete.
 */
export async function stopPlanWorker(): Promise<void> {
  if (!worker) return;
  const current = worker;
  worker = null;
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS)
  );
  const closed = current.close().then(() => "closed" as const);
  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    log.error("Plan worker shutdown timeout, forcing close");
    await current.close(true);
  }
}
