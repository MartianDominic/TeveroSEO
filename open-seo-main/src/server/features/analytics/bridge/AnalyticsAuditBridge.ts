/**
 * AnalyticsAuditBridge
 * Phase 40: Cross-module integration between P92 audit checks and P96 analytics data
 *
 * This service acts as a facade that exposes P96 analytics data in a format
 * suitable for P92 audit checks. It handles:
 * - Data transformation from analytics services to audit-friendly structures
 * - Caching during audit runs to avoid repeated queries (Redis-backed for multi-worker support)
 * - Scoring calculations for audit results
 * - Recommendation generation
 *
 * OPS-01 FIX: Migrated from in-memory Map to Redis caching to support multi-worker
 * audit scenarios where different workers may need to share cached analytics data.
 * Cache keys are scoped to audit runs: audit:{auditId}:{dataType}:{entityId}
 */

import { TopicClusterService } from "../services/TopicClusterService";
import { StrikingDistanceService, getStrikingDistanceService } from "../services/StrikingDistanceService";
import {
  CannibalizationService,
  getCannibalizationService,
  type CannibalizationIssue,
} from "../services/CannibalizationService";
import { TrendDetectionService, getTrendDetectionService } from "../services/TrendDetectionService";
import { createLogger } from "@/server/lib/logger";
import { ANALYTICS_CACHE_TTL_SECONDS } from "@/server/cache";
import { redis, isCircuitBreakerClosed } from "@/server/lib/redis";
import type {
  TopicCoverageAuditData,
  ContentGapAuditData,
  CannibalizationAuditData,
  HubSpokeLinkingAuditData,
  ClusterSizeAuditData,
  TrendAuditData,
  StrikingDistanceAuditData,
  TrendingPageSummary,
  StrikingDistanceKeywordSummary,
  AuditRecommendation,
  TopicClusterSummary,
  StrikingKeywordSummary,
  CannibalizationSummary,
  RecommendationPriority,
  AnalyticsAuditContext,
} from "./types";
import type { TopicClusterWithPages, StrikingDistancePage, TrendAnalysis } from "../types";

const logger = createLogger({ module: "analytics-audit-bridge" });

/**
 * Target range for spokes per cluster (T4-05)
 */
const CLUSTER_SIZE_TARGET = {
  min: 15,
  max: 25,
};

/**
 * TTL for audit-scoped Redis cache (1 hour).
 * Audits should complete within this time; data is shared across workers.
 */
const AUDIT_CACHE_TTL_SECONDS = 3600;

/**
 * Cache entry with timestamp for expiration (in-memory fallback)
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * AnalyticsAuditBridge provides audit-friendly access to P96 analytics data.
 *
 * OPS-01 FIX: Now uses Redis for caching to support multi-worker audit scenarios.
 * Cache keys are scoped to audit runs: audit:{auditId}:{dataType}:{entityId}
 * Falls back to in-memory Map if Redis is unavailable.
 *
 * Usage:
 * ```typescript
 * const bridge = getAnalyticsAuditBridge();
 * // With audit ID (recommended for multi-worker scenarios)
 * const topicData = await bridge.getTopicCoverageData(siteId, auditId);
 * // Without audit ID (uses in-memory fallback)
 * const hubSpokeData = await bridge.getHubSpokeLinkingData(siteId, pageUrl);
 * // Cleanup after audit completes
 * await bridge.cleanupAuditCache(auditId);
 * ```
 */
export class AnalyticsAuditBridge {
  /** In-memory fallback cache for when Redis is unavailable */
  private memoryCache: Map<string, CacheEntry<unknown>> = new Map();
  /** Use shared analytics cache TTL for consistency (converted to milliseconds) */
  private cacheTimeoutMs = ANALYTICS_CACHE_TTL_SECONDS * 1000;
  /** Track if Redis is available for caching */
  private redisAvailable = true;

  constructor(
    private topicClusterService: TopicClusterService,
    private strikingDistanceService: StrikingDistanceService,
    private cannibalizationService: CannibalizationService,
    private trendDetectionService: TrendDetectionService
  ) {}

  /**
   * Get topic coverage data for T4 checks.
   * Returns cluster information with coverage scores and recommendations.
   *
   * @param siteId - Site UUID
   * @param auditId - Optional audit ID for Redis-based cross-worker caching
   */
  async getTopicCoverageData(siteId: string, auditId?: string): Promise<TopicCoverageAuditData> {
    const cacheKey = `topic:${siteId}`;
    const cached = await this.getFromCache<TopicCoverageAuditData>(cacheKey, auditId);
    if (cached) {
      logger.debug("Topic coverage data served from cache", { siteId, auditId });
      return cached;
    }

    logger.info("Fetching topic coverage data for audit", { siteId });

    try {
      const clusters = await this.topicClusterService.getClusters(siteId);

      // Transform to audit format
      const clusterSummaries = clusters.map((c) => this.transformClusterToSummary(c));

      const coveredClusters = clusterSummaries.filter((c) => c.spokeCount > 0).length;
      const gapClusters = clusterSummaries.filter((c) => c.spokeCount === 0);

      const result: TopicCoverageAuditData = {
        totalClusters: clusters.length,
        coveredClusters,
        gapClusters,
        coverageScore: this.calculateCoverageScore(clusters.length, coveredClusters),
        clusters: clusterSummaries,
        recommendations: this.generateTopicRecommendations(clusterSummaries),
      };

      await this.setCache(cacheKey, result, auditId);
      return result;
    } catch (error) {
      logger.error("Failed to get topic coverage data", error instanceof Error ? error : undefined, { siteId, auditId });
      // Return empty data structure rather than throwing
      return {
        totalClusters: 0,
        coveredClusters: 0,
        gapClusters: [],
        coverageScore: 100, // No clusters = nothing to penalize
        clusters: [],
        recommendations: [],
      };
    }
  }

