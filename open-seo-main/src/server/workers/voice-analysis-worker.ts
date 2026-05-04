/**
 * BullMQ Worker for voice analysis jobs.
 * Phase 37: Brand Voice Management
 */
import { Worker, type Job } from "bullmq";
import { fileURLToPath } from "node:url";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import {
  VOICE_ANALYSIS_QUEUE_NAME,
  releaseVoiceAnalysisLock,
} from "@/server/queues/voiceAnalysisQueue";
import type { VoiceAnalysisJobData } from "@/server/features/voice/types";
import { getDLQQueue, type DLQJobData } from "@/server/queues/dlq";

const workerLogger = createLogger({ module: "voice-analysis-worker" });

const LOCK_DURATION_MS = 600_000; // 10 minutes - AI calls take time, matches queue timeout
const MAX_STALLED_COUNT = 2;
const SHUTDOWN_TIMEOUT_MS = 30_000;

// URL-based resolution for sandboxed processor
const PROCESSOR_PATH = fileURLToPath(
  new URL("./voice-analysis-processor.js", import.meta.url),
);

let worker: Worker<VoiceAnalysisJobData> | null = null;

export async function startVoiceAnalysisWorker(): Promise<
  Worker<VoiceAnalysisJobData>
> {
  if (worker) return worker;

  worker = new Worker<VoiceAnalysisJobData>(
    VOICE_ANALYSIS_QUEUE_NAME,
    PROCESSOR_PATH,
    {
      connection: getSharedBullMQConnection("worker:voice-analysis"),
      lockDuration: LOCK_DURATION_MS,
      maxStalledCount: MAX_STALLED_COUNT,
      concurrency: 3, // Rate limit friendly for Claude API
    },
  );

  worker.on("ready", () => {
    workerLogger.info("Worker ready", { queue: VOICE_ANALYSIS_QUEUE_NAME });
  });

  worker.on("error", (err) => {
    workerLogger.error("Worker error", err as Error);
  });

  worker.on(
    "failed",
    async (
      job: Job<VoiceAnalysisJobData> | undefined,
      err: Error,
    ) => {
      if (!job) {
        workerLogger.error("Job failed with no job context", err);
        return;
      }

      const maxAttempts = job.opts.attempts ?? 1;
      const clientId = job.data.clientId;
      const jobLogger = createLogger({
        module: "voice-analysis-worker",
        jobId: job.id,
        clientId,
      });
      jobLogger.error("Job failed", err, {
        attempt: job.attemptsMade,
        maxAttempts,
      });

      // Always release the lock on failure (not just after max retries)
      // This allows the client to retry immediately if needed
      if (clientId) {
        try {
          await releaseVoiceAnalysisLock(clientId);
          jobLogger.debug("Lock released after failure", { attempt: job.attemptsMade });
        } catch (lockErr) {
          jobLogger.error("Failed to release lock after failure", lockErr as Error);
        }
      }

      // H-BULL-01 FIX: Use centralized DLQ instead of same-queue dlq: prefix
      if (job.attemptsMade >= maxAttempts) {
        try {
          const dlqQueue = getDLQQueue();
          const dlqData: DLQJobData = {
            originalQueue: VOICE_ANALYSIS_QUEUE_NAME,
            jobId: job.id,
            jobData: job.data,
            error: err.message,
            stack: err.stack,
            failedAt: new Date().toISOString(),
          };
          await dlqQueue.add(`dlq:${VOICE_ANALYSIS_QUEUE_NAME}:${job.id}`, dlqData);
          jobLogger.info("Job moved to centralized DLQ", { attemptsMade: job.attemptsMade });
        } catch (dlqErr) {
          jobLogger.error("Failed to move job to DLQ", dlqErr as Error);
        }
      }
    },
  );

  worker.on("completed", async (job) => {
    const clientId = job.data.clientId;
    const jobLogger = createLogger({
      module: "voice-analysis-worker",
      jobId: job.id,
      clientId,
    });

    // Release the lock on successful completion
    if (clientId) {
      await releaseVoiceAnalysisLock(clientId);
    }

    jobLogger.info("Job completed", {
      durationMs:
        job.finishedOn && job.processedOn
          ? job.finishedOn - job.processedOn
          : undefined,
    });
  });

  worker.on("progress", (job, progress) => {
    workerLogger.debug("Job progress", {
      jobId: job.id,
      progress: typeof progress === "number" ? `${progress}%` : progress,
    });
  });

  worker.on("stalled", (jobId) => {
    workerLogger.warn("Job stalled", { jobId, queue: VOICE_ANALYSIS_QUEUE_NAME });
  });

  return worker;
}

export async function stopVoiceAnalysisWorker(): Promise<void> {
  if (!worker) return;
  const current = worker;
  worker = null;

  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS),
  );
  const closed = current.close().then(() => "closed" as const);
  const result = await Promise.race([closed, timeout]);

  if (result === "timeout") {
    workerLogger.error("Graceful shutdown timeout exceeded, forcing close", undefined, {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    await current.close(true);
  }
}
