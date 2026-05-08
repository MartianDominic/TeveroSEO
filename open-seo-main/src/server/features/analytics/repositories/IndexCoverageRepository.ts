/**
 * IndexCoverageRepository
 * Phase 96-04: URL Inspection + Index Coverage
 *
 * Handles persistence for URL inspection results and indexing requests.
 */
import { db } from "@/db";
import {
  pageIndexStatus,
  indexingRequests,
  type PageIndexStatus,
  type PageIndexStatusInsert,
  type IndexingRequest,
  type IndexingRequestInsert,
} from "@/db/content-intelligence-schema";
import { eq, and, sql, desc, lte } from "drizzle-orm";
import type { IndexCoverageStats, IndexingQuota, InspectionPriority } from "../types";

export class IndexCoverageRepository {
  /**
   * Find all inspection results for a site
   */
  async findBySiteId(siteId: string): Promise<PageIndexStatus[]> {
    return db
      .select()
      .from(pageIndexStatus)
      .where(eq(pageIndexStatus.siteId, siteId));
  }

  /**
   * Find inspection result for a specific URL
   */
  async findByUrl(
    siteId: string,
    pageUrl: string
  ): Promise<PageIndexStatus | null> {
    const results = await db
      .select()
      .from(pageIndexStatus)
      .where(
        and(
          eq(pageIndexStatus.siteId, siteId),
          eq(pageIndexStatus.pageUrl, pageUrl)
        )
      )
      .limit(1);
    return results[0] || null;
  }

  /**
   * Upsert inspection result
   */
  async upsert(data: PageIndexStatusInsert): Promise<void> {
    await db
      .insert(pageIndexStatus)
      .values(data)
      .onConflictDoUpdate({
        target: [pageIndexStatus.siteId, pageIndexStatus.pageUrl],
        set: {
          coverageState: data.coverageState,
          indexingState: data.indexingState,
          lastCrawlTime: data.lastCrawlTime,
          crawledAs: data.crawledAs,
          robotsTxtState: data.robotsTxtState,
          canonicalUrl: data.canonicalUrl,
          isCanonical: data.isCanonical,
          mobileUsability: data.mobileUsability,
          richResults: data.richResults,
          userDeclaredCanonical: data.userDeclaredCanonical,
          googleSelectedCanonical: data.googleSelectedCanonical,
          pageFetchState: data.pageFetchState,
          referringUrls: data.referringUrls,
          inspectionTime: data.inspectionTime,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Batch upsert inspection results
   */
  async batchUpsert(data: PageIndexStatusInsert[]): Promise<void> {
    for (const item of data) {
      await this.upsert(item);
    }
  }

  /**
   * Get aggregated stats by coverage state
   */
  async getStats(siteId: string): Promise<IndexCoverageStats> {
    const results = await db.execute<{
      coverage_state: string;
      count: string;
    }>(
      sql`
        SELECT
          coverage_state,
          COUNT(*)::text as count
        FROM ${pageIndexStatus}
        WHERE site_id = ${siteId}
        GROUP BY coverage_state
      `
    );

    const byState: Record<string, number> = {};
    let total = 0;
    let indexed = 0;
    let notIndexed = 0;

    for (const row of results.rows) {
      const count = parseInt(row.count, 10);
      byState[row.coverage_state || "Unknown"] = count;
      total += count;

      if (
        row.coverage_state === "Submitted and indexed" ||
        row.coverage_state?.includes("indexed")
      ) {
        indexed += count;
      } else {
        notIndexed += count;
      }
    }

    // Get last updated time
    const lastUpdatedResult = await db
      .select({ updatedAt: pageIndexStatus.updatedAt })
      .from(pageIndexStatus)
      .where(eq(pageIndexStatus.siteId, siteId))
      .orderBy(desc(pageIndexStatus.updatedAt))
      .limit(1);

    return {
      total,
      indexed,
      notIndexed,
      byState,
      lastUpdated: lastUpdatedResult[0]?.updatedAt || new Date(),
    };
  }

  /**
   * Get pending indexing requests
   */
  async getPendingRequests(siteId: string): Promise<IndexingRequest[]> {
    return db
      .select()
      .from(indexingRequests)
      .where(
        and(
          eq(indexingRequests.siteId, siteId),
          eq(indexingRequests.status, "pending")
        )
      )
      .orderBy(desc(indexingRequests.priority));
  }

  /**
   * Create an indexing request
   */
  async createRequest(
    data: IndexingRequestInsert
  ): Promise<IndexingRequest> {
    const results = await db
      .insert(indexingRequests)
      .values(data)
      .returning();
    return results[0];
  }

  /**
   * Update an indexing request
   */
  async updateRequest(
    id: string,
    data: Partial<IndexingRequestInsert>
  ): Promise<void> {
    await db
      .update(indexingRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(indexingRequests.id, id));
  }

  /**
   * Get quota usage for today
   * Note: This is a simplified implementation - in production,
   * you'd track this in a dedicated quota table
   */
  async getQuotaUsage(siteId: string): Promise<IndexingQuota> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Count today's inspections
    const inspectionsResult = await db.execute<{ count: string }>(
      sql`
        SELECT COUNT(*)::text as count
        FROM ${pageIndexStatus}
        WHERE site_id = ${siteId}
          AND inspection_time >= ${today.toISOString()}::timestamptz
          AND inspection_time < ${tomorrow.toISOString()}::timestamptz
      `
    );

    // Count today's indexing requests
    const indexingResult = await db.execute<{ count: string }>(
      sql`
        SELECT COUNT(*)::text as count
        FROM ${indexingRequests}
        WHERE site_id = ${siteId}
          AND submitted_at >= ${today.toISOString()}::timestamptz
          AND submitted_at < ${tomorrow.toISOString()}::timestamptz
          AND status = 'success'
      `
    );

    return {
      inspectionsUsed: parseInt(inspectionsResult.rows[0]?.count || "0", 10),
      inspectionsLimit: 2000, // GSC limit
      indexingRequestsUsed: parseInt(indexingResult.rows[0]?.count || "0", 10),
      indexingRequestsLimit: 200, // GSC limit
      resetsAt: tomorrow,
    };
  }

  /**
   * Get high priority URLs for inspection
   */
  async getHighPriorityUrls(
    siteId: string,
    limit: number = 100
  ): Promise<InspectionPriority[]> {
    // Priority logic:
    // 1. New content (never inspected)
    // 2. Decaying pages (from trend analysis)
    // 3. High value pages (from GSC data)
    // 4. Stale inspections (older than 7 days)

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // For now, return stale inspections as priority
    const staleResults = await db
      .select({
        pageUrl: pageIndexStatus.pageUrl,
        inspectionTime: pageIndexStatus.inspectionTime,
      })
      .from(pageIndexStatus)
      .where(
        and(
          eq(pageIndexStatus.siteId, siteId),
          lte(pageIndexStatus.inspectionTime, sevenDaysAgo)
        )
      )
      .orderBy(pageIndexStatus.inspectionTime)
      .limit(limit);

    return staleResults.map((r, index) => ({
      pageUrl: r.pageUrl,
      priority: 100 - index, // Higher priority for older inspections
      reason: "stale" as const,
      createdAt: new Date(),
    }));
  }
}