  /**
   * Get hub-spoke linking data for a specific page.
   * Used by T4-03 (pillar links to spokes) and T4-04 (spokes link to pillar).
   *
   * @param siteId - Site UUID
   * @param pageUrl - Page URL to analyze
   * @param auditId - Optional audit ID for Redis-based cross-worker caching
   */
  async getHubSpokeLinkingData(
    siteId: string,
    pageUrl: string,
    auditId?: string
  ): Promise<HubSpokeLinkingAuditData> {
    const cacheKey = `hubspoke:${siteId}:${pageUrl}`;
    const cached = await this.getFromCache<HubSpokeLinkingAuditData>(cacheKey, auditId);
    if (cached) {
      return cached;
    }

    logger.debug("Fetching hub-spoke linking data", { siteId, pageUrl });

    try {
      const clusters = await this.topicClusterService.getClusters(siteId);

      // Find if this page is a hub or spoke in any cluster
      for (const cluster of clusters) {
        // Check if page is the hub
        if (cluster.hubPage.url === pageUrl) {
          const linkedSpokes = cluster.spokePages
            .filter((s) => s.linksToHub)
            .map((s) => s.url);
          const missingSpokes = cluster.spokePages
            .filter((s) => !s.linksToHub)
            .map((s) => s.url);

          const result: HubSpokeLinkingAuditData = {
            pageUrl,
            isHub: true,
            isSpoke: false,
            linkedSpokes,
            missingSpokes,
            clusterId: cluster.id,
            clusterName: cluster.name,
            linkingScore: this.calculateHubLinkingScore(linkedSpokes.length, cluster.spokePages.length),
          };

          await this.setCache(cacheKey, result, auditId);
          return result;
        }

        // Check if page is a spoke
        const spoke = cluster.spokePages.find((s) => s.url === pageUrl);
        if (spoke) {
          const result: HubSpokeLinkingAuditData = {
            pageUrl,
            isHub: false,
            isSpoke: true,
            linksToHub: spoke.linksToHub,
            hubPageUrl: cluster.hubPage.url,
            clusterId: cluster.id,
            clusterName: cluster.name,
            linkingScore: spoke.linksToHub ? 100 : 0,
          };

          await this.setCache(cacheKey, result, auditId);
          return result;
        }
      }

      // Page not part of any cluster
      const result: HubSpokeLinkingAuditData = {
        pageUrl,
        isHub: false,
        isSpoke: false,
        linkingScore: 100, // Not applicable, don't penalize
      };

      await this.setCache(cacheKey, result, auditId);
      return result;
    } catch (error) {
      logger.error("Failed to get hub-spoke linking data", error instanceof Error ? error : undefined, {
        siteId,
        pageUrl,
      });
      return {
        pageUrl,
        isHub: false,
        isSpoke: false,
        linkingScore: 100,
      };
    }
  }

  /**
   * Get cluster size data for T4-05 check.
   * Validates that clusters have 15-25 spokes.
   *
   * @param siteId - Site UUID
   * @param pageUrl - Page URL to analyze
   * @param auditId - Optional audit ID for Redis-based cross-worker caching
   */
  async getClusterSizeData(
    siteId: string,
    pageUrl: string,
    auditId?: string
  ): Promise<ClusterSizeAuditData | null> {
    const cacheKey = `clustersize:${siteId}:${pageUrl}`;
    const cached = await this.getFromCache<ClusterSizeAuditData | null>(cacheKey, auditId);
    if (cached !== undefined) {
      return cached;
    }

    logger.debug("Fetching cluster size data", { siteId, pageUrl });

    try {
      const clusters = await this.topicClusterService.getClusters(siteId);

      // Find the cluster containing this page
      for (const cluster of clusters) {
        if (
          cluster.hubPage.url === pageUrl ||
          cluster.spokePages.some((s) => s.url === pageUrl)
        ) {
          const spokeCount = cluster.spokePages.length;
          const withinRange =
            spokeCount >= CLUSTER_SIZE_TARGET.min &&
            spokeCount <= CLUSTER_SIZE_TARGET.max;

          let suggestion: ClusterSizeAuditData["suggestion"];
          if (spokeCount < CLUSTER_SIZE_TARGET.min) {
            suggestion = "add_content";
          } else if (spokeCount > CLUSTER_SIZE_TARGET.max) {
            suggestion = "consider_splitting";
          } else {
            suggestion = "optimal";
          }

          const result: ClusterSizeAuditData = {
            clusterId: cluster.id,
            clusterName: cluster.name,
            spokeCount,
            targetMin: CLUSTER_SIZE_TARGET.min,
            targetMax: CLUSTER_SIZE_TARGET.max,
            withinRange,
            suggestion,
            sizeScore: this.calculateClusterSizeScore(spokeCount),
          };

          await this.setCache(cacheKey, result, auditId);
          return result;
        }
      }

      // Page not in any cluster
      await this.setCache(cacheKey, null, auditId);
      return null;
    } catch (error) {
      logger.error("Failed to get cluster size data", error instanceof Error ? error : undefined, {
        siteId,
        pageUrl,
      });
      return null;
    }
  }

