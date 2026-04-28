/**
 * Sandboxed BullMQ processor for voice analysis jobs.
 * Phase 37-05: Refactored to use VoiceAnalysisService
 *
 * Runs in a child process to isolate Claude API calls from main event loop.
 * Delegates to VoiceAnalysisService for all scraping, analysis, and persistence.
 * Validates job data with Zod to prevent injection attacks.
 */
import type { Job } from "bullmq";
import { z } from "zod";
import type { VoiceAnalysisJobData } from "@/server/features/voice/types";
import { voiceAnalysisService } from "@/server/features/voice/services/VoiceAnalysisService";
import { createLogger } from "@/server/lib/logger";

/**
 * Zod schema for voice analysis job data validation.
 * Limits URL array size to prevent memory exhaustion attacks.
 */
const VoiceAnalysisJobDataSchema = z.object({
  clientId: z.string().uuid(),
  profileId: z.string().uuid(),
  urls: z.array(z.string().url()).min(1).max(100, "Maximum 100 URLs per analysis job"),
  progress: z.object({
    completedUrls: z.number().int().min(0),
    totalUrls: z.number().int().min(0),
  }).optional(),
});

/**
 * Validate job data and throw descriptive error if invalid.
 */
function validateVoiceAnalysisJobData(data: unknown): z.infer<typeof VoiceAnalysisJobDataSchema> {
  const result = VoiceAnalysisJobDataSchema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues.map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`).join("; ");
    throw new Error(`Invalid voice analysis job data: ${errors}`);
  }
  return result.data;
}

/**
 * Main processor function - exported as default for BullMQ sandboxed worker.
 * Validates job data before processing to prevent injection attacks.
 */
export default async function processVoiceAnalysisJob(
  job: Job<VoiceAnalysisJobData>,
): Promise<void> {
  // Validate job data before processing
  const validatedData = validateVoiceAnalysisJobData(job.data);
  const { clientId, profileId, urls } = validatedData;

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
