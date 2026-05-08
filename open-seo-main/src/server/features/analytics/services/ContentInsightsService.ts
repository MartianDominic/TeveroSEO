/**
 * ContentInsightsService
 * Phase 96 → AI-Writer Integration
 *
 * Aggregates P96 analytics insights for AI-Writer content workflows:
 * - brief: Trending topics, content gaps, clusters for content briefs
 * - voice: Top-performing content for voice analysis
 * - optimization: Striking distance keywords, internal linking
 * - check: Pre-publish cannibalization detection
 *
 * This service transforms raw analytics data into actionable insights
 * formatted for AI-Writer's content generation pipeline.
 */
import { sql } from "drizzle-orm";
import { db, type DbClient } from "@/db";
import { createLogger } from "@/server/lib/logger";
import { format, subDays } from "date-fns";

// Import P96 services
import { TrendDetectionService, getTrendDetectionService } from "./TrendDetectionService";
import { StrikingDistanceService, getStrikingDistanceService } from "./StrikingDistanceService";
import { CannibalizationService, getCannibalizationService } from "./CannibalizationService";
import { TopicClusterService } from "./TopicClusterService";

const log = createLogger({ module: "content-insights" });

// =============================================================================
// Type Definitions
// =============================================================================

export type InsightType = "brief" | "voice" | "optimization" | "check";

/**
 * Trending topic for content brief suggestions
 */
export interface TrendingTopic {
  keyword: string;
  trend: "rising" | "stable" | "falling";
  volume: number;
  opportunity: "high" | "medium" | "low";
  changePercent: number;
  topPages: string[];
}

/**
 * Content gap identified from cluster analysis
 */
export interface ContentGap {
  topic: string;
  competitorsCovering: number;
  estimatedTraffic: number;
  relatedCluster?: string;
}

/**
 * Related topic cluster for brief context
 */
export interface RelatedCluster {
  clusterId: string;
  clusterName: string;
  pageCount: number;
  coverage: number;
  hubUrl: string;
}

/**
 * Insights for content brief generation
 */
export interface ContentBriefInsights {
  trendingTopics: TrendingTopic[];
  contentGaps: ContentGap[];
  relatedClusters: RelatedCluster[];
  suggestedKeywords: string[];
}

/**
 * Top-performing content sample for voice analysis
 */
export interface TopPerformingContent {
  url: string;
  title: string;
  clicks: number;
  ctr: number;
  avgPosition: number;
  topQueries: string[];
}

/**
 * Engagement metrics summary
 */
export interface EngagementMetrics {
  avgClicks: number;
  avgCtr: number;
  avgPosition: number;
  topEngagingPages: string[];
}

/**
 * Insights for voice analysis workflow
 */
export interface VoiceInsights {
  topPerformingContent: TopPerformingContent[];
  engagementMetrics: EngagementMetrics;
  totalPages: number;
  dateRange: { start: string; end: string };
}

/**
 * Striking distance keyword opportunity
 */
export interface StrikingKeywordInsight {
  keyword: string;
  pageUrl: string;
  currentPosition: number;
  impressions: number;
  currentClicks: number;
  potentialClicks: number;
  difficulty: "easy" | "medium" | "hard";
  suggestedActions: string[];
}

/**
 * Internal linking opportunity
 */
export interface InternalLinkingOpportunity {
  fromPage: string;
  toPage: string;
  anchorSuggestion: string;
  relevanceScore: number;
}

/**
 * Insights for content optimization workflow
 */
export interface OptimizationInsights {
  strikingDistanceKeywords: StrikingKeywordInsight[];
  internalLinkingOpportunities: InternalLinkingOpportunity[];
  quickWinCount: number;
  totalPotentialClicks: number;
}

/**
 * Cannibalization conflict for pre-publish check
 */
export interface CannibalizationConflict {
  url: string;
  keyword: string;
  position: number;
  impressions: number;
  severity: "critical" | "high" | "medium" | "low";
}

/**
 * Pre-publish check results
 */
export interface PrePublishCheck {
  cannibalizationRisk: {
    hasRisk: boolean;
    conflictingPages: CannibalizationConflict[];
    recommendation: string;
    riskLevel: "critical" | "high" | "medium" | "low" | "none";
  };
  duplicateContentRisk: boolean;
  suggestedFocus: string[];
  safeToPublish: boolean;
}