  /**
   * Get content gap data from striking distance analysis.
   *
   * @param siteId - Site UUID
   * @param auditId - Optional audit ID for Redis-based cross-worker caching
   */
  async getContentGapData(siteId: string, auditId?: string): Promise<ContentGapAuditData> {
    const cacheKey = `gap:${siteId}`;
    const cached = await this.getFromCache<ContentGapAuditData>(cacheKey, auditId);
    if (cached) {
      logger.debug("Content gap data served from cache", { siteId, auditId });
      return cached;
    }

    logger.info("Fetching content gap data for audit", { siteId });

    try {
      const strikingCached = await this.strikingDistanceService.getStrikingDistancePages(
        siteId,
        {
          minPosition: 11,
          maxPosition: 20,
          minImpressions: 50,
          limit: 200,
        }
      );

      // Extract data from CachedData wrapper
      const strikingResult = strikingCached.data;

      // Transform to audit format
      const summaries = strikingResult.pages.map((p: StrikingDistancePage) =>
        this.transformStrikingToSummary(p)
      );

      const highValueOpportunities = summaries.filter((s: StrikingKeywordSummary) => s.impressions > 500);
      const quickWins = summaries.filter(
        (s: StrikingKeywordSummary) => s.avgPosition <= 15 && s.difficulty === "easy"
      );

      const result: ContentGapAuditData = {
        strikingDistanceCount: summaries.length,
        highValueOpportunities,
        quickWins,
        gapScore: this.calculateGapScore(summaries),
        totalPotentialClicks: strikingResult.meta.totalPotentialClicks,
        recommendations: this.generateGapRecommendations(summaries),
      };

      await this.setCache(cacheKey, result, auditId);
      return result;
    } catch (error) {
      logger.error("Failed to get content gap data", error instanceof Error ? error : undefined, { siteId, auditId });
      return {
        strikingDistanceCount: 0,
        highValueOpportunities: [],
        quickWins: [],
        gapScore: 100,
        totalPotentialClicks: 0,
        recommendations: [],
      };
    }
  }

  /**
   * Get trend data for T4-08 check.
   * Analyzes growing/decaying pages over 3-week rolling window.
   *
   * @param siteId - Site UUID
   * @param auditId - Optional audit ID for Redis-based cross-worker caching
   */
  async getTrendData(siteId: string, auditId?: string): Promise<TrendAuditData> {
    const cacheKey = `trend:${siteId}`;
    const cached = await this.getFromCache<TrendAuditData>(cacheKey, auditId);
    if (cached) {
      logger.debug("Trend data served from cache", { siteId, auditId });
      return cached;
    }

    logger.info("Fetching trend data for audit", { siteId });

    try {
      const trendResult = await this.trendDetectionService.analyzePageTrends(
        siteId,
        {
          periodDays: 21,
          threshold: 0.10,
          minImpressions: 100,
          trend: "all",
        }
      );

      // Extract data from CachedData wrapper
      const trendData = trendResult.data;

      // Transform to audit format
      const decayingPages = trendData.pages
        .filter((p: TrendAnalysis) => p.trend === "decaying")
        .map((p: TrendAnalysis) => this.transformTrendToSummary(p));

      const growingPages = trendData.pages
        .filter((p: TrendAnalysis) => p.trend === "growing")
        .map((p: TrendAnalysis) => this.transformTrendToSummary(p));

      // Calculate net trend score (-100 to 100)
      const netTrend = this.calculateNetTrendScore(
        trendData.meta.growingCount,
        trendData.meta.decayingCount,
        trendData.meta.totalAnalyzed
      );

      const result: TrendAuditData = {
        decayingPages,
        growingPages,
        netTrend,
        totalPagesAnalyzed: trendData.meta.totalAnalyzed,
        periodDays: trendData.meta.periodDays,
        threshold: trendData.meta.threshold,
        recommendations: this.generateTrendRecommendations(decayingPages, growingPages),
      };

      await this.setCache(cacheKey, result, auditId);
      return result;
    } catch (error) {
      logger.error("Failed to get trend data", error instanceof Error ? error : undefined, { siteId, auditId });
      return {
        decayingPages: [],
        growingPages: [],
        netTrend: 0,
        totalPagesAnalyzed: 0,
        periodDays: 21,
        threshold: 0.10,
        recommendations: [],
      };
    }
  }

