/**
 * Sandboxed BullMQ processor for voice analysis jobs.
 * Phase 37-05: Refactored to use VoiceAnalysisService
 *
 * Runs in a child process to isolate Claude API calls from main event loop.
 * Delegates to VoiceAnalysisService for all scraping, analysis, and persistence.
 */
import type { Job } from "bullmq";
import type { VoiceAnalysisJobData } from "@/server/features/voice/types";
import { voiceAnalysisService } from "@/server/features/voice/services/VoiceAnalysisService";
import { createLogger } from "@/server/lib/logger";

/**
 * Main processor function - exported as default for BullMQ sandboxed worker.
 */
export default async function processVoiceAnalysisJob(
  job: Job<VoiceAnalysisJobData>,
): Promise<void> {
  const { clientId, profileId, urls } = job.data;
  const logger = createLogger({
    module: "voice-analysis-processor",
    jobId: job.id,
    clientId,
  });

  logger.info("Starting voice analysis job", {
    profileId,
    urlCount: urls.length,
  });

  try {
    // Delegate to VoiceAnalysisService with progress callback
    const result = await voiceAnalysisService.analyzePages(
      profileId,
      urls,
      async (completed, total) => {
        // Update BullMQ job progress
        await job.updateData({
          ...job.data,
          progress: { completedUrls: completed, totalUrls: total },
        });
        await job.updateProgress((completed / total) * 100);
      }
    );

    logger.info("Voice analysis job completed", {
      profileId,
      pagesAnalyzed: result.pagesAnalyzed,
      avgConfidence: result.avgConfidence,
    });
  } catch (error) {
    logger.error(
      "Voice analysis job failed",
      error instanceof Error ? error : new Error(String(error)),
      { profileId, urlCount: urls.length }
    );
    throw error; // Re-throw to mark job as failed
  }
}
