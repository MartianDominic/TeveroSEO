/**
 * Sandboxed BullMQ processor for maintenance jobs.
 *
 * Handles:
 * - cache-cleanup: Clean up expired Redis cache entries
 *
 * Note: Previously cleaned up filesystem cache (r2-cache).
 * Now uses Redis-based caching which has built-in TTL expiration.
 * This job is retained for potential future maintenance tasks.
 */
import type { Job } from "bullmq";
import type { CacheCleanupJobData } from "@/server/queues/maintenanceQueue";
import { createLogger } from "@/server/lib/logger";
import { getCacheStats, invalidatePattern } from "@/server/lib/cache/redis-kv-cache";

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
      // Redis handles TTL expiration automatically, but we can log stats
      const stats = await getCacheStats();

      logger.info("Cache stats retrieved", {
        keyCount: stats.keyCount,
        memoryUsageBytes: stats.memoryUsageBytes,
      });

      // Note: Redis automatically evicts expired keys via TTL.
      // This job now serves as a monitoring/stats collection point.
      // If needed, specific cleanup patterns can be added here.
    } else {
      logger.warn("Unknown maintenance job type", { jobName: job.name });
    }
  } catch (error) {
    logger.error("Maintenance job failed", error as Error);
    throw error; // Re-throw for BullMQ retry
  }
}