/**
 * Combined insights response
 */
export type ContentInsightsResponse =
  | { type: "brief"; data: ContentBriefInsights }
  | { type: "voice"; data: VoiceInsights }
  | { type: "optimization"; data: OptimizationInsights }
  | { type: "check"; data: PrePublishCheck };

// =============================================================================
// ContentInsightsService
// =============================================================================

export class ContentInsightsService {
  constructor(
    private database: DbClient,
    private trendService: TrendDetectionService,
    private strikingService: StrikingDistanceService,
    private cannibalizationService: CannibalizationService,
    private topicClusterService: TopicClusterService
  ) {}

  /**
   * Get insights for content brief generation.
   *
   * Returns trending topics, content gaps, and related clusters
   * to inform AI-Writer's brief generation.
   */
  async getBriefInsights(siteId: string): Promise<ContentBriefInsights> {
    log.info("Generating brief insights", { siteId });

    try {
      // Fetch trending topics (returns CachedData<TrendResult>, unwrap the data)
      const trendCached = await this.trendService.analyzePageTrends(siteId, {
        periodDays: 21,
        threshold: 0.05, // 5% threshold for more results
        minImpressions: 50,
        trend: "growing",
      });
      const trendResult = trendCached.data;

      // Fetch topic clusters
      const clusters = await this.topicClusterService.getClusters(siteId);

      // Extract trending topics from pages
      const trendingTopics: TrendingTopic[] = trendResult.pages
        .slice(0, 10)
        .map((page) => ({
          keyword: page.topQueries[0] || this.extractKeywordFromUrl(page.pageUrl),
          trend: page.trend === "growing" ? "rising" : page.trend === "decaying" ? "falling" : "stable",
          volume: page.currentImpressions,
          opportunity: this.calculateOpportunity(page.currentImpressions, page.changePercent),
          changePercent: page.changePercent,
          topPages: [page.pageUrl],
        }));

      // Extract content gaps from cluster analysis
      const contentGaps: ContentGap[] = [];
      for (const cluster of clusters.slice(0, 5)) {
        if (cluster.gaps && cluster.gaps.length > 0) {
          for (const gap of cluster.gaps.slice(0, 3)) {
            contentGaps.push({
              topic: gap,
              competitorsCovering: 0, // Would need competitor data
              estimatedTraffic: Math.round(cluster.totalImpressions / cluster.spokePages.length) || 100,
              relatedCluster: cluster.name,
            });
          }
        }
      }

      // Format related clusters
      const relatedClusters: RelatedCluster[] = clusters.slice(0, 5).map((cluster) => ({
        clusterId: cluster.id,
        clusterName: cluster.name,
        pageCount: cluster.spokePages.length + 1,
        coverage: cluster.coverage,
        hubUrl: cluster.hubPage.url,
      }));

      // Extract suggested keywords from top queries across all trending pages
      const allQueries: string[] = trendResult.pages.flatMap((p) => p.topQueries);
      const suggestedKeywords: string[] = Array.from(new Set(allQueries.slice(0, 20)));

      return {
        trendingTopics,
        contentGaps: contentGaps.slice(0, 10),
        relatedClusters,
        suggestedKeywords,
      };
    } catch (error) {
      log.error("Failed to get brief insights", error instanceof Error ? error : undefined, { siteId });
      // Return empty insights on failure rather than throwing
      return {
        trendingTopics: [],
        contentGaps: [],
        relatedClusters: [],
        suggestedKeywords: [],
      };
    }
  }

