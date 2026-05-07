/**
 * GscFullSyncService
 * Phase 96-01 Task 3: Full GSC sync orchestration
 *
 * Coordinates full GSC data extraction across all dimension combinations.
 * Tracks quota, updates site sync timestamps, and aggregates metrics.
 */

import type { GscPaginationService } from "./GscPaginationService";
import type { QueryAnalyticsRepository } from "../repositories/QueryAnalyticsRepository";
import type { GscBridgeService } from "@/server/services/GscBridgeService";
import type { IORedis } from "@/server/lib/redis";
import { DIMENSION_COMBINATIONS, type DimensionCombination } from "../types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "gsc-full-sync-service" });

/**
 * Sync summary returned after full site sync.
 */
export interface SyncSummary {
  siteId: string;
  rowsInserted: number;
  dimensionCounts: Record<string, number>;
  durationMs: number;
}

/**
 * GscFullSyncService - Orchestrates full GSC data extraction.
 */
export class GscFullSyncService {
  constructor(
    private paginationService: GscPaginationService,
    private repository: QueryAnalyticsRepository,
    private gscBridge: GscBridgeService,
    private redis: IORedis
  ) {}

  /**
   * Perform full GSC sync for a site.
   *
   * Workflow:
   * 1. Check GSC credentials
   * 2. Skip if no credentials
   * 3. For each dimension combination:
   *    - Paginate through GSC API
   *    - Insert batches into database
   *    - Track row counts
   * 4. Update Redis quota counter
   * 5. Return sync summary
   *
   * @param siteId - Site connection ID
   * @param siteUrl - Site URL for GSC query
   * @returns Sync summary with metrics
   */
  async fullSyncSite(siteId: string, siteUrl: string): Promise<SyncSummary> {
    const startTime = Date.now();

    // Check GSC credentials
    const credStatus = await this.gscBridge.getClientGscCredentials(siteId);
    if (!credStatus.hasCredentials) {
      log.warn("Site has no GSC credentials, skipping sync", { siteId });
      return {
        siteId,
        rowsInserted: 0,
        dimensionCounts: {},
        durationMs: Date.now() - startTime,
      };
    }

    // Calculate yesterday's date (GSC data latency: 2-3 days)
    const queryDate = this.getYesterday();
    const dateStr = queryDate.toISOString().split("T")[0];

    let totalRowsInserted = 0;
    const dimensionCounts: Record<string, number> = {};

    // Iterate all dimension combinations
    for (const dimensions of DIMENSION_COMBINATIONS) {
      const dimKey = dimensions.join("+");
      let dimRowCount = 0;

      try {
        // Create AsyncGenerator for this dimension combo
        const generator = this.paginationService.paginateGscQuery({
          siteId,
          siteUrl,
          startDate: dateStr,
          endDate: dateStr,
          dimensions: dimensions as string[],
          rowLimit: 25000,
        });

        // Process each batch
        for await (const batch of generator) {
          const rowsAffected = await this.repository.insertBatch(siteId, batch, queryDate);
          dimRowCount += rowsAffected;
          totalRowsInserted += rowsAffected;

          log.debug("Batch inserted", {
            siteId,
            dimensions: dimKey,
            batchSize: batch.length,
            totalRows: dimRowCount,
          });
        }

        dimensionCounts[dimKey] = dimRowCount;

        log.info("Dimension sync complete", {
          siteId,
          dimensions: dimKey,
          rows: dimRowCount,
        });
      } catch (error) {
        log.error(
          "Dimension sync failed",
          error instanceof Error ? error : new Error(String(error)),
          { siteId, dimensions: dimKey }
        );
        // Continue with other dimensions
      }
    }

    // Update Redis quota counter
    await this.incrementQuotaCounter(siteId, dateStr);

    const durationMs = Date.now() - startTime;

    log.info("Full site sync complete", {
      siteId,
      totalRows: totalRowsInserted,
      durationMs,
      dimensionCounts,
    });

    return {
      siteId,
      rowsInserted: totalRowsInserted,
      dimensionCounts,
      durationMs,
    };
  }

  /**
   * Get yesterday's date for GSC query.
   */
  private getYesterday(): Date {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);
    return yesterday;
  }

  /**
   * Increment Redis quota counter for site/date.
   */
  private async incrementQuotaCounter(siteId: string, dateStr: string): Promise<void> {
    try {
      const key = `gsc:quota:${siteId}:${dateStr}`;
      await this.redis.incr(key);
      await this.redis.expire(key, 86400 * 7); // 7 days TTL
    } catch (error) {
      log.debug("Quota counter update failed (non-critical)", { siteId, dateStr });
    }
  }
}

/**
 * Factory function to create GscFullSyncService instance.
 */
export function createGscFullSyncService(
  paginationService: GscPaginationService,
  repository: QueryAnalyticsRepository,
  gscBridge: GscBridgeService,
  redis: IORedis
): GscFullSyncService {
  return new GscFullSyncService(paginationService, repository, gscBridge, redis);
}

/**
 * Default singleton instance (lazy-initialized).
 */
let defaultInstance: GscFullSyncService | null = null;

/**
 * Get the default GscFullSyncService singleton.
 *
 * @param deps - Service dependencies (required for first call)
 * @returns GscFullSyncService instance
 */
export function getGscFullSyncService(deps?: {
  paginationService: GscPaginationService;
  repository: QueryAnalyticsRepository;
  gscBridge: GscBridgeService;
  redis: IORedis;
}): GscFullSyncService {
  if (!defaultInstance) {
    if (!deps) {
      throw new Error("GscFullSyncService: dependencies required for initialization");
    }
    defaultInstance = new GscFullSyncService(
      deps.paginationService,
      deps.repository,
      deps.gscBridge,
      deps.redis
    );
  }
  return defaultInstance;
}
