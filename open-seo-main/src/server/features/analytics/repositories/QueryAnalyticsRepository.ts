/**
 * QueryAnalyticsRepository
 * Phase 96-01 Task 3: Repository for GSC query analytics CRUD
 *
 * Handles batch inserts with upsert behavior for GSC analytics data.
 */

import { db } from "@/db";
import { seoGscQueryAnalytics } from "@/db/gsc-analytics-schema";
import { eq, and, sql } from "drizzle-orm";
import type { GscQueryRow } from "../types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "query-analytics-repository" });

/**
 * QueryAnalyticsRepository - CRUD operations for seo_gsc_query_analytics table.
 */
export class QueryAnalyticsRepository {
  /**
   * Insert a batch of GSC query rows with upsert behavior.
   *
   * ON CONFLICT: Updates metrics if row already exists for same
   * (site_id, query_time, query, page_url, country, device).
   *
   * @param siteId - Site connection ID
   * @param rows - Array of GSC query data
   * @param queryDate - Date for this batch (query_time)
   * @returns Number of rows affected (inserted + updated)
   */
  async insertBatch(siteId: string, rows: GscQueryRow[], queryDate: Date): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }

    try {
      // Transform GscQueryRow to database insert format
      const values = rows.map((row) => ({
        siteId,
        queryTime: queryDate,
        query: row.query,
        pageUrl: row.pageUrl ?? null,
        country: row.country ?? null,
        device: row.device ?? null,
        searchAppearance: row.searchAppearance ?? null,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }));

      // Batch insert with ON CONFLICT DO UPDATE
      // Conflict on: site_id, query_time, query, page_url, country, device
      const result = await db
        .insert(seoGscQueryAnalytics)
        .values(values)
        .onConflictDoUpdate({
          target: [
            seoGscQueryAnalytics.siteId,
            seoGscQueryAnalytics.queryTime,
            seoGscQueryAnalytics.query,
            seoGscQueryAnalytics.pageUrl,
            seoGscQueryAnalytics.country,
            seoGscQueryAnalytics.device,
          ],
          set: {
            clicks: sql`EXCLUDED.clicks`,
            impressions: sql`EXCLUDED.impressions`,
            ctr: sql`EXCLUDED.ctr`,
            position: sql`EXCLUDED.position`,
            createdAt: sql`NOW()`,
          },
        });

      log.debug("Batch inserted", { siteId, count: rows.length });

      // Return row count (Drizzle doesn't return affected count, estimate from input)
      return rows.length;
    } catch (error) {
      log.error(
        "Batch insert failed",
        error instanceof Error ? error : new Error(String(error)),
        { siteId, rowCount: rows.length }
      );
      throw error;
    }
  }

  /**
   * Get total row count for a site on a specific date.
   *
   * @param siteId - Site connection ID
   * @param date - Date to count
   * @returns Total rows for that site/date
   */
  async getRowCountForDate(siteId: string, date: Date): Promise<number> {
    try {
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(seoGscQueryAnalytics)
        .where(
          and(
            eq(seoGscQueryAnalytics.siteId, siteId),
            sql`${seoGscQueryAnalytics.queryTime} >= ${startOfDay}`,
            sql`${seoGscQueryAnalytics.queryTime} <= ${endOfDay}`
          )
        );

      return result[0]?.count ?? 0;
    } catch (error) {
      log.error(
        "Row count query failed",
        error instanceof Error ? error : new Error(String(error)),
        { siteId, date }
      );
      return 0;
    }
  }
}

/**
 * Factory function to create QueryAnalyticsRepository instance.
 */
export function createQueryAnalyticsRepository(): QueryAnalyticsRepository {
  return new QueryAnalyticsRepository();
}

/**
 * Default singleton instance.
 */
let defaultInstance: QueryAnalyticsRepository | null = null;

/**
 * Get the default QueryAnalyticsRepository singleton.
 */
export function getQueryAnalyticsRepository(): QueryAnalyticsRepository {
  if (!defaultInstance) {
    defaultInstance = new QueryAnalyticsRepository();
  }
  return defaultInstance;
}
