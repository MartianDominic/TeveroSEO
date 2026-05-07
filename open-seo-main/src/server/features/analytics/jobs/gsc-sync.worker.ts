/**
 * GSC Sync Worker
 * Phase 96-01 Task 4: BullMQ worker processing GSC sync jobs
 *
 * Worker configuration:
 * - Concurrency: 1 (sequential site processing)
 * - Rate limiter: 50 req/min global
 * - Progress updates per site
 */

import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import type { GscSyncJobData, GscSyncJobResult } from "./gsc-sync.job";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "gsc-sync-worker" });

/**
 * GSC sync worker - processes full and incremental sync jobs.
 */
export const gscSyncWorker = new Worker<GscSyncJobData, GscSyncJobResult>(
  "gsc-sync",
  async (job: Job<GscSyncJobData, GscSyncJobResult>) => {
    const startTime = Date.now();
    const { syncType, siteId } = job.data;

    log.info("Starting GSC sync job", { jobId: job.id, syncType, siteId });

    if (syncType === "full") {
      // Get sites to sync
      const sites = siteId ? [{ id: siteId, siteUrl: "" }] : await getActiveSitesWithGsc();

      let processed = 0;
      let totalRows = 0;
      const errors: string[] = [];

      for (const site of sites) {
        try {
          // Get sync service (lazy-loaded to avoid circular dependencies)
          const { getGscFullSyncService } = await import("../services/GscFullSyncService");
          const { getGscPaginationService } = await import("../services/GscPaginationService");
          const { getQueryAnalyticsRepository } = await import(
            "../repositories/QueryAnalyticsRepository"
          );
          const { getGscBridge } = await import("@/server/services/GscBridgeService");
          const { redis } = await import("@/server/lib/redis");

          const syncService = getGscFullSyncService({
            paginationService: getGscPaginationService(getGscBridge()),
            repository: getQueryAnalyticsRepository(),
            gscBridge: getGscBridge(),
            redis,
          });

          const result = await syncService.fullSyncSite(site.id, site.siteUrl);
          totalRows += result.rowsInserted;

          log.info("Site sync complete", {
            siteId: site.id,
            rows: result.rowsInserted,
            durationMs: result.durationMs,
          });
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`${site.id}: ${errorMsg}`);
          log.error("Site sync failed", error instanceof Error ? error : new Error(errorMsg), {
            siteId: site.id,
          });
        }

        processed++;
        await job.updateProgress((processed / sites.length) * 100);
      }

      const durationMs = Date.now() - startTime;

      return {
        sitesProcessed: processed,
        totalRowsInserted: totalRows,
        errors,
        durationMs,
      };
    }

    // Incremental sync not implemented yet
    return {
      sitesProcessed: 0,
      totalRowsInserted: 0,
      errors: ["Incremental sync not implemented"],
      durationMs: Date.now() - startTime,
    };
  },
  {
    connection: getSharedBullMQConnection("worker:gsc-sync"),
    concurrency: 1, // Single worker for sequential processing
    limiter: {
      max: 50, // 50 requests
      duration: 60000, // per minute (60,000 ms)
    },
  }
);

/**
 * Start the GSC sync worker and attach event handlers.
 */
export function startGscSyncWorker(): void {
  gscSyncWorker.on("completed", (job, result) => {
    log.info("GSC sync completed", {
      jobId: job.id,
      sitesProcessed: result.sitesProcessed,
      totalRows: result.totalRowsInserted,
      durationMs: result.durationMs,
      errorCount: result.errors.length,
    });
  });

  gscSyncWorker.on("failed", (job, error) => {
    log.error("GSC sync failed", error, {
      jobId: job?.id,
      data: job?.data,
    });
  });

  gscSyncWorker.on("error", (error) => {
    log.error("GSC sync worker error", error);
  });

  log.info("GSC sync worker started");
}

/**
 * Stop the GSC sync worker gracefully.
 */
export async function stopGscSyncWorker(): Promise<void> {
  await gscSyncWorker.close();
  log.info("GSC sync worker stopped");
}

/**
 * Get all active sites with GSC credentials.
 * Stub implementation - will be replaced with actual query.
 */
async function getActiveSitesWithGsc(): Promise<Array<{ id: string; siteUrl: string }>> {
  // TODO: Query siteConnections table for sites with GSC platform
  // and hasCredentials = true
  return [];
}
