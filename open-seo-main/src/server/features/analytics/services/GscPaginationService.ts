/**
 * GscPaginationService
 * Phase 96-01 Task 2: AsyncGenerator pagination for 25K row extraction
 *
 * Extracts all GSC rows using pagination (25K rows per request, up to 50K daily limit).
 * Transforms dimension keys to structured GscQueryRow format.
 */

import type { GscBridgeService, GscRankingData } from "@/server/services/GscBridgeService";
import type { GscQueryRow, PaginationOptions } from "../types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "gsc-pagination-service" });

// GSC daily API limit per site
const DAILY_LIMIT = 50000;

/**
 * GscPaginationService - AsyncGenerator-based pagination for GSC data.
 */
export class GscPaginationService {
  constructor(private gscBridge: GscBridgeService) {}

  /**
   * Paginate through GSC query results until exhausted.
   *
   * Yields batches of rows from GSC API, stopping when:
   * - Empty batch received
   * - Batch size < rowLimit (partial page, no more data)
   * - Total rows >= 50,000 (GSC daily limit)
   *
   * @param options - Pagination parameters
   * @yields Batches of GscQueryRow
   */
  async *paginateGscQuery(options: PaginationOptions): AsyncGenerator<GscQueryRow[], void, unknown> {
    const { siteId, siteUrl, startDate, endDate, dimensions, rowLimit = 25000 } = options;

    let startRow = 0;
    let totalRows = 0;

    try {
      while (totalRows < DAILY_LIMIT) {
        // Fetch batch from GSC API
        const rawBatch = await this.gscBridge.fetchRankings(siteId, {
          siteUrl,
          startDate,
          endDate,
          dimensions,
          rowLimit,
          startRow,
        });

        // Empty response - no more data
        if (rawBatch.length === 0) {
          log.debug("Pagination complete: empty batch", { siteId, startRow });
          break;
        }

        // Transform raw GSC response to GscQueryRow format
        const batch = this.transformBatch(rawBatch, dimensions ?? ["query"]);

        yield batch;

        totalRows += batch.length;
        startRow += batch.length;

        // Partial page - less than rowLimit means no more data
        if (batch.length < rowLimit) {
          log.debug("Pagination complete: partial page", {
            siteId,
            batchSize: batch.length,
            totalRows,
          });
          break;
        }

        // Hit daily limit
        if (totalRows >= DAILY_LIMIT) {
          log.info("Pagination stopped: daily limit reached", { siteId, totalRows });
          break;
        }
      }
    } catch (error) {
      // Graceful degradation: log error and stop iteration
      log.error(
        "GSC pagination failed",
        error instanceof Error ? error : new Error(String(error)),
        { siteId, startRow, totalRows }
      );
      // Generator ends (yields nothing more)
    }
  }

  /**
   * Transform raw GSC API rows to GscQueryRow format.
   * Maps dimension keys to appropriate fields based on dimensions array.
   *
   * @param rawBatch - Raw GSC API response rows
   * @param dimensions - Dimension names (e.g., ["query", "page"])
   * @returns Transformed GscQueryRow array
   */
  private transformBatch(rawBatch: GscRankingData[], dimensions: string[]): GscQueryRow[] {
    return rawBatch.map((row) => {
      const queryRow: GscQueryRow = {
        query: row.keys?.[0] ?? row.query,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      };

      // Map additional dimensions from keys array
      if (row.keys && row.keys.length > 1) {
        dimensions.forEach((dim, index) => {
          if (index === 0) return; // Skip first dimension (always query)

          const value = row.keys![index];
          if (!value) return;

          switch (dim) {
            case "page":
              queryRow.pageUrl = value;
              break;
            case "country":
              queryRow.country = value;
              break;
            case "device":
              queryRow.device = value;
              break;
            case "searchAppearance":
              queryRow.searchAppearance = value;
              break;
          }
        });
      }

      return queryRow;
    });
  }
}

/**
 * Factory function to create GscPaginationService instance.
 *
 * @param gscBridge - GscBridgeService instance
 * @returns New GscPaginationService instance
 */
export function createGscPaginationService(gscBridge: GscBridgeService): GscPaginationService {
  return new GscPaginationService(gscBridge);
}

/**
 * Default singleton instance (lazy-initialized).
 */
let defaultInstance: GscPaginationService | null = null;

/**
 * Get the default GscPaginationService singleton.
 *
 * @param gscBridge - GscBridgeService instance (required for first call)
 * @returns GscPaginationService instance
 */
export function getGscPaginationService(gscBridge?: GscBridgeService): GscPaginationService {
  if (!defaultInstance) {
    if (!gscBridge) {
      throw new Error("GscPaginationService: gscBridge required for initialization");
    }
    defaultInstance = new GscPaginationService(gscBridge);
  }
  return defaultInstance;
}