  /**
   * Get striking distance data for T4-09 check.
   * Identifies pages ranking on page 2 with optimization opportunities.
   *
   * @param siteId - Site UUID
   * @param auditId - Optional audit ID for Redis-based cross-worker caching
   */
  async getStrikingDistanceData(siteId: string, auditId?: string): Promise<StrikingDistanceAuditData> {
    const cacheKey = `strikingaudit:${siteId}`;
    const cached = await this.getFromCache<StrikingDistanceAuditData>(cacheKey, auditId);
    if (cached) {
      logger.debug("Striking distance audit data served from cache", { siteId, auditId });
      return cached;
    }

    logger.info("Fetching striking distance data for audit", { siteId });

    try {
      const strikingCached = await this.strikingDistanceService.getStrikingDistancePages(
        siteId,
        {
          minPosition: 11,
          maxPosition: 20,
          minImpressions: 50,
          targetPosition: 3,
          limit: 200,
        }
      );

      // Extract data from CachedData wrapper
      const strikingResult = strikingCached.data;

      // Transform to audit format
      const keywords = strikingResult.pages.map((p: StrikingDistancePage) =>
        this.transformStrikingToAuditSummary(p)
      );

      const quickWins = keywords.filter(
        (k: StrikingDistanceKeywordSummary) => k.difficulty === "easy" && k.impressions > 100
      );
      const highValueOpportunities = keywords.filter(
        (k: StrikingDistanceKeywordSummary) => k.impressions > 500
      );

      const result: StrikingDistanceAuditData = {
        keywords,
        totalOpportunities: keywords.length,
        estimatedTrafficGain: strikingResult.meta.totalPotentialClicks,
        quickWins,
        highValueOpportunities,
        recommendations: this.generateStrikingDistanceRecommendations(keywords, quickWins, highValueOpportunities),
      };

      await this.setCache(cacheKey, result, auditId);
      return result;
    } catch (error) {
      logger.error("Failed to get striking distance data", error instanceof Error ? error : undefined, { siteId, auditId });
      return {
        keywords: [],
        totalOpportunities: 0,
        estimatedTrafficGain: 0,
        quickWins: [],
        highValueOpportunities: [],
        recommendations: [],
      };
    }
  }

  /**
   * Get cannibalization data for audit scoring.
   *
   * @param siteId - Site UUID
   * @param auditId - Optional audit ID for Redis-based cross-worker caching
   */
  async getCannibalizationData(siteId: string, auditId?: string): Promise<CannibalizationAuditData> {
    const cacheKey = `cannibal:${siteId}`;
    const cached = await this.getFromCache<CannibalizationAuditData>(cacheKey, auditId);
    if (cached) {
      logger.debug("Cannibalization data served from cache", { siteId, auditId });
      return cached;
    }

    logger.info("Fetching cannibalization data for audit", { siteId });

    try {
      const detectionResult = await this.cannibalizationService.detect(siteId, {
        mode: "stored",
        limit: 500,
        persist: false,
      });

      const summaries = detectionResult.issues.map((i) =>
        this.transformCannibalizationToSummary(i)
      );

      const criticalIssues = summaries.filter((s) => s.severity === "critical");
      const highIssues = summaries.filter((s) => s.severity === "high");
      const moderateIssues = summaries.filter((s) => s.severity === "medium");
      const lowIssues = summaries.filter((s) => s.severity === "low");

      const result: CannibalizationAuditData = {
        totalIssues: summaries.length,
        criticalIssues,
        highIssues,
        moderateIssues,
        lowIssues,
        cannibalizationScore: this.calculateCannibalizationScore(summaries),
        totalMonthlyImpact: detectionResult.summary.totalMonthlyImpact,
        recommendations: this.generateCannibalizationRecommendations(summaries),
      };

      await this.setCache(cacheKey, result, auditId);
      return result;
    } catch (error) {
      logger.error("Failed to get cannibalization data", error instanceof Error ? error : undefined, { siteId, auditId });
      return {
        totalIssues: 0,
        criticalIssues: [],
        highIssues: [],
        moderateIssues: [],
        lowIssues: [],
        cannibalizationScore: 100,
        totalMonthlyImpact: 0,
        recommendations: [],
      };
    }
  }

  /**
   * Get all analytics data as a combined context for audit checks.
   *
   * @param siteId - Site UUID
   * @param pageUrl - Optional page URL for page-specific data
   * @param auditId - Optional audit ID for Redis-based cross-worker caching
   */
  async getFullAuditContext(
    siteId: string,
    pageUrl?: string,
    auditId?: string
  ): Promise<AnalyticsAuditContext> {
    const [topicCoverage, contentGaps, cannibalization] = await Promise.all([
      this.getTopicCoverageData(siteId, auditId),
      this.getContentGapData(siteId, auditId),
      this.getCannibalizationData(siteId, auditId),
    ]);

    let hubSpokeLinking: HubSpokeLinkingAuditData | undefined;
    let clusterSize: ClusterSizeAuditData | null | undefined;

    if (pageUrl) {
      [hubSpokeLinking, clusterSize] = await Promise.all([
        this.getHubSpokeLinkingData(siteId, pageUrl, auditId),
        this.getClusterSizeData(siteId, pageUrl, auditId),
      ]);
    }

    return {
      topicCoverage,
      contentGaps,
      cannibalization,
      hubSpokeLinking,
      clusterSize: clusterSize ?? undefined,
      hasAnalyticsData:
        topicCoverage.totalClusters > 0 ||
        contentGaps.strikingDistanceCount > 0 ||
        cannibalization.totalIssues > 0,
      lastSyncAt: new Date(),
    };
  }

