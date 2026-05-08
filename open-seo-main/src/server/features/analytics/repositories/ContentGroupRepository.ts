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
} from "@/db/content-intelligence-schema";
import { seoGscQueryAnalytics } from "@/db/gsc-analytics-schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { sanitizeFolderPattern, validateRegexPattern, ValidationError } from "../utils/query-validation";
import { createLogger } from "@/server/lib/logger";

const logger = createLogger({ module: "content-group-repository" });

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
   * Uses sanitized LIKE pattern to prevent SQL injection
   */
  async getPagesMatchingFolder(
    siteId: string,
    folderPattern: string
  ): Promise<string[]> {
    // Sanitize the folder pattern to escape LIKE special characters (%, _, \)
    const sanitizedPattern = sanitizeFolderPattern(folderPattern);
    const likePattern = `%${sanitizedPattern}%`;

    const results = await db.execute<{ page_url: string }>(
      sql`
        SELECT DISTINCT page_url
        FROM ${seoGscQueryAnalytics}
        WHERE site_id = ${siteId}
          AND page_url IS NOT NULL
          AND page_url LIKE ${likePattern}
      `
    );

    return results.rows.map((r) => r.page_url);
  }

  /**
   * Get pages matching a regex pattern
   * Validates regex pattern before use to prevent ReDoS and injection
   */
  async getPagesMatchingRegex(
    siteId: string,
    regexPattern: string
  ): Promise<string[]> {
    // Validate regex pattern to prevent ReDoS and ensure it's valid
    const validatedPattern = validateRegexPattern(regexPattern);
    if (!validatedPattern) {
      throw new ValidationError(
        `Invalid regex pattern: "${regexPattern}". Pattern must be valid regex and under 200 characters.`
      );
    }

    const results = await db.execute<{ page_url: string }>(
      sql`
        SELECT DISTINCT page_url
        FROM ${seoGscQueryAnalytics}
        WHERE site_id = ${siteId}
          AND page_url IS NOT NULL
          AND REGEXP_REPLACE(page_url, '^https?://[^/]+', '') ~ ${validatedPattern}
      `
    );

    return results.rows.map((r) => r.page_url);
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

  /**
   * Get pages for multiple groups in a single batch query.
   * More efficient than calling getGroupPages for each group.
   *
   * @param groupIds - Array of group IDs to fetch pages for
   * @returns Map of groupId to array of page data
   */
  async getGroupPagesBatch(
    groupIds: string[]
  ): Promise<Map<string, Array<{ pageUrl: string; manuallyAdded: boolean }>>> {
    if (groupIds.length === 0) {
      return new Map();
    }

    logger.debug("Fetching pages for groups batch", {
      groupCount: groupIds.length,
    });

    const results = await db
      .select({
        groupId: contentGroupPages.groupId,
        pageUrl: contentGroupPages.pageUrl,
        manuallyAdded: contentGroupPages.manuallyAdded,
      })
      .from(contentGroupPages)
      .where(inArray(contentGroupPages.groupId, groupIds));

    // Initialize map with empty arrays for all requested groups
    const resultMap = new Map<string, Array<{ pageUrl: string; manuallyAdded: boolean }>>();
    for (const groupId of groupIds) {
      resultMap.set(groupId, []);
    }

    // Populate map with results
    for (const row of results) {
      resultMap.get(row.groupId)?.push({
        pageUrl: row.pageUrl,
        manuallyAdded: row.manuallyAdded ?? false,
      });
    }

    return resultMap;
  }

  /**
   * Get metrics for multiple groups in a single batch query.
   *
   * @param groupIds - Array of group IDs to fetch metrics for
   * @param siteId - Site ID for GSC data lookup
   * @param currentStartDate - Start date for current period
   * @param currentEndDate - End date for current period
   * @param prevStartDate - Start date for previous period
   * @param prevEndDate - End date for previous period
   * @returns Map of groupId to metrics
   */
  async getGroupMetricsBatch(
    groupIds: string[],
    siteId: string,
    currentStartDate: string,
    currentEndDate: string,
    prevStartDate: string,
    prevEndDate: string
  ): Promise<Map<string, {
    totalClicks: number;
    totalImpressions: number;
    avgPosition: number;
    prevClicks: number;
    prevImpressions: number;
  }>> {
    if (groupIds.length === 0) {
      return new Map();
    }

    logger.debug("Fetching metrics for groups batch", {
      groupCount: groupIds.length,
      siteId,
    });

    // First get all pages for all groups
    const pagesMap = await this.getGroupPagesBatch(groupIds);

    // Collect all unique page URLs
    const allPageUrls = new Set<string>();
    for (const pages of pagesMap.values()) {
      for (const page of pages) {
        allPageUrls.add(page.pageUrl);
      }
    }

    if (allPageUrls.size === 0) {
      // Return empty metrics for all groups
      const emptyMetrics = {
        totalClicks: 0,
        totalImpressions: 0,
        avgPosition: 0,
        prevClicks: 0,
        prevImpressions: 0,
      };
      const resultMap = new Map<string, typeof emptyMetrics>();
      for (const groupId of groupIds) {
        resultMap.set(groupId, { ...emptyMetrics });
      }
      return resultMap;
    }

    const pageUrlsArray = Array.from(allPageUrls);

    // Get metrics for all pages at once
    const result = await db.execute<{
      page_url: string;
      current_clicks: string;
      current_impressions: string;
      current_position: string;
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
            AND page_url = ANY(${pageUrlsArray})
            AND query_time >= ${currentStartDate}::date
            AND query_time <= ${currentEndDate}::date
          GROUP BY page_url
        ),
        prev_period AS (
          SELECT
            page_url,
            COALESCE(SUM(clicks), 0) as clicks,
            COALESCE(SUM(impressions), 0) as impressions
          FROM ${seoGscQueryAnalytics}
          WHERE site_id = ${siteId}
            AND page_url = ANY(${pageUrlsArray})
            AND query_time >= ${prevStartDate}::date
            AND query_time <= ${prevEndDate}::date
          GROUP BY page_url
        )
        SELECT
          COALESCE(c.page_url, p.page_url) as page_url,
          COALESCE(c.clicks, 0)::text as current_clicks,
          COALESCE(c.impressions, 0)::text as current_impressions,
          COALESCE(c.position, 0)::text as current_position,
          COALESCE(p.clicks, 0)::text as prev_clicks,
          COALESCE(p.impressions, 0)::text as prev_impressions
        FROM current_period c
        FULL OUTER JOIN prev_period p ON c.page_url = p.page_url
      `
    );

    // Build page metrics lookup
    const pageMetrics = new Map<string, {
      clicks: number;
      impressions: number;
      position: number;
      prevClicks: number;
      prevImpressions: number;
    }>();

    for (const row of result.rows) {
      pageMetrics.set(row.page_url, {
        clicks: parseInt(row.current_clicks, 10),
        impressions: parseInt(row.current_impressions, 10),
        position: parseFloat(row.current_position),
        prevClicks: parseInt(row.prev_clicks, 10),
        prevImpressions: parseInt(row.prev_impressions, 10),
      });
    }

    // Aggregate metrics per group
    const resultMap = new Map<string, {
      totalClicks: number;
      totalImpressions: number;
      avgPosition: number;
      prevClicks: number;
      prevImpressions: number;
    }>();

    for (const groupId of groupIds) {
      const groupPages = pagesMap.get(groupId) ?? [];
      let totalClicks = 0;
      let totalImpressions = 0;
      let totalPosition = 0;
      let positionCount = 0;
      let prevClicks = 0;
      let prevImpressions = 0;

      for (const page of groupPages) {
        const metrics = pageMetrics.get(page.pageUrl);
        if (metrics) {
          totalClicks += metrics.clicks;
          totalImpressions += metrics.impressions;
          if (metrics.position > 0) {
            totalPosition += metrics.position;
            positionCount++;
          }
          prevClicks += metrics.prevClicks;
          prevImpressions += metrics.prevImpressions;
        }
      }

      resultMap.set(groupId, {
        totalClicks,
        totalImpressions,
        avgPosition: positionCount > 0 ? totalPosition / positionCount : 0,
        prevClicks,
        prevImpressions,
      });
    }

    return resultMap;
  }

  /**
   * Add multiple pages to a group in a single batch operation.
   *
   * @param groupId - Group ID to add pages to
   * @param pages - Array of page URLs with optional manuallyAdded flag
   */
  async addPagesToGroupBatch(
    groupId: string,
    pages: Array<{ pageUrl: string; manuallyAdded?: boolean }>
  ): Promise<void> {
    if (pages.length === 0) {
      return;
    }

    logger.debug("Adding pages to group batch", {
      groupId,
      pageCount: pages.length,
    });

    const values = pages.map((p) => ({
      groupId,
      pageUrl: p.pageUrl,
      manuallyAdded: p.manuallyAdded ?? false,
    }));

    await db
      .insert(contentGroupPages)
      .values(values)
      .onConflictDoNothing();
  }
}
