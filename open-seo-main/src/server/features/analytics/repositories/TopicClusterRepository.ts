/**
 * TopicClusterRepository
 * Phase 96-04: Topic Clusters with Hub/Spoke Detection
 *
 * Handles persistence for topic clusters and their page memberships.
 */
import { db } from "@/db";
import {
  analyticsTopicClusters,
  analyticsTopicClusterPages,
  type AnalyticsTopicCluster,
  type AnalyticsTopicClusterInsert,
} from "@/db/content-intelligence-schema";
import { seoGscQueryAnalytics } from "@/db/gsc-analytics-schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { createLogger } from "@/server/lib/logger";

const logger = createLogger({ module: "topic-cluster-repository" });

export interface ClusterPageData {
  pageUrl: string;
  pageTopic: string | null;
  isHub: boolean;
  linksToHub: boolean;
  internalLinkCount: number;
  clicks: number;
  impressions: number;
  position: number | null;
}

export interface ClusterMetricsUpdate {
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number | null;
  coverage?: number;
  gaps?: string[];
}

export class TopicClusterRepository {
  /**
   * Find all clusters for a site
   */
  async findBySiteId(siteId: string): Promise<AnalyticsTopicCluster[]> {
    return db
      .select()
      .from(analyticsTopicClusters)
      .where(eq(analyticsTopicClusters.siteId, siteId));
  }

  /**
   * Find a cluster by ID
   */
  async findById(id: string): Promise<AnalyticsTopicCluster | null> {
    const results = await db
      .select()
      .from(analyticsTopicClusters)
      .where(eq(analyticsTopicClusters.id, id))
      .limit(1);
    return results[0] || null;
  }

  /**
   * Create a new topic cluster
   */
  async create(
    data: AnalyticsTopicClusterInsert
  ): Promise<AnalyticsTopicCluster> {
    const results = await db
      .insert(analyticsTopicClusters)
      .values(data)
      .returning();
    return results[0];
  }

