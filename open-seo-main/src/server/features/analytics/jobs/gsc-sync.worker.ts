/**
 * GSC Sync Worker
 * Phase 96-01 Task 4: BullMQ worker processing GSC sync jobs
 *
 * QUEUE-02 FIX: lockDuration set to 600000ms (10 minutes) for long-running GSC API calls
 * DATA-05 FIX: Publishes cache invalidation events after sync completes
 * BMQ-003 FIX: Circuit breaker integration for GSC API resilience
 *
 * Worker configuration:
 * - lockDuration: 600000 (10 min) - prevents job stalling during API pagination
 * - Concurrency: 1 (sequential site processing)
 * - Rate limiter: 50 req/min global
 * - Progress updates per site
 * - Graceful shutdown with 30s timeout
 * - Cache invalidation on sync completion
 * - Circuit breaker for GSC API calls
 */

import { Worker, type Job } from "bullmq";
import { getSharedBullMQConnection } from "@/server/lib/redis";
import type { GscSyncJobData, GscSyncJobResult } from "./gsc-sync.job";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db";
import { platformConnections } from "@/db/platform-connection-schema";
import { siteConnections } from "@/db/connection-schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { invalidateAfterGscSync } from "@/server/cache";
import { getAnalyticsEventBus } from "../events/analytics-event-bus";
import { gscApiBreaker, CircuitOpenError } from "@/server/lib/circuit-breaker";

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
          // BMQ-003 FIX: Check circuit breaker before GSC API calls
          if (await gscApiBreaker.isOpen()) {
            const errorMsg = `GSC API circuit breaker open - skipping site ${site.id}`;
            errors.push(errorMsg);
            log.warn(errorMsg, { siteId: site.id });
            processed++;
            await job.updateProgress((processed / sites.length) * 100);
            continue;
          }

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

          // BMQ-003 FIX: Wrap GSC API call with circuit breaker
          const result = await gscApiBreaker.execute(async () => {
            return syncService.fullSyncSite(site.id, site.siteUrl);
          });
          totalRows += result.rowsInserted;

          log.info("Site sync complete", {
            siteId: site.id,
            rows: result.rowsInserted,
            durationMs: result.durationMs,
          });

          // Emit sync completed event asynchronously (non-blocking)
          const syncDate = new Date().toISOString().split("T")[0];
          setImmediate(() => {
            try {
              const eventBus = getAnalyticsEventBus();
              eventBus.emit('analytics:sync-completed', {
                siteId: site.id,
                recordCount: result.rowsInserted,
                startDate: syncDate,
                endDate: syncDate,
                timestamp: new Date(),
              });
            } catch (eventError) {
              log.warn("Failed to emit analytics:sync-completed event", {
                siteId: site.id,
                error: eventError instanceof Error ? eventError.message : String(eventError),
              });
            }
          });

          // DATA-05 FIX: Publish cache invalidation after successful sync
          // Use clientId as workspace identifier for cache invalidation
          try {
            const siteConnection = await db
              .select({ clientId: siteConnections.clientId })
              .from(siteConnections)
              .where(eq(siteConnections.id, site.id))
              .limit(1);

            if (siteConnection.length > 0 && siteConnection[0].clientId) {
              // Use clientId as workspaceId for cache key consistency
              await invalidateAfterGscSync(siteConnection[0].clientId, site.id);
              log.debug("Cache invalidated after sync", {
                siteId: site.id,
                clientId: siteConnection[0].clientId,
              });
            }
          } catch (cacheError) {
            // Non-fatal: cache will expire naturally via TTL
            log.warn("Failed to invalidate cache after sync", {
              siteId: site.id,
              error: cacheError instanceof Error ? cacheError.message : String(cacheError),
            });
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errors.push(`${site.id}: ${errorMsg}`);

          // BMQ-003 FIX: Log circuit breaker errors differently
          if (error instanceof CircuitOpenError) {
            log.warn("Site sync skipped - circuit breaker open", {
              siteId: site.id,
              circuitName: error.circuitName,
            });
          } else {
            log.error("Site sync failed", error instanceof Error ? error : new Error(errorMsg), {
              siteId: site.id,
            });
          }
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
    lockDuration: 600_000, // QUEUE-02 FIX: 10 min for long-running GSC API calls
    maxStalledCount: 2,
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
 * QUEUE-H05 FIX: Graceful shutdown with timeout
 */
export async function stopGscSyncWorker(): Promise<void> {
  const SHUTDOWN_TIMEOUT_MS = 30_000;

  const timeout = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), SHUTDOWN_TIMEOUT_MS)
  );
  const closed = gscSyncWorker.close().then(() => "closed" as const);

  const result = await Promise.race([closed, timeout]);
  if (result === "timeout") {
    log.error("GSC sync worker graceful shutdown timeout, forcing close", undefined, {
      timeoutMs: SHUTDOWN_TIMEOUT_MS,
    });
    await gscSyncWorker.close(true);
  }

  log.info("GSC sync worker stopped");
}

/**
 * Get all active sites with GSC credentials.
 * Queries platformConnections for active Google Search Console connections
 * that have valid OAuth tokens.
 */
async function getActiveSitesWithGsc(): Promise<Array<{ id: string; siteUrl: string }>> {
  try {
    const connections = await db
      .select({
        id: platformConnections.id,
        siteUrl: platformConnections.platformSiteUrl,
      })
      .from(platformConnections)
      .where(
        and(
          eq(platformConnections.platform, "google_search_console"),
          eq(platformConnections.status, "active"),
          isNotNull(platformConnections.accessTokenEncrypted)
        )
      );

    // Filter out any connections without a siteUrl (shouldn't happen, but be defensive)
    const validConnections = connections.filter(
      (conn): conn is { id: string; siteUrl: string } => conn.siteUrl !== null
    );

    log.info("Found active GSC connections", { count: validConnections.length });

    return validConnections;
  } catch (error) {
    log.error(
      "Failed to query GSC connections",
      error instanceof Error ? error : new Error(String(error))
    );
    return [];
  }
}
