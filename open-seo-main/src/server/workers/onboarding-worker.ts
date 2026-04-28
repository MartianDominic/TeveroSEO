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
import { getDLQQueue, type DLQJobData } from "@/server/queues/dlq";
import type {
  OnboardingJobData,
  OnboardingJobResult,
} from "@/server/queues/onboardingQueue";

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
    log.error("Onboarding job failed", error, {
      jobId: job?.id,
      proposalId: job?.data.proposalId,
      attempts: job?.attemptsMade,
    });

    // Move to DLQ after max retries exhausted (BQ-07 pattern)
    if (job && job.attemptsMade >= MAX_ATTEMPTS && !job.name.startsWith("dlq:")) {
      const dlqPayload: DLQJobData = {
        originalQueue: QUEUE_NAME,
        jobId: job.id,
        jobData: job.data,
        error: error?.message || "Unknown error",
        stack: error?.stack,
        failedAt: new Date().toISOString(),
      };
      try {
        const dlqQueue = getDLQQueue();
        await dlqQueue.add(`dlq:onboarding:${job.id}`, dlqPayload, {
          removeOnComplete: { age: 7 * 24 * 3600 }, // 7 days
          removeOnFail: false,
        });
        log.info("Moved failed onboarding job to DLQ", {
          jobId: job.id,
          proposalId: job.data.proposalId,
        });
      } catch (dlqErr) {
        log.error(
          "Failed to enqueue DLQ job",
          dlqErr instanceof Error ? dlqErr : new Error(String(dlqErr)),
          { jobId: job.id }
        );
      }
    }
  });

  worker.on("error", (error) => {
    log.error("Onboarding worker error", error);
  });

  log.info("Onboarding worker started");

  return worker;
}

/**
 * Stop the onboarding worker gracefully.
 */
export async function stopOnboardingWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    log.info("Onboarding worker stopped");
  }
}