  /**
   * Update a topic cluster
   */
  async update(
    id: string,
    data: Partial<AnalyticsTopicClusterInsert>
  ): Promise<AnalyticsTopicCluster | null> {
    const results = await db
      .update(analyticsTopicClusters)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(analyticsTopicClusters.id, id))
      .returning();
    return results[0] || null;
  }

  /**
   * Delete a topic cluster
   */
  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(analyticsTopicClusters)
      .where(eq(analyticsTopicClusters.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get pages belonging to a cluster
   */
  async getClusterPages(clusterId: string): Promise<ClusterPageData[]> {
    const results = await db
      .select({
        pageUrl: analyticsTopicClusterPages.pageUrl,
        pageTopic: analyticsTopicClusterPages.pageTopic,
        isHub: analyticsTopicClusterPages.isHub,
        linksToHub: analyticsTopicClusterPages.linksToHub,
        internalLinkCount: analyticsTopicClusterPages.internalLinkCount,
        clicks: analyticsTopicClusterPages.clicks,
        impressions: analyticsTopicClusterPages.impressions,
        position: analyticsTopicClusterPages.position,
      })
      .from(analyticsTopicClusterPages)
      .where(eq(analyticsTopicClusterPages.clusterId, clusterId));

    return results.map((r) => ({
      pageUrl: r.pageUrl,
      pageTopic: r.pageTopic,
      isHub: r.isHub ?? false,
      linksToHub: r.linksToHub ?? false,
      internalLinkCount: r.internalLinkCount ?? 0,
      clicks: r.clicks ?? 0,
      impressions: r.impressions ?? 0,
      position: r.position,
    }));
  }

  /**
   * Add a page to a cluster
   */
  async addPageToCluster(
    clusterId: string,
    pageUrl: string,
    pageTopic: string | null,
    isHub: boolean = false,
    linksToHub: boolean = false,
    internalLinkCount: number = 0
  ): Promise<void> {
    await db
      .insert(analyticsTopicClusterPages)
      .values({
        clusterId,
        pageUrl,
        pageTopic,
        isHub,
        linksToHub,
        internalLinkCount,
      })
      .onConflictDoUpdate({
        target: [
          analyticsTopicClusterPages.clusterId,
          analyticsTopicClusterPages.pageUrl,
        ],
        set: {
          pageTopic,
          isHub,
          linksToHub,
          internalLinkCount,
        },
      });
  }

  /**
   * Remove a page from a cluster
   */
  async removePageFromCluster(
    clusterId: string,
    pageUrl: string
  ): Promise<void> {
    await db
      .delete(analyticsTopicClusterPages)
      .where(
        and(
          eq(analyticsTopicClusterPages.clusterId, clusterId),
          eq(analyticsTopicClusterPages.pageUrl, pageUrl)
        )
      );
  }

  /**
   * Clear all pages from a cluster
   */
  async clearClusterPages(clusterId: string): Promise<void> {
    await db
      .delete(analyticsTopicClusterPages)
      .where(eq(analyticsTopicClusterPages.clusterId, clusterId));
  }

  /**
   * Update cluster metrics
   */
  async updateClusterMetrics(
    clusterId: string,
    metrics: ClusterMetricsUpdate
  ): Promise<void> {
    await db
      .update(analyticsTopicClusters)
      .set({
        totalClicks: metrics.totalClicks,
        totalImpressions: metrics.totalImpressions,
        avgPosition: metrics.avgPosition,
        coverage: metrics.coverage,
        gaps: metrics.gaps,
        lastAnalyzedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(analyticsTopicClusters.id, clusterId));
  }

  /**
   * Update page metrics in a cluster from GSC data
   */
  async updateClusterPageMetrics(
    clusterId: string,
    siteId: string,
    startDate: string,
    endDate: string
  ): Promise<void> {
    // Get all pages in the cluster
    const pages = await this.getClusterPages(clusterId);
    const pageUrls = pages.map((p) => p.pageUrl);

    if (pageUrls.length === 0) return;

    // Fetch metrics from GSC data
    const metrics = await db.execute<{
      page_url: string;
      clicks: string;
      impressions: string;
      position: string;
    }>(
      sql`
        SELECT
          page_url,
          SUM(clicks)::text as clicks,
          SUM(impressions)::text as impressions,
          AVG(position)::text as position
        FROM ${seoGscQueryAnalytics}
        WHERE site_id = ${siteId}
          AND page_url = ANY(${pageUrls})
          AND query_time >= ${startDate}::date
          AND query_time <= ${endDate}::date
        GROUP BY page_url
      `
    );

    // Update each page's metrics
    for (const row of metrics.rows) {
      await db
        .update(analyticsTopicClusterPages)
        .set({
          clicks: parseInt(row.clicks, 10),
          impressions: parseInt(row.impressions, 10),
          position: parseFloat(row.position),
        })
        .where(
          and(
            eq(analyticsTopicClusterPages.clusterId, clusterId),
            eq(analyticsTopicClusterPages.pageUrl, row.page_url)
          )
        );
    }
  }

  /**
   * Find potential hub pages (pages with high incoming internal links)
   */
  async findPotentialHubs(
    siteId: string,
    _minLinks: number = 10
  ): Promise<
    Array<{
      pageUrl: string;
      internalLinks: number;
      clicks: number;
      impressions: number;
      position: number;
    }>
  > {
    // This would typically query an internal links table
    // For now, we'll use GSC data with high impressions as a proxy
    const results = await db.execute<{
      page_url: string;
      clicks: string;
      impressions: string;
      position: string;
    }>(
      sql`
        SELECT
          page_url,
          SUM(clicks)::text as clicks,
          SUM(impressions)::text as impressions,
          AVG(position)::text as position
        FROM ${seoGscQueryAnalytics}
        WHERE site_id = ${siteId}
          AND page_url IS NOT NULL
        GROUP BY page_url
        HAVING SUM(impressions) >= 1000
        ORDER BY SUM(impressions) DESC
        LIMIT 50
      `
    );

    return results.rows.map((r) => ({
      pageUrl: r.page_url,
      internalLinks: 0, // Would come from internal links analysis
      clicks: parseInt(r.clicks, 10),
      impressions: parseInt(r.impressions, 10),
      position: parseFloat(r.position),
    }));
  }

  /**
   * Get pages for multiple clusters in a single batch query.
   * More efficient than calling getClusterPages for each cluster.
   *
   * @param clusterIds - Array of cluster IDs to fetch pages for
   * @returns Map of clusterId to array of ClusterPageData
   */
  async getClusterPagesBatch(
    clusterIds: string[]
  ): Promise<Map<string, ClusterPageData[]>> {
    if (clusterIds.length === 0) {
      return new Map();
    }

    logger.debug("Fetching pages for clusters batch", {
      clusterCount: clusterIds.length,
    });

    const results = await db
      .select({
        clusterId: analyticsTopicClusterPages.clusterId,
        pageUrl: analyticsTopicClusterPages.pageUrl,
        pageTopic: analyticsTopicClusterPages.pageTopic,
        isHub: analyticsTopicClusterPages.isHub,
        linksToHub: analyticsTopicClusterPages.linksToHub,
        internalLinkCount: analyticsTopicClusterPages.internalLinkCount,
        clicks: analyticsTopicClusterPages.clicks,
        impressions: analyticsTopicClusterPages.impressions,
        position: analyticsTopicClusterPages.position,
      })
      .from(analyticsTopicClusterPages)
      .where(inArray(analyticsTopicClusterPages.clusterId, clusterIds));

    // Initialize map with empty arrays for all requested clusters
    const resultMap = new Map<string, ClusterPageData[]>();
    for (const clusterId of clusterIds) {
      resultMap.set(clusterId, []);
    }

    // Populate map with results
    for (const row of results) {
      const pageData: ClusterPageData = {
        pageUrl: row.pageUrl,
        pageTopic: row.pageTopic,
        isHub: row.isHub ?? false,
        linksToHub: row.linksToHub ?? false,
        internalLinkCount: row.internalLinkCount ?? 0,
        clicks: row.clicks ?? 0,
        impressions: row.impressions ?? 0,
        position: row.position,
      };
      resultMap.get(row.clusterId)?.push(pageData);
    }

    return resultMap;
  }
}
