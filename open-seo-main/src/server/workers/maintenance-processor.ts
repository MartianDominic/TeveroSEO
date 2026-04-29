/**
 * Sandboxed BullMQ processor for maintenance jobs.
 *
 * Handles:
 * - cache-cleanup: Clean up expired cache files from filesystem
 */
import type { Job } from "bullmq";
import type { CacheCleanupJobData } from "@/server/queues/maintenanceQueue";
import { createLogger } from "@/server/lib/logger";
import { cleanupExpiredCacheFiles, getCacheFileCount } from "@/server/lib/r2-cache";

/**
 * Main processor function - exported as default for BullMQ sandboxed worker.
 */
export default async function processMaintenanceJob(
  job: Job<CacheCleanupJobData>,
): Promise<void> {
  const logger = createLogger({
    module: "maintenance-processor",
    jobId: job.id,
    jobName: job.name,
  });

  logger.info("Starting maintenance job", { jobName: job.name });

  try {
    if (job.name === "cache-cleanup") {
      const beforeCount = await getCacheFileCount();
      const cleaned = await cleanupExpiredCacheFiles();
      const afterCount = await getCacheFileCount();

      logger.info("Cache cleanup completed", {
        cleaned,
        beforeCount,
        afterCount,
      });
    } else {
      logger.warn("Unknown maintenance job type", { jobName: job.name });
    }
  } catch (error) {
    logger.error("Maintenance job failed", error as Error);
    throw error; // Re-throw for BullMQ retry
  }
}