  /**
   * Get insights for voice analysis workflow.
   *
   * Returns top-performing content samples and engagement metrics
   * for AI-Writer's voice extraction and analysis.
   */
  async getVoiceInsights(siteId: string): Promise<VoiceInsights> {
    log.info("Generating voice insights", { siteId });

    try {
      const endDate = format(subDays(new Date(), 3), "yyyy-MM-dd");
      const startDate = format(subDays(new Date(), 90), "yyyy-MM-dd"); // 90 days for voice analysis

      // Query top-performing pages by clicks
      const result = await this.database.execute<{
        page_url: string;
        total_clicks: number;
        total_impressions: number;
        avg_position: number;
        top_queries: string[];
      }>(sql`
        WITH page_metrics AS (
          SELECT
            page_url,
            SUM(clicks) as total_clicks,
            SUM(impressions) as total_impressions,
            AVG(position) as avg_position
          FROM seo_gsc_query_analytics
          WHERE site_id = ${siteId}
            AND query_time >= ${startDate}::date
            AND query_time <= ${endDate}::date
            AND page_url IS NOT NULL
          GROUP BY page_url
          HAVING SUM(clicks) > 0
          ORDER BY SUM(clicks) DESC
          LIMIT 20
        ),
        page_queries AS (
          SELECT
            page_url,
            ARRAY_AGG(query ORDER BY SUM(clicks) DESC) FILTER (WHERE query IS NOT NULL) as queries
          FROM seo_gsc_query_analytics
          WHERE site_id = ${siteId}
            AND query_time >= ${startDate}::date
            AND query_time <= ${endDate}::date
          GROUP BY page_url
        )
        SELECT
          pm.page_url,
          pm.total_clicks,
          pm.total_impressions,
          pm.avg_position,
          COALESCE(pq.queries[1:5], ARRAY[]::text[]) as top_queries
        FROM page_metrics pm
        LEFT JOIN page_queries pq ON pm.page_url = pq.page_url
        ORDER BY pm.total_clicks DESC
      `);

      const topPerformingContent: TopPerformingContent[] = result.rows.map((row) => ({
        url: row.page_url,
        title: this.extractTitleFromUrl(row.page_url),
        clicks: Number(row.total_clicks),
        ctr:
          Number(row.total_impressions) > 0
            ? Number(row.total_clicks) / Number(row.total_impressions)
            : 0,
        avgPosition: Number(row.avg_position),
        topQueries: row.top_queries || [],
      }));

      // Calculate engagement metrics
      const totalClicks = topPerformingContent.reduce((sum, p) => sum + p.clicks, 0);
      const avgCtr =
        topPerformingContent.length > 0
          ? topPerformingContent.reduce((sum, p) => sum + p.ctr, 0) / topPerformingContent.length
          : 0;
      const avgPosition =
        topPerformingContent.length > 0
          ? topPerformingContent.reduce((sum, p) => sum + p.avgPosition, 0) /
            topPerformingContent.length
          : 0;

      const engagementMetrics: EngagementMetrics = {
        avgClicks: topPerformingContent.length > 0 ? totalClicks / topPerformingContent.length : 0,
        avgCtr,
        avgPosition,
        topEngagingPages: topPerformingContent.slice(0, 5).map((p) => p.url),
      };

      return {
        topPerformingContent,
        engagementMetrics,
        totalPages: result.rows.length,
        dateRange: { start: startDate, end: endDate },
      };
    } catch (error) {
      log.error("Failed to get voice insights", error instanceof Error ? error : undefined, { siteId });
      return {
        topPerformingContent: [],
        engagementMetrics: {
          avgClicks: 0,
          avgCtr: 0,
          avgPosition: 0,
          topEngagingPages: [],
        },
        totalPages: 0,
        dateRange: {
          start: format(subDays(new Date(), 90), "yyyy-MM-dd"),
          end: format(subDays(new Date(), 3), "yyyy-MM-dd"),
        },
      };
    }
  }