  /**
   * Generate all recommendations from analytics data.
   *
   * @param siteId - Site UUID
   * @param auditId - Optional audit ID for Redis-based cross-worker caching
   */
  async generateRecommendations(siteId: string, auditId?: string): Promise<AuditRecommendation[]> {
    const [topicData, gapData, cannibData] = await Promise.all([
      this.getTopicCoverageData(siteId, auditId),
      this.getContentGapData(siteId, auditId),
      this.getCannibalizationData(siteId, auditId),
    ]);

    return [
      ...topicData.recommendations,
      ...gapData.recommendations,
      ...cannibData.recommendations,
    ].sort((a, b) => {
      const priorityOrder: Record<RecommendationPriority, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Clear the in-memory cache (useful at the end of an audit run).
   * For Redis-based cache, use cleanupAuditCache(auditId) instead.
   */
  clearCache(): void {
    this.memoryCache.clear();
    logger.debug("Analytics audit bridge in-memory cache cleared");
  }

  /**
   * Clean up Redis cache for a specific audit run.
   * Call this when an audit completes to free Redis memory.
   *
   * @param auditId - The audit ID whose cache entries should be deleted
   * @returns Number of keys deleted
   */
  async cleanupAuditCache(auditId: string): Promise<number> {
    if (!auditId) {
      logger.warn("cleanupAuditCache called without auditId");
      return 0;
    }

    try {
      const pattern = `audit:${auditId}:*`;
      const keys = await redis.keys(pattern);

      if (keys.length > 0) {
        await redis.del(...keys);
        logger.info("Audit cache cleaned up", { auditId, keysDeleted: keys.length });
      }

      return keys.length;
    } catch (error) {
      logger.warn("Failed to cleanup audit cache", {
        auditId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  // ============================================================================
  // Private: Cache Management (Redis with in-memory fallback)
  // ============================================================================

  /**
   * Build a cache key for Redis or in-memory storage.
   * If auditId is provided, uses audit-scoped Redis key format.
   * Otherwise uses the simple key for in-memory fallback.
   */
  private buildCacheKey(key: string, auditId?: string): string {
    if (auditId) {
      return `audit:${auditId}:${key}`;
    }
    return key;
  }

  /**
   * Get data from cache (Redis first, then in-memory fallback).
   */
  private async getFromCache<T>(key: string, auditId?: string): Promise<T | undefined> {
    // If auditId provided and Redis is available, try Redis first
    if (auditId && this.redisAvailable && isCircuitBreakerClosed()) {
      try {
        const redisKey = this.buildCacheKey(key, auditId);
        const cached = await redis.get(redisKey);

        if (cached) {
          logger.debug("Cache hit (Redis)", { key: redisKey });
          return JSON.parse(cached) as T;
        }

        logger.debug("Cache miss (Redis)", { key: redisKey });
        return undefined;
      } catch (error) {
        logger.warn("Redis cache get failed, falling back to in-memory", {
          key,
          auditId,
          error: error instanceof Error ? error.message : String(error),
        });
        this.redisAvailable = false;
        // Fall through to in-memory cache
      }
    }

    // In-memory fallback (when no auditId or Redis unavailable)
    const entry = this.memoryCache.get(key) as CacheEntry<T> | undefined;
    if (!entry) return undefined;

    if (Date.now() - entry.timestamp > this.cacheTimeoutMs) {
      this.memoryCache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  /**
   * Set data in cache (Redis first, then in-memory fallback).
   */
  private async setCache<T>(key: string, data: T, auditId?: string): Promise<void> {
    // If auditId provided and Redis is available, use Redis
    if (auditId && this.redisAvailable && isCircuitBreakerClosed()) {
      try {
        const redisKey = this.buildCacheKey(key, auditId);
        await redis.setex(redisKey, AUDIT_CACHE_TTL_SECONDS, JSON.stringify(data));
        logger.debug("Cache set (Redis)", { key: redisKey, ttl: AUDIT_CACHE_TTL_SECONDS });
        return;
      } catch (error) {
        logger.warn("Redis cache set failed, falling back to in-memory", {
          key,
          auditId,
          error: error instanceof Error ? error.message : String(error),
        });
        this.redisAvailable = false;
        // Fall through to in-memory cache
      }
    }

    // In-memory fallback (when no auditId or Redis unavailable)
    this.memoryCache.set(key, { data, timestamp: Date.now() });
  }

  // ============================================================================
  // Private: Data Transformations
  // ============================================================================

  private transformClusterToSummary(cluster: TopicClusterWithPages): TopicClusterSummary {
    const spokesWithoutHubLink = cluster.spokePages
      .filter((s) => !s.linksToHub)
      .map((s) => s.url);

    const linkedCount = cluster.spokePages.filter((s) => s.linksToHub).length;
    const hubLinkCoverage =
      cluster.spokePages.length > 0
        ? Math.round((linkedCount / cluster.spokePages.length) * 100)
        : 100;

    return {
      id: cluster.id,
      name: cluster.name,
      hubPageUrl: cluster.hubPage.url,
      spokeCount: cluster.spokePages.length,
      hubLinkCoverage,
      spokesWithoutHubLink,
      totalClicks: cluster.totalClicks,
      totalImpressions: cluster.totalImpressions,
      avgPosition: cluster.avgPosition,
      gaps: cluster.gaps,
    };
  }

  private transformStrikingToSummary(page: StrikingDistancePage): StrikingKeywordSummary {
    return {
      pageUrl: page.pageUrl,
      avgPosition: page.avgPosition,
      impressions: page.impressions,
      currentClicks: page.currentClicks,
      potentialClicks: page.potentialClicks,
      clickGain: page.clickGain,
      difficulty: page.difficulty,
      topKeywords: page.topQueries.slice(0, 5).map((q) => q.query),
    };
  }

  private transformCannibalizationToSummary(
    issue: CannibalizationIssue
  ): CannibalizationSummary {
    return {
      keyword: issue.query,
      competingPageCount: issue.pages.length,
      competingUrls: issue.pages.map((p) => p.pageUrl),
      severity: issue.severity,
      monthlyLostClicks: issue.impactEstimate.monthlyLostClicks,
      recommendedPrimaryPage: issue.recommendation.primaryPage,
      recommendedAction: issue.recommendation.action,
    };
  }

  private transformTrendToSummary(page: TrendAnalysis): TrendingPageSummary {
    return {
      pageUrl: page.pageUrl,
      changePercent: page.changePercent,
      currentClicks: page.currentClicks,
      previousClicks: page.previousClicks,
      currentPosition: page.currentPosition,
      positionChange: page.currentPosition - page.previousPosition,
      topKeywords: page.topQueries.slice(0, 5),
      confidence: page.confidence,
    };
  }

  private transformStrikingToAuditSummary(page: StrikingDistancePage): StrikingDistanceKeywordSummary {
    return {
      pageUrl: page.pageUrl,
      avgPosition: page.avgPosition,
      impressions: page.impressions,
      currentClicks: page.currentClicks,
      potentialClicks: page.potentialClicks,
      clickGain: page.clickGain,
      difficulty: page.difficulty,
      topKeywords: page.topQueries.slice(0, 5).map((q) => q.query),
    };
  }

  // ============================================================================
  // Private: Score Calculations
  // ============================================================================

  private calculateCoverageScore(totalClusters: number, coveredClusters: number): number {
    if (totalClusters === 0) return 100;
    return Math.round((coveredClusters / totalClusters) * 100);
  }

  private calculateHubLinkingScore(linkedSpokes: number, totalSpokes: number): number {
    if (totalSpokes === 0) return 100;
    return Math.round((linkedSpokes / totalSpokes) * 100);
  }

  private calculateClusterSizeScore(spokeCount: number): number {
    if (spokeCount >= CLUSTER_SIZE_TARGET.min && spokeCount <= CLUSTER_SIZE_TARGET.max) {
      return 100;
    }
    if (spokeCount < CLUSTER_SIZE_TARGET.min) {
      // Penalty for undersized clusters
      const deficit = CLUSTER_SIZE_TARGET.min - spokeCount;
      return Math.max(0, 100 - deficit * 5);
    }
    // Penalty for oversized clusters
    const excess = spokeCount - CLUSTER_SIZE_TARGET.max;
    return Math.max(0, 100 - excess * 3);
  }

  private calculateGapScore(summaries: StrikingKeywordSummary[]): number {
    // Fewer striking distance pages = better score (content is already optimized)
    // Score decreases as opportunities increase
    if (summaries.length === 0) return 100;
    if (summaries.length <= 10) return 90;
    if (summaries.length <= 25) return 75;
    if (summaries.length <= 50) return 60;
    if (summaries.length <= 100) return 40;
    return 20;
  }

  private calculateCannibalizationScore(summaries: CannibalizationSummary[]): number {
    if (summaries.length === 0) return 100;

    // Weight by severity
    const criticalCount = summaries.filter((s) => s.severity === "critical").length;
    const highCount = summaries.filter((s) => s.severity === "high").length;
    const mediumCount = summaries.filter((s) => s.severity === "medium").length;

    // Deduct points based on severity
    const deduction = criticalCount * 15 + highCount * 8 + mediumCount * 3;
    return Math.max(0, 100 - deduction);
  }

  /**
   * Calculate net trend score from -100 (all decaying) to +100 (all growing).
   */
  private calculateNetTrendScore(
    growingCount: number,
    decayingCount: number,
    totalAnalyzed: number
  ): number {
    if (totalAnalyzed === 0) return 0;
    const netChange = growingCount - decayingCount;
    return Math.round((netChange / totalAnalyzed) * 100);
  }

  // ============================================================================
  // Private: Recommendation Generation
  // ============================================================================

  private generateTopicRecommendations(
    clusters: TopicClusterSummary[]
  ): AuditRecommendation[] {
    const recommendations: AuditRecommendation[] = [];

    for (const cluster of clusters) {
      // Recommend linking for spokes missing hub links
      if (cluster.spokesWithoutHubLink.length > 0) {
        recommendations.push({
          id: `topic-link-${cluster.id}`,
          priority: cluster.spokesWithoutHubLink.length > 5 ? "high" : "medium",
          category: "hub_spoke_linking",
          title: `Add hub links in "${cluster.name}" cluster`,
          description: `${cluster.spokesWithoutHubLink.length} spoke pages in the "${cluster.name}" cluster are not linking back to the hub page.`,
          action: `Add internal links from spoke pages to the hub page at ${cluster.hubPageUrl}`,
          impact: "medium",
          effort: "low",
          affectedPages: cluster.spokesWithoutHubLink.slice(0, 10),
        });
      }

      // Recommend content for gaps
      if (cluster.gaps.length > 0) {
        recommendations.push({
          id: `topic-gap-${cluster.id}`,
          priority: "medium",
          category: "topic_coverage",
          title: `Fill content gaps in "${cluster.name}" cluster`,
          description: `${cluster.gaps.length} subtopics are missing content in the "${cluster.name}" cluster.`,
          action: `Create content for: ${cluster.gaps.slice(0, 3).join(", ")}`,
          impact: "high",
          effort: "high",
          affectedKeywords: cluster.gaps.slice(0, 10),
        });
      }

      // Recommend cluster optimization for size issues
      if (cluster.spokeCount < CLUSTER_SIZE_TARGET.min) {
        recommendations.push({
          id: `cluster-size-${cluster.id}`,
          priority: "low",
          category: "cluster_size",
          title: `Expand "${cluster.name}" cluster`,
          description: `The cluster has only ${cluster.spokeCount} spoke pages, below the recommended ${CLUSTER_SIZE_TARGET.min}-${CLUSTER_SIZE_TARGET.max} range.`,
          action: `Create ${CLUSTER_SIZE_TARGET.min - cluster.spokeCount} more content pieces for this topic cluster`,
          impact: "medium",
          effort: "high",
        });
      } else if (cluster.spokeCount > CLUSTER_SIZE_TARGET.max) {
        recommendations.push({
          id: `cluster-size-${cluster.id}`,
          priority: "low",
          category: "cluster_size",
          title: `Consider splitting "${cluster.name}" cluster`,
          description: `The cluster has ${cluster.spokeCount} spoke pages, above the recommended maximum of ${CLUSTER_SIZE_TARGET.max}.`,
          action: "Consider creating sub-clusters for better topic organization",
          impact: "low",
          effort: "medium",
        });
      }
    }

    return recommendations;
  }

  private generateGapRecommendations(
    summaries: StrikingKeywordSummary[]
  ): AuditRecommendation[] {
    const recommendations: AuditRecommendation[] = [];

    // Group quick wins
    const quickWins = summaries.filter(
      (s) => s.difficulty === "easy" && s.clickGain > 50
    );
    if (quickWins.length > 0) {
      const totalPotential = quickWins.reduce((sum, s) => sum + s.clickGain, 0);
      recommendations.push({
        id: "striking-quick-wins",
        priority: "high",
        category: "content_gap",
        title: "Optimize striking distance pages",
        description: `${quickWins.length} pages are close to page 1 and could capture ${totalPotential} additional monthly clicks with minor optimizations.`,
        action: "Add target keywords to titles, improve content depth, and build internal links to these pages",
        impact: "high",
        effort: "low",
        estimatedTrafficImpact: totalPotential,
        affectedPages: quickWins.slice(0, 10).map((s) => s.pageUrl),
        affectedKeywords: quickWins.slice(0, 5).flatMap((s) => s.topKeywords.slice(0, 2)),
      });
    }

    // High value opportunities
    const highValue = summaries.filter((s) => s.impressions > 1000 && s.difficulty !== "hard");
    if (highValue.length > 0) {
      recommendations.push({
        id: "striking-high-value",
        priority: "medium",
        category: "content_gap",
        title: "Prioritize high-impression keywords",
        description: `${highValue.length} pages have high search volume (>1000 impressions) but rank on page 2.`,
        action: "Focus optimization efforts on these high-value opportunities first",
        impact: "high",
        effort: "medium",
        affectedPages: highValue.slice(0, 10).map((s) => s.pageUrl),
      });
    }

    return recommendations;
  }

  private generateCannibalizationRecommendations(
    summaries: CannibalizationSummary[]
  ): AuditRecommendation[] {
    const recommendations: AuditRecommendation[] = [];

    // Group by severity and action type
    const criticalIssues = summaries.filter((s) => s.severity === "critical");
    const consolidationNeeded = summaries.filter((s) => s.recommendedAction === "consolidate");
    const redirectNeeded = summaries.filter((s) => s.recommendedAction === "redirect");

    if (criticalIssues.length > 0) {
      const totalImpact = criticalIssues.reduce(
        (sum, s) => sum + s.monthlyLostClicks,
        0
      );
      recommendations.push({
        id: "cannibal-critical",
        priority: "critical",
        category: "cannibalization",
        title: "Resolve critical keyword cannibalization",
        description: `${criticalIssues.length} keywords have critical cannibalization issues with ${totalImpact} monthly clicks at risk.`,
        action: "Immediately consolidate content or implement canonical tags for these keywords",
        impact: "high",
        effort: "medium",
        estimatedTrafficImpact: totalImpact,
        affectedKeywords: criticalIssues.slice(0, 10).map((s) => s.keyword),
        affectedPages: criticalIssues.slice(0, 5).flatMap((s) => s.competingUrls.slice(0, 2)),
      });
    }

    if (consolidationNeeded.length > 0) {
      recommendations.push({
        id: "cannibal-consolidate",
        priority: "high",
        category: "cannibalization",
        title: "Consolidate competing content",
        description: `${consolidationNeeded.length} keywords need content consolidation to resolve cannibalization.`,
        action: "Merge content from competing pages into primary pages and redirect the deprecated URLs",
        impact: "high",
        effort: "high",
        affectedKeywords: consolidationNeeded.slice(0, 10).map((s) => s.keyword),
      });
    }

    if (redirectNeeded.length > 0 && redirectNeeded.length !== consolidationNeeded.length) {
      recommendations.push({
        id: "cannibal-redirect",
        priority: "medium",
        category: "cannibalization",
        title: "Implement 301 redirects",
        description: `${redirectNeeded.length} keywords can be resolved with simple redirects from secondary to primary pages.`,
        action: "Set up 301 redirects from the lower-performing pages to the primary pages",
        impact: "medium",
        effort: "low",
        affectedKeywords: redirectNeeded.slice(0, 10).map((s) => s.keyword),
      });
    }

    return recommendations;
  }

  private generateTrendRecommendations(
    decayingPages: TrendingPageSummary[],
    growingPages: TrendingPageSummary[]
  ): AuditRecommendation[] {
    const recommendations: AuditRecommendation[] = [];

    // Prioritize decaying pages with high confidence
    const highConfidenceDecaying = decayingPages.filter((p) => p.confidence === "high");
    if (highConfidenceDecaying.length > 0) {
      recommendations.push({
        id: "trend-decay-critical",
        priority: highConfidenceDecaying.length > 10 ? "high" : "medium",
        category: "content_gap",
        title: "Refresh decaying content",
        description: `${highConfidenceDecaying.length} pages have seen significant traffic decline (>${Math.abs(highConfidenceDecaying[0]?.changePercent ?? 10).toFixed(0)}% drop) over the past 3 weeks.`,
        action: "Update content, add fresh information, improve internal linking, and optimize for current search intent",
        impact: "high",
        effort: "medium",
        affectedPages: highConfidenceDecaying.slice(0, 10).map((p) => p.pageUrl),
        affectedKeywords: highConfidenceDecaying.slice(0, 5).flatMap((p) => p.topKeywords.slice(0, 2)),
      });
    }

    // Medium confidence decaying pages
    const mediumConfidenceDecaying = decayingPages.filter((p) => p.confidence === "medium");
    if (mediumConfidenceDecaying.length > 5) {
      recommendations.push({
        id: "trend-decay-monitor",
        priority: "low",
        category: "content_gap",
        title: "Monitor declining pages",
        description: `${mediumConfidenceDecaying.length} pages show early signs of traffic decay. Monitor these pages and consider proactive updates.`,
        action: "Add these pages to a content refresh queue for evaluation",
        impact: "medium",
        effort: "low",
        affectedPages: mediumConfidenceDecaying.slice(0, 10).map((p) => p.pageUrl),
      });
    }

    // Capitalize on growing content
    if (growingPages.length > 0) {
      const topGrowing = growingPages.slice(0, 5);
      recommendations.push({
        id: "trend-grow-capitalize",
        priority: "medium",
        category: "content_gap",
        title: "Capitalize on growing content",
        description: `${growingPages.length} pages are gaining traction. Double down with related content and internal links.`,
        action: "Create supporting content around these topics and strengthen internal linking to these pages",
        impact: "high",
        effort: "medium",
        affectedPages: topGrowing.map((p) => p.pageUrl),
        affectedKeywords: topGrowing.flatMap((p) => p.topKeywords.slice(0, 2)),
      });
    }

    return recommendations;
  }

  private generateStrikingDistanceRecommendations(
    keywords: StrikingDistanceKeywordSummary[],
    quickWins: StrikingDistanceKeywordSummary[],
    highValueOpportunities: StrikingDistanceKeywordSummary[]
  ): AuditRecommendation[] {
    const recommendations: AuditRecommendation[] = [];

    // Quick wins are the highest priority
    if (quickWins.length > 0) {
      const totalPotential = quickWins.reduce((sum, k) => sum + k.clickGain, 0);
      recommendations.push({
        id: "striking-quick-wins",
        priority: "high",
        category: "content_gap",
        title: "Optimize striking distance quick wins",
        description: `${quickWins.length} pages are close to page 1 (positions 11-13) and could capture ${totalPotential} additional monthly clicks with minor optimizations.`,
        action: "Add target keywords to titles, improve content depth, add FAQ schema, and build internal links to these pages",
        impact: "high",
        effort: "low",
        estimatedTrafficImpact: totalPotential,
        affectedPages: quickWins.slice(0, 10).map((k) => k.pageUrl),
        affectedKeywords: quickWins.slice(0, 5).flatMap((k) => k.topKeywords.slice(0, 2)),
      });
    }

    // High value opportunities
    if (highValueOpportunities.length > quickWins.length) {
      const nonQuickWinHighValue = highValueOpportunities.filter(
        (h) => !quickWins.some((q) => q.pageUrl === h.pageUrl)
      );
      if (nonQuickWinHighValue.length > 0) {
        recommendations.push({
          id: "striking-high-value",
          priority: "medium",
          category: "content_gap",
          title: "Prioritize high-volume striking distance pages",
          description: `${nonQuickWinHighValue.length} pages have high search volume (>500 impressions) but rank on page 2.`,
          action: "Focus optimization efforts on these high-value opportunities after quick wins",
          impact: "high",
          effort: "medium",
          affectedPages: nonQuickWinHighValue.slice(0, 10).map((k) => k.pageUrl),
        });
      }
    }

    // General striking distance summary
    if (keywords.length > 20) {
      recommendations.push({
        id: "striking-strategy",
        priority: "low",
        category: "content_gap",
        title: "Develop striking distance optimization strategy",
        description: `${keywords.length} total pages in striking distance. Consider a systematic approach to page-by-page optimization.`,
        action: "Create a content optimization calendar, prioritizing by click potential and difficulty",
        impact: "medium",
        effort: "medium",
      });
    }

    return recommendations;
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let instance: AnalyticsAuditBridge | null = null;

/**
 * Get the singleton AnalyticsAuditBridge instance.
 */
export function getAnalyticsAuditBridge(): AnalyticsAuditBridge {
  if (!instance) {
    instance = new AnalyticsAuditBridge(
      new TopicClusterService(),
      getStrikingDistanceService(),
      getCannibalizationService(),
      getTrendDetectionService()
    );
  }
  return instance;
}

/**
 * Reset the singleton instance (for testing).
 */
export function resetAnalyticsAuditBridge(): void {
  if (instance) {
    instance.clearCache();
  }
  instance = null;
}
