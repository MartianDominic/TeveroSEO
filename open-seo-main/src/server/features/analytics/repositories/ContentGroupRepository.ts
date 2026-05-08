/**
 * ContentGroupRepository
 * Phase 96-04: Content Groups with Auto-Grouping
 *
 * Handles persistence for content groups and their page memberships.
 */
import { db } from "@/db";
import {
  contentGroups,
  contentGroupPages,
  type ContentGroup,
  type ContentGroupInsert,
  type ContentGroupPage,
} from "@/db/content-intelligence-schema";
import { seoGscQueryAnalytics } from "@/db/gsc-analytics-schema";
import { eq, and, sql, like, inArray } from "drizzle-orm";

export interface DistinctFolder {
  folder: string;
  pageCount: number;
}

export class ContentGroupRepository {
  /**
   * Find all groups for a site
   */
  async findBySiteId(siteId: string): Promise<ContentGroup[]> {
    return db
      .select()
      .from(contentGroups)
      .where(eq(contentGroups.siteId, siteId));
  }

  /**
   * Find a group by ID
   */
  async findById(id: string): Promise<ContentGroup | null> {
    const results = await db
      .select()
      .from(contentGroups)
      .where(eq(contentGroups.id, id))
      .limit(1);
    return results[0] || null;
  }

  /**
   * Create a new content group
   */
  async create(data: ContentGroupInsert): Promise<ContentGroup> {
    const results = await db.insert(contentGroups).values(data).returning();
    return results[0];
  }