  /**
   * Get insights for content optimization workflow.
   *
   * Returns striking distance keywords and internal linking opportunities
   * for AI-Writer's SEO optimization suggestions.
   */
  async getOptimizationInsights(siteId: string): Promise<OptimizationInsights> {
    log.info("Generating optimization insights", { siteId });

    try {
      // Get striking distance keywords (returns CachedData<StrikingDistanceResult>, unwrap)
      const strikingCached = await this.strikingService.getStrikingDistancePages(siteId, {
        minPosition: 11,
        maxPosition: 20,
        minImpressions: 50,
        limit: 20,
      });
      const strikingResult = strikingCached.data;

      // Transform to keyword-centric format
      const strikingDistanceKeywords: StrikingKeywordInsight[] = [];

      for (const page of strikingResult.pages) {
        // Extract keywords from top queries
        for (const queryData of (page.topQueries || []).slice(0, 3)) {
          strikingDistanceKeywords.push({
            keyword: queryData.query,
            pageUrl: page.pageUrl,
            currentPosition: queryData.position,
            impressions: queryData.impressions,
            currentClicks: queryData.clicks,
            potentialClicks: this.estimatePotentialClicks(queryData.impressions, queryData.position),
            difficulty: this.calculateDifficultyFromPosition(queryData.position),
            suggestedActions: this.generateOptimizationActions(queryData.position),
          });
        }
      }

      // Sort by potential clicks
      strikingDistanceKeywords.sort((a, b) => b.potentialClicks - a.potentialClicks);

      // Internal linking opportunities (placeholder - would need internal link data)
      const internalLinkingOpportunities: InternalLinkingOpportunity[] = [];

      const totalPotentialClicks = strikingDistanceKeywords.reduce(
        (sum, k) => sum + k.potentialClicks,
        0
      );

      return {
        strikingDistanceKeywords: strikingDistanceKeywords.slice(0, 20),
        internalLinkingOpportunities,
        quickWinCount: strikingDistanceKeywords.filter((k) => k.difficulty === "easy").length,
        totalPotentialClicks,
      };
    } catch (error) {
      log.error("Failed to get optimization insights", error instanceof Error ? error : undefined, {
        siteId,
      });
      return {
        strikingDistanceKeywords: [],
        internalLinkingOpportunities: [],
        quickWinCount: 0,
        totalPotentialClicks: 0,
      };
    }
  }

