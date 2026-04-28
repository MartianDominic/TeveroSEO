/**
 * BullMQ Queue for voice analysis jobs.
 * Phase 37: Brand Voice Management
 */

import { Queue, type JobsOptions } from "bullmq";
import { getSharedBullMQConnection, redis } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";
import type { VoiceAnalysisJobData, VoiceAnalysisDLQJobData } from "@/server/features/voice/types";

const log = createLogger({ module: "voiceAnalysisQueue" });

export const VOICE_ANALYSIS_QUEUE_NAME = "voice-analysis" as const;

/**
 * Default job options for voice analysis.
 * Job timeout is controlled via Worker lockDuration (set to 600s in voice-analysis-worker.ts).
 */
const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 15_000, // 15s, 30s, 60s
  },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
};

export const voiceAnalysisQueue = new Queue<VoiceAnalysisJobData | VoiceAnalysisDLQJobData>(
  VOICE_ANALYSIS_QUEUE_NAME,
  {
    connection: getSharedBullMQConnection("queue:voice-analysis"),
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  },
);

/**
 * Queue a voice analysis job for a client.
 * Rate limited: max 1 concurrent analysis job per client.
 * Uses Redis SETNX for atomic lock to prevent race conditions.
 *
 * @param clientId - Client ID
 * @param profileId - Voice profile ID
 * @param urls - URLs to analyze (5-10 pages recommended)
 * @returns Job ID
 */
export async function queueVoiceAnalysis(
  clientId: string,
  profileId: string,
  urls: string[],
): Promise<string> {
  // T-37-05: Rate limit - max 1 concurrent job per client
  // Use Redis SETNX for atomic check to prevent race conditions
  const lockKey = `voice-analysis:lock:${clientId}`;
  const acquired = await redis.set(lockKey, "1", "EX", 300, "NX");

  if (!acquired) {
    log.warn("Voice analysis already in progress for client", { clientId });
    throw new Error(`Voice analysis already in progress for client ${clientId}`);
  }

  try {
    const job = await voiceAnalysisQueue.add(
      "analyze-voice",
      { clientId, profileId, urls },
      {
        jobId: `voice-${clientId}-${Date.now()}`,
      },
    );

    log.info("Voice analysis job queued", {
      clientId,
      profileId,
      urlCount: urls.length,
      jobId: job.id,
    });

    return job.id!;
  } catch (err) {
    // Release lock if job creation fails
    await redis.del(lockKey);
    throw err;
  }
}

/**
 * Release the voice analysis lock for a client.
 * Call this when job completes or fails after max retries.
 */
export async function releaseVoiceAnalysisLock(clientId: string): Promise<void> {
  const lockKey = `voice-analysis:lock:${clientId}`;
  await redis.del(lockKey);
  log.info("Voice analysis lock released", { clientId });
}
