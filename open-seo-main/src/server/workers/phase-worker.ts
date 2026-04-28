/**
 * BullMQ Worker for phase-level pipeline jobs.
 *
 * Phase jobs are parents that wait for all child plan jobs to complete.
 * The actual work happens in plan-worker.ts; this worker is an orchestrator.
 *
 * BullMQ Flow semantics:
 * - Parent job is queued but not processed until all children complete
 * - If any child fails after retries, parent is also marked failed
 * - This processor runs AFTER all children complete successfully
 *
 * @module phase-worker
 */
import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  PHASE_QUEUE_NAME,
  type PhaseJobData,
} from "@/server/queues/pipelineQueue";
import { getDLQQueue } from "@/server/queues/dlq";

const log = createLogger({ module: "phase-worker" });

const LOCK_DURATION_MS = 300_000; // 5 minutes (phases can take a while)
const MAX_STALLED_COUNT = 1;
const SHUTDOWN_TIMEOUT_MS = 30_000;

let worker: Worker<PhaseJobData> | null = null;

/**
 * Start the phase worker.
 * Returns existing worker if already started.
 *
 * @returns The BullMQ Worker instance
 */
export function startPhaseWorker(): Worker<PhaseJobData> {
  if (worker) return worker;

  worker = new Worker<PhaseJobData>(
    PHASE_QUEUE_NAME,
    async (job: Job<PhaseJobData>) => {
      const jobLog = createLogger({
        module: "phase-worker",
        jobId: job.id,
        phaseNumber: job.data.phaseNumber,
      });

      jobLog.info("Phase job started", {
        phaseName: job.data.phaseName,
        planCount: job.data.planIds.length,
      });

      // Phase jobs wait for children to complete (BullMQ Flow semantics)
      // No explicit work needed here; BullMQ handles parent-child coordination
      // This processor runs after all children complete

      jobLog.info("Phase job completed (all plans finished)", {
        phaseName: job.data.phaseName,
      });

      return {
        phaseNumber: job.data.phaseNumber,
        completedAt: new Date().toISOString(),
      };
    },
    {
      connection: getSharedBullMQConnection("worker:pipeline-phase"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 1, // One phase at a time
    }
  );

  worker.on("ready", () => {
    log.info("Phase worker ready", { queue: PHASE_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    log.error(
      "Phase worker error",
      err instanceof Error ? err : new Error(String(err))
    );
  });

  worker.on("completed", (job) => {
    log.info("Phase completed", {
      phaseNumber: job.data.phaseNumber,
      phaseName: job.data.phaseName,
    });
  });

  worker.on("failed", async (job, err) => {
    const error = err instanceof Error ? err : new Error(String(err));

    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
      // Move to DLQ after all retries exhausted
      try {
        const dlq = getDLQQueue();
        await dlq.add('phase-worker-failed', {
          originalQueue: 'pipeline-phase',
          jobId: job.id,
          jobData: job.data,
          error: error.message,
          stack: error.stack,
          failedAt: new Date().toISOString(),
        });
        log.error('Phase job moved to DLQ', error, { jobId: job.id, phaseNumber: job.data.phaseNumber });
      } catch (dlqErr) {
        log.error('Failed to move phase job to DLQ', dlqErr instanceof Error ? dlqErr : new Error(String(dlqErr)), { jobId: job.id });
      }
    } else {
      log.warn('Phase job failed, will retry', {
        jobId: job?.id,
        phaseNumber: job?.data.phaseNumber,
        attempt: job?.attemptsMade,
        error: error.message,
      });
    }
  });

  return worker;
}

/**
 * Stop the phase worker gracefully.
 * Waits up to SHUTDOWN_TIMEOUT_MS for in-flight jobs to complete.
 */
export async function stopPhaseWorker(): Promise<void> {
  if (!worker) return;
  const current = worker;
  worker = null;
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS)
  );
  const closed = current.close().then(() => "closed" as const);
  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    log.error("Phase worker shutdown timeout, forcing close");
    await current.close(true);
  }
}