  /**
   * Get pre-publish check for cannibalization risks.
   *
   * Checks if target keywords would conflict with existing content.
   */
  async getPrePublishCheck(siteId: string, targetKeywords: string[]): Promise<PrePublishCheck> {
    log.info("Running pre-publish check", { siteId, keywordCount: targetKeywords.length });

    if (!targetKeywords || targetKeywords.length === 0) {
      return {
        cannibalizationRisk: {
          hasRisk: false,
          conflictingPages: [],
          recommendation: "No keywords provided for cannibalization check",
          riskLevel: "none",
        },
        duplicateContentRisk: false,
        suggestedFocus: [],
        safeToPublish: true,
      };
    }

    try {
      // Check each keyword for existing ranking pages
      const conflicts: CannibalizationConflict[] = [];

      // Fetch all cannibalization issues once
      const detectionResult = await this.cannibalizationService.detect(siteId, { mode: 'stored', persist: false });

      for (const keyword of targetKeywords.slice(0, 10)) {
        // Limit to 10 keywords
        const issue = detectionResult.issues.find(
          i => i.query.toLowerCase() === keyword.toLowerCase()
        );

        if (issue && issue.pages.length > 0) {
          // There's at least one existing page ranking for this keyword
          for (const page of issue.pages) {
            conflicts.push({
              url: page.pageUrl,
              keyword,
              position: page.avgPosition,
              impressions: page.impressions,
              severity: this.mapCannibalizationSeverity(issue.severity),
            });
          }
        }
      }

      // Determine overall risk level
      const hasRisk = conflicts.length > 0;
      let riskLevel: "critical" | "high" | "medium" | "low" | "none" = "none";
      if (conflicts.some((c) => c.severity === "critical")) {
        riskLevel = "critical";
      } else if (conflicts.some((c) => c.severity === "high")) {
        riskLevel = "high";
      } else if (conflicts.some((c) => c.severity === "medium")) {
        riskLevel = "medium";
      } else if (conflicts.length > 0) {
        riskLevel = "low";
      }

      // Generate recommendation
      let recommendation: string;
      if (!hasRisk) {
        recommendation = "No cannibalization risk detected. Safe to proceed.";
      } else if (riskLevel === "critical" || riskLevel === "high") {
        recommendation =
          "High cannibalization risk detected. Consider consolidating content with existing pages or differentiating the focus significantly.";
      } else if (riskLevel === "medium") {
        recommendation =
          "Moderate cannibalization risk. Review existing pages and ensure distinct focus or add canonical tags.";
      } else {
        recommendation =
          "Low cannibalization risk. One existing page dominates, minimal impact expected.";
      }

      // Suggest safe focus keywords (those without conflicts)
      const conflictedKeywords = new Set(conflicts.map((c) => c.keyword.toLowerCase()));
      const suggestedFocus = targetKeywords.filter(
        (k) => !conflictedKeywords.has(k.toLowerCase())
      );

      return {
        cannibalizationRisk: {
          hasRisk,
          conflictingPages: conflicts,
          recommendation,
          riskLevel,
        },
        duplicateContentRisk: false, // Would need content similarity check
        suggestedFocus: suggestedFocus.slice(0, 5),
        safeToPublish: riskLevel === "none" || riskLevel === "low",
      };
    } catch (error) {
      log.error("Failed to run pre-publish check", error instanceof Error ? error : undefined, {
        siteId,
      });
      return {
        cannibalizationRisk: {
          hasRisk: false,
          conflictingPages: [],
          recommendation: "Unable to check cannibalization. Proceed with caution.",
          riskLevel: "none",
        },
        duplicateContentRisk: false,
        suggestedFocus: targetKeywords.slice(0, 5),
        safeToPublish: true,
      };
    }
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  private calculateOpportunity(
    impressions: number,
    changePercent: number
  ): "high" | "medium" | "low" {
    if (impressions > 1000 && changePercent > 20) return "high";
    if (impressions > 500 || changePercent > 10) return "medium";
    return "low";
  }

  private extractKeywordFromUrl(url: string): string {
    try {
      const path = new URL(url).pathname;
      // Remove leading/trailing slashes and file extensions
      const slug = path.replace(/^\/|\/$/g, "").replace(/\.[^/.]+$/, "");
      // Convert slug to words
      return slug.replace(/[-_]/g, " ").split("/").pop() || "untitled";
    } catch {
      return "untitled";
    }
  }

  private extractTitleFromUrl(url: string): string {
    try {
      const path = new URL(url).pathname;
      const slug = path.replace(/^\/|\/$/g, "").replace(/\.[^/.]+$/, "");
      const lastPart = slug.split("/").pop() || "untitled";
      // Capitalize words
      return lastPart
        .replace(/[-_]/g, " ")
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
    } catch {
      return "Untitled Page";
    }
  }

  private estimatePotentialClicks(impressions: number, currentPosition: number): number {
    // CTR estimates if moved to position 3 (~11% CTR)
    const targetCtr = 0.11;
    const currentCtr = this.getEstimatedCtr(currentPosition);
    const potentialClicks = impressions * targetCtr;
    return Math.round(potentialClicks);
  }

  private getEstimatedCtr(position: number): number {
    // AWR CTR benchmarks
    const ctrByPosition: Record<number, number> = {
      1: 0.2786,
      2: 0.1538,
      3: 0.1101,
      4: 0.0804,
      5: 0.0685,
      6: 0.0573,
      7: 0.05,
      8: 0.0447,
      9: 0.0404,
      10: 0.0372,
    };

    const roundedPos = Math.round(Math.min(Math.max(position, 1), 20));
    if (roundedPos <= 10) {
      return ctrByPosition[roundedPos] || 0.037;
    }
    // Positions 11-20 average ~1-2%
    return 0.015;
  }

  private calculateDifficultyFromPosition(position: number): "easy" | "medium" | "hard" {
    if (position <= 13) return "easy";
    if (position <= 17) return "medium";
    return "hard";
  }

  private generateOptimizationActions(position: number): string[] {
    const actions: string[] = [];

    if (position > 15) {
      actions.push("Add target keyword to H1 or H2 heading");
      actions.push("Increase keyword density in first paragraph");
    } else if (position > 12) {
      actions.push("Strengthen keyword presence in opening paragraph");
      actions.push("Add related keyword variations");
    }

    actions.push("Add internal links with keyword anchor text");
    actions.push("Update meta description to include target keyword");

    if (position > 10) {
      actions.push("Consider adding more comprehensive content");
    }

    return actions.slice(0, 4);
  }

  private mapCannibalizationSeverity(
    severity: "critical" | "high" | "medium" | "low"
  ): "critical" | "high" | "medium" | "low" {
    // Pass through 4-tier severity (critical is a valid value now)
    return severity;
  }
}

// =============================================================================
// Singleton & Factory
// =============================================================================

let instance: ContentInsightsService | null = null;

/**
 * Get the singleton ContentInsightsService instance.
 */
export function getContentInsightsService(): ContentInsightsService {
  if (!instance) {
    instance = new ContentInsightsService(
      db,
      getTrendDetectionService(),
      getStrikingDistanceService(),
      getCannibalizationService(),
      new TopicClusterService()
    );
  }
  return instance;
}

/**
 * Reset the singleton instance (for testing).
 */
export function resetContentInsightsService(): void {
  instance = null;
}
