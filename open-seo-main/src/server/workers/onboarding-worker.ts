/**
 * Onboarding Worker
 * Processes client onboarding jobs asynchronously.
 *
 * This runs the full onboarding flow:
 * - Create client from prospect
 * - Create project with imported keywords
 * - Send GSC invite, kickoff, and welcome emails
 * - Notify agency via email and Slack
 */
import { Worker, Job } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import { triggerOnboarding } from "@/server/features/proposals/onboarding/onboarding";
import {
  type OnboardingJobData,
  type OnboardingJobResult,
} from "@/server/queues/onboardingQueue";
import { getDLQQueue, type DLQJobData } from "@/server/queues/dlq";

const log = createLogger({ module: "OnboardingWorker" });

const QUEUE_NAME = "onboarding";
const MAX_ATTEMPTS = 3;

// Worker singleton
let worker: Worker<OnboardingJobData, OnboardingJobResult> | null = null;

/**
 * Process an onboarding job.
 */
async function processOnboardingJob(
  job: Job<OnboardingJobData, OnboardingJobResult>
): Promise<OnboardingJobResult> {
  const { proposalId, sessionId } = job.data;

  log.info("Processing onboarding job", {
    jobId: job.id,
    proposalId,
    sessionId,
    attempt: job.attemptsMade + 1,
  });

  try {
    // Run the full onboarding flow
    const result = await triggerOnboarding(proposalId);

    log.info("Onboarding completed successfully", {
      jobId: job.id,
      proposalId,
      clientId: result.clientId,
      projectId: result.projectId,
    });

    return result;
  } catch (error) {
    log.error(
      "Onboarding failed",
      error instanceof Error ? error : new Error(String(error)),
      {
        jobId: job.id,
        proposalId,
        attempt: job.attemptsMade + 1,
      }
    );
    throw error;
  }
}

/**
 * Start the onboarding worker.
 */
export function startOnboardingWorker(): Worker<
  OnboardingJobData,
  OnboardingJobResult
> {
  if (worker) {
    log.warn("Onboarding worker already running");
    return worker;
  }

  const connection = getSharedBullMQConnection("worker:onboarding");

  worker = new Worker<OnboardingJobData, OnboardingJobResult>(
    QUEUE_NAME,
    processOnboardingJob,
    {
      connection,
      concurrency: 2, // Process 2 onboardings at a time
      lockDuration: 120_000, // 2 minutes per job
      maxStalledCount: 2, // Mark job as failed after 2 stalls
    }
  );

  // Event handlers
  worker.on("completed", (job, result) => {
    log.info("Onboarding job completed", {
      jobId: job.id,
      proposalId: job.data.proposalId,
      clientId: result.clientId,
    });
  });

  worker.on("failed", async (job, error) => {
    if (!job) {
      log.error("Onboarding job failed with no job context", error ?? new Error("Unknown error"));
      return;
    }

    const jobLogger = createLogger({
      module: "onboarding-worker",
      jobId: job.id,
    });

    jobLogger.error("Onboarding job failed", error ?? new Error("Unknown error"), {
      proposalId: job.data.proposalId,
      attempt: job.attemptsMade,
      maxAttempts: MAX_ATTEMPTS,
    });

    // H-BULL-01 FIX: Use centralized DLQ instead of same-queue dlq: prefix
    if (job.attemptsMade >= MAX_ATTEMPTS) {
      try {
        const dlqQueue = getDLQQueue();
        const dlqData: DLQJobData = {
          originalQueue: QUEUE_NAME,
          jobId: job.id,
          jobData: job.data,
          error: error?.message || "Unknown error",
          stack: error?.stack,
          failedAt: new Date().toISOString(),
        };
        await dlqQueue.add(`dlq:${QUEUE_NAME}:${job.id}`, dlqData);
        jobLogger.info("Job moved to centralized DLQ", {
          proposalId: job.data.proposalId,
          attemptsMade: job.attemptsMade,
        });
      } catch (dlqErr) {
        jobLogger.error(
          "Failed to move job to DLQ",
          dlqErr instanceof Error ? dlqErr : new Error(String(dlqErr))
        );
      }
    }
  });

  worker.on("error", (error) => {
    log.error("Onboarding worker error", error);
  });

  worker.on("stalled", (jobId) => {
    log.warn("Onboarding job stalled", { jobId, queue: QUEUE_NAME });
  });

  log.info("Onboarding worker started");

  return worker;
}

/**
 * Stop the onboarding worker gracefully with timeout (HIGH-BQ-02 fix).
 */
export async function stopOnboardingWorker(): Promise<void> {
  if (!worker) return;

  const current = worker;
  worker = null;

  const SHUTDOWN_TIMEOUT_MS = 10_000;
  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS),
  );
  const closed = current.close().then(() => "closed" as const);
  const result = await Promise.race([closed, timeout]);

  if (result === "timeout") {
    log.warn("Worker close timed out, forcing close", {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    await current.close(true);
  }

  log.info("Onboarding worker stopped");
}