  /**
   * Update a content group
   */
  async update(
    id: string,
    data: Partial<ContentGroupInsert>
  ): Promise<ContentGroup | null> {
    const results = await db
      .update(contentGroups)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(contentGroups.id, id))
      .returning();
    return results[0] || null;
  }

  /**
   * Delete a content group
   */
  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(contentGroups)
      .where(eq(contentGroups.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get pages belonging to a group
   */
  async getGroupPages(
    groupId: string
  ): Promise<Array<{ pageUrl: string; manuallyAdded: boolean }>> {
    const results = await db
      .select({
        pageUrl: contentGroupPages.pageUrl,
        manuallyAdded: contentGroupPages.manuallyAdded,
      })
      .from(contentGroupPages)
      .where(eq(contentGroupPages.groupId, groupId));

    return results.map((r) => ({
      pageUrl: r.pageUrl,
      manuallyAdded: r.manuallyAdded ?? false,
    }));
  }

  /**
   * Add a page to a group
   */
  async addPageToGroup(
    groupId: string,
    pageUrl: string,
    manuallyAdded: boolean = false
  ): Promise<void> {
    await db
      .insert(contentGroupPages)
      .values({ groupId, pageUrl, manuallyAdded })
      .onConflictDoNothing();
  }

  /**
   * Batch add pages to a group (more efficient than N individual inserts)
   */
  async addPagesToGroupBatch(
    groupId: string,
    pageUrls: string[],
    manuallyAdded: boolean = false
  ): Promise<void> {
    if (pageUrls.length === 0) return;

    await db
      .insert(contentGroupPages)
      .values(pageUrls.map((pageUrl) => ({ groupId, pageUrl, manuallyAdded })))
      .onConflictDoNothing();
  }

  /**
   * Remove a page from a group
   */
  async removePageFromGroup(groupId: string, pageUrl: string): Promise<void> {
    await db
      .delete(contentGroupPages)
      .where(
        and(
          eq(contentGroupPages.groupId, groupId),
          eq(contentGroupPages.pageUrl, pageUrl)
        )
      );
  }

  /**
   * Clear all pages from a group (optionally only auto-added ones)
   */
  async clearGroupPages(
    groupId: string,
    onlyAutoAdded: boolean = false
  ): Promise<void> {
    if (onlyAutoAdded) {
      await db
        .delete(contentGroupPages)
        .where(
          and(
            eq(contentGroupPages.groupId, groupId),
            eq(contentGroupPages.manuallyAdded, false)
          )
        );
    } else {
      await db
        .delete(contentGroupPages)
        .where(eq(contentGroupPages.groupId, groupId));
    }
  }

  /**
   * Get distinct folder patterns from GSC data with page counts
   * Only returns folders with >= minPages pages
   */
  async getDistinctFolders(
    siteId: string,
    minPages: number = 3
  ): Promise<DistinctFolder[]> {
    // Extract folder pattern from page URLs
    // e.g., "https://example.com/blog/post-1" -> "/blog/"
    const results = await db.execute<{ folder: string; page_count: string }>(
      sql`
        SELECT
          REGEXP_REPLACE(
            REGEXP_REPLACE(page_url, '^https?://[^/]+', ''),
            '/[^/]*$', '/'
          ) as folder,
          COUNT(DISTINCT page_url)::text as page_count
        FROM ${seoGscQueryAnalytics}
        WHERE site_id = ${siteId}
          AND page_url IS NOT NULL
        GROUP BY folder
        HAVING COUNT(DISTINCT page_url) >= ${minPages}
        ORDER BY page_count DESC
      `
    );

    return results.rows.map((r) => ({
      folder: r.folder,
      pageCount: parseInt(r.page_count, 10),
    }));
  }

  /**
   * Get pages matching a folder pattern
   */
  async getPagesMatchingFolder(
    siteId: string,
    folderPattern: string
  ): Promise<string[]> {
    const results = await db
      .selectDistinct({ pageUrl: seoGscQueryAnalytics.pageUrl })
      .from(seoGscQueryAnalytics)
      .where(
        and(
          eq(seoGscQueryAnalytics.siteId, siteId),
          like(seoGscQueryAnalytics.pageUrl, `%${folderPattern}%`)
        )
      );

    return results
      .map((r) => r.pageUrl)
      .filter((url): url is string => url !== null);
  }

  /**
   * Get pages matching a regex pattern
   */
  async getPagesMatchingRegex(
    siteId: string,
    regexPattern: string
  ): Promise<string[]> {
    const results = await db.execute<{ page_url: string }>(
      sql`
        SELECT DISTINCT page_url
        FROM ${seoGscQueryAnalytics}
        WHERE site_id = ${siteId}
          AND page_url IS NOT NULL
          AND REGEXP_REPLACE(page_url, '^https?://[^/]+', '') ~ ${regexPattern}
      `
    );

    return results.rows.map((r) => r.page_url);
  }

  /**
   * Batch get pages for multiple groups (avoids N+1 queries)
   */
  async getGroupPagesBatch(
    groupIds: string[]
  ): Promise<Map<string, Array<{ pageUrl: string; manuallyAdded: boolean }>>> {
    if (groupIds.length === 0) {
      return new Map();
    }

    const results = await db
      .select({
        groupId: contentGroupPages.groupId,
        pageUrl: contentGroupPages.pageUrl,
        manuallyAdded: contentGroupPages.manuallyAdded,
      })
      .from(contentGroupPages)
      .where(inArray(contentGroupPages.groupId, groupIds));

    // Group results by groupId
    const map = new Map<
      string,
      Array<{ pageUrl: string; manuallyAdded: boolean }>
    >();
    for (const r of results) {
      const existing = map.get(r.groupId) || [];
      existing.push({
        pageUrl: r.pageUrl,
        manuallyAdded: r.manuallyAdded ?? false,
      });
      map.set(r.groupId, existing);
    }

    return map;
  }

  /**
   * Batch get metrics for multiple pages (avoids N+1 queries)
   * Returns a map of pageUrl -> metrics
   */
  async getGroupMetricsBatch(
    pageUrls: string[],
    siteId: string,
    currentStartDate: string,
    currentEndDate: string,
    prevStartDate: string,
    prevEndDate: string
  ): Promise<
    Map<
      string,
      {
        clicks: number;
        impressions: number;
        position: number;
        prevClicks: number;
        prevImpressions: number;
      }
    >
  > {
    if (pageUrls.length === 0) {
      return new Map();
    }

    const result = await db.execute<{
      page_url: string;
      clicks: string;
      impressions: string;
      position: string;
      prev_clicks: string;
      prev_impressions: string;
    }>(
      sql`
        WITH current_period AS (
          SELECT
            page_url,
            COALESCE(SUM(clicks), 0) as clicks,
            COALESCE(SUM(impressions), 0) as impressions,
            COALESCE(AVG(position), 0) as position
          FROM ${seoGscQueryAnalytics}
          WHERE site_id = ${siteId}
            AND page_url = ANY(${pageUrls})
            AND query_time >= ${currentStartDate}::date
            AND query_time <= ${currentEndDate}::date
          GROUP BY page_url
        ),
        prev_period AS (
          SELECT
            page_url,
            COALESCE(SUM(clicks), 0) as prev_clicks,
            COALESCE(SUM(impressions), 0) as prev_impressions
          FROM ${seoGscQueryAnalytics}
          WHERE site_id = ${siteId}
            AND page_url = ANY(${pageUrls})
            AND query_time >= ${prevStartDate}::date
            AND query_time <= ${prevEndDate}::date
          GROUP BY page_url
        )
        SELECT
          COALESCE(c.page_url, p.page_url) as page_url,
          COALESCE(c.clicks, 0)::text as clicks,
          COALESCE(c.impressions, 0)::text as impressions,
          COALESCE(c.position, 0)::text as position,
          COALESCE(p.prev_clicks, 0)::text as prev_clicks,
          COALESCE(p.prev_impressions, 0)::text as prev_impressions
        FROM current_period c
        FULL OUTER JOIN prev_period p ON c.page_url = p.page_url
      `
    );

    const map = new Map<
      string,
      {
        clicks: number;
        impressions: number;
        position: number;
        prevClicks: number;
        prevImpressions: number;
      }
    >();

    for (const row of result.rows) {
      map.set(row.page_url, {
        clicks: parseInt(row.clicks || "0", 10),
        impressions: parseInt(row.impressions || "0", 10),
        position: parseFloat(row.position || "0"),
        prevClicks: parseInt(row.prev_clicks || "0", 10),
        prevImpressions: parseInt(row.prev_impressions || "0", 10),
      });
    }

    return map;
  }

  /**
   * Get aggregated metrics for pages in a group
   */
  async getGroupMetrics(
    pageUrls: string[],
    siteId: string,
    currentStartDate: string,
    currentEndDate: string,
    prevStartDate: string,
    prevEndDate: string
  ): Promise<{
    totalClicks: number;
    totalImpressions: number;
    avgPosition: number;
    prevClicks: number;
    prevImpressions: number;
  }> {
    if (pageUrls.length === 0) {
      return {
        totalClicks: 0,
        totalImpressions: 0,
        avgPosition: 0,
        prevClicks: 0,
        prevImpressions: 0,
      };
    }

    const result = await db.execute<{
      total_clicks: string;
      total_impressions: string;
      avg_position: string;
      prev_clicks: string;
      prev_impressions: string;
    }>(
      sql`
        WITH current_period AS (
          SELECT
            COALESCE(SUM(clicks), 0) as total_clicks,
            COALESCE(SUM(impressions), 0) as total_impressions,
            COALESCE(AVG(position), 0) as avg_position
          FROM ${seoGscQueryAnalytics}
          WHERE site_id = ${siteId}
            AND page_url = ANY(${pageUrls})
            AND query_time >= ${currentStartDate}::date
            AND query_time <= ${currentEndDate}::date
        ),
        prev_period AS (
          SELECT
            COALESCE(SUM(clicks), 0) as prev_clicks,
            COALESCE(SUM(impressions), 0) as prev_impressions
          FROM ${seoGscQueryAnalytics}
          WHERE site_id = ${siteId}
            AND page_url = ANY(${pageUrls})
            AND query_time >= ${prevStartDate}::date
            AND query_time <= ${prevEndDate}::date
        )
        SELECT
          current_period.total_clicks::text,
          current_period.total_impressions::text,
          current_period.avg_position::text,
          prev_period.prev_clicks::text,
          prev_period.prev_impressions::text
        FROM current_period, prev_period
      `
    );

    const row = result.rows[0];
    return {
      totalClicks: parseInt(row?.total_clicks || "0", 10),
      totalImpressions: parseInt(row?.total_impressions || "0", 10),
      avgPosition: parseFloat(row?.avg_position || "0"),
      prevClicks: parseInt(row?.prev_clicks || "0", 10),
      prevImpressions: parseInt(row?.prev_impressions || "0", 10),
    };
  }
}
