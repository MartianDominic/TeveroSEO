/**
 * Onboarding Queue
 * Handles async client onboarding after Stripe payment completion.
 *
 * This ensures webhook handlers return immediately while onboarding
 * processes in the background with proper retry handling.
 */
import { Queue } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "OnboardingQueue" });

const QUEUE_NAME = "onboarding";

export interface OnboardingJobData {
  proposalId: string;
  customerId?: string;
  sessionId: string;
}

export interface OnboardingJobResult {
  clientId: string;
  projectId: string;
  gscInviteSent: boolean;
  kickoffEmailSent: boolean;
  welcomeEmailSent: boolean;
  agencyNotified: boolean;
}

// Lazy-initialized queue
let onboardingQueue: Queue<OnboardingJobData, OnboardingJobResult> | null = null;

/**
 * Get or create the onboarding queue singleton.
 */
export function getOnboardingQueue(): Queue<OnboardingJobData, OnboardingJobResult> {
  if (!onboardingQueue) {
    const connection = getSharedBullMQConnection("queue:onboarding");

    onboardingQueue = new Queue<OnboardingJobData, OnboardingJobResult>(
      QUEUE_NAME,
      {
        connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000, // 5s, 10s, 20s
          },
          removeOnComplete: {
            count: 100,
            age: 7 * 24 * 60 * 60, // 7 days
          },
          removeOnFail: {
            count: 500,
            age: 30 * 24 * 60 * 60, // 30 days
          },
        },
      }
    );

    log.info("Onboarding queue initialized");
  }

  return onboardingQueue;
}

/**
 * Enqueue an onboarding job for a completed payment.
 *
 * @param data - Onboarding job data
 * @returns Job ID
 */
export async function enqueueOnboarding(
  data: OnboardingJobData
): Promise<string> {
  const queue = getOnboardingQueue();

  const job = await queue.add("trigger-onboarding", data, {
    // Use proposalId as job ID for idempotency
    jobId: `onboard-${data.proposalId}`,
  });

  log.info("Onboarding job enqueued", {
    jobId: job.id,
    proposalId: data.proposalId,
  });

  return job.id ?? data.proposalId;
}

/**
 * Close the onboarding queue connection.
 */
export async function closeOnboardingQueue(): Promise<void> {
  if (onboardingQueue) {
    await onboardingQueue.close();
    onboardingQueue = null;
    log.info("Onboarding queue closed");
  }
}
