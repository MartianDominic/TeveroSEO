/**
 * TopicClusterService
 * Phase 96-04: Topic Clusters with Hub/Spoke Detection
 *
 * Handles business logic for topic clusters including:
 * - Hub page detection based on internal link analysis
 * - Spoke page identification and linking status
 * - Coverage calculation and gap analysis
 * - Metrics aggregation from GSC data
 */
import {
  TopicClusterRepository,
  type ClusterPageData,
} from "../repositories/TopicClusterRepository";
import type {
  TopicClusterWithPages,
  ClusterCreateInput,
  ClusterDetectionOptions,
  ClusterGapAnalysis,
} from "../types";
import type { AnalyticsTopicCluster } from "@/db/content-intelligence-schema";

export interface CoverageAnalysis {
  coverage: number;
  linkedSpokes: number;
  totalSpokes: number;
  missingLinks: string[];
}

export class TopicClusterService {
  private repo: TopicClusterRepository;

  constructor() {
    this.repo = new TopicClusterRepository();
  }

  /**
   * Create a new topic cluster with hub page
   */
  async createCluster(
    siteId: string,
    input: ClusterCreateInput
  ): Promise<TopicClusterWithPages | null> {
    // Create the cluster
    const cluster = await this.repo.create({
      siteId,
      name: input.name,
      hubPageUrl: input.hubPageUrl,
      hubTopic: input.hubTopic,
      coverage: 0,
      totalClicks: 0,
      totalImpressions: 0,
      avgPosition: null,
      gaps: [],
    });

    // Add the hub page
    await this.repo.addPageToCluster(
      cluster.id,
      input.hubPageUrl,
      input.hubTopic,
      true, // isHub
      false, // linksToHub (hub doesn't link to itself)
      0 // internalLinkCount will be updated later
    );

    return this.getClusterWithPages(cluster.id, siteId);
  }

  /**
   * Get all clusters for a site
   */
  async getClusters(siteId: string): Promise<TopicClusterWithPages[]> {
    const clusters = await this.repo.findBySiteId(siteId);
    const results: TopicClusterWithPages[] = [];

    for (const cluster of clusters) {
      const withPages = await this.getClusterWithPages(cluster.id, siteId);
      if (withPages) {
        results.push(withPages);
      }
    }

    return results;
  }

  /**
   * Get a single cluster with all pages
   */
  async getClusterWithPages(
    clusterId: string,
    _siteId: string
  ): Promise<TopicClusterWithPages | null> {
    const cluster = await this.repo.findById(clusterId);
    if (!cluster) return null;

    const pages = await this.repo.getClusterPages(clusterId);

    // Find hub page
    const hubPageData = pages.find((p) => p.isHub);
    if (!hubPageData) {
      // If no hub found, use cluster's hubPageUrl
      return this.buildClusterResponse(cluster, [], null);
    }

    // Get spoke pages (non-hub)
    const spokePages = pages.filter((p) => !p.isHub);

    return this.buildClusterResponse(cluster, spokePages, hubPageData);
  }

  /**
   * Detect potential hub pages based on internal link analysis
   */
  async detectHubPages(
    siteId: string,
    options: ClusterDetectionOptions = {}
  ): Promise<
    Array<{
      pageUrl: string;
      internalLinks: number;
      clicks: number;
      impressions: number;
      position: number;
    }>
  > {
    const minHubLinks = options.minHubLinks ?? 10;
    return this.repo.findPotentialHubs(siteId, minHubLinks);
  }

  /**
   * Analyze cluster coverage (% of spokes linking to hub)
   */
  async analyzeClusterCoverage(
    clusterId: string,
    _siteId: string
  ): Promise<CoverageAnalysis> {
    const cluster = await this.repo.findById(clusterId);
    if (!cluster) {
      return { coverage: 0, linkedSpokes: 0, totalSpokes: 0, missingLinks: [] };
    }

    const pages = await this.repo.getClusterPages(clusterId);
    const spokePages = pages.filter((p) => !p.isHub);

    if (spokePages.length === 0) {
      return { coverage: 100, linkedSpokes: 0, totalSpokes: 0, missingLinks: [] };
    }

    const linkedSpokes = spokePages.filter((p) => p.linksToHub);
    const missingLinks = spokePages
      .filter((p) => !p.linksToHub)
      .map((p) => p.pageUrl);

    const coverage = (linkedSpokes.length / spokePages.length) * 100;

    return {
      coverage: Math.round(coverage * 100) / 100,
      linkedSpokes: linkedSpokes.length,
      totalSpokes: spokePages.length,
      missingLinks,
    };
  }

  /**
   * Get cluster gaps (missing subtopics)
   */
  async getClusterGaps(
    clusterId: string,
    _siteId: string
  ): Promise<ClusterGapAnalysis> {
    const cluster = await this.repo.findById(clusterId);
    if (!cluster) {
      return {
        clusterId,
        clusterName: "",
        coverage: 0,
        gaps: [],
        recommendations: [],
      };
    }

    const coverage = await this.analyzeClusterCoverage(clusterId, _siteId);

    // Gaps are stored on the cluster (could be AI-generated or manual)
    const gaps = cluster.gaps || [];

    // Generate recommendations from gaps
    const recommendations = gaps.map((gap) => ({
      subtopic: gap,
      suggestedTitle: this.generateSuggestedTitle(cluster.hubTopic, gap),
    }));

    return {
      clusterId: cluster.id,
      clusterName: cluster.name,
      coverage: coverage.coverage,
      gaps,
      recommendations,
    };
  }

  /**
   * Update cluster metrics from GSC data
   */
  async updateClusterMetrics(clusterId: string, siteId: string): Promise<void> {
    const cluster = await this.repo.findById(clusterId);
    if (!cluster) return;

    const pages = await this.repo.getClusterPages(clusterId);

    // Calculate totals
    const totalClicks = pages.reduce((sum, p) => sum + p.clicks, 0);
    const totalImpressions = pages.reduce((sum, p) => sum + p.impressions, 0);

    // Calculate weighted average position
    const pagesWithPosition = pages.filter(
      (p) => p.position !== null && p.impressions > 0
    );
    const avgPosition =
      pagesWithPosition.length > 0
        ? pagesWithPosition.reduce(
            (sum, p) => sum + (p.position ?? 0) * p.impressions,
            0
          ) / pagesWithPosition.reduce((sum, p) => sum + p.impressions, 0)
        : null;

    // Calculate coverage
    const coverage = await this.analyzeClusterCoverage(clusterId, siteId);

    await this.repo.updateClusterMetrics(clusterId, {
      totalClicks,
      totalImpressions,
      avgPosition,
      coverage: coverage.coverage,
    });
  }

  /**
   * Add a spoke page to a cluster
   */
  async addSpokeToCluster(
    clusterId: string,
    pageUrl: string,
    topic: string | null,
    linksToHub: boolean = false
  ): Promise<void> {
    await this.repo.addPageToCluster(
      clusterId,
      pageUrl,
      topic,
      false, // isHub
      linksToHub
    );
  }

  /**
   * Remove a spoke page from a cluster
   */
  async removeSpokeFromCluster(
    clusterId: string,
    pageUrl: string
  ): Promise<void> {
    await this.repo.removePageFromCluster(clusterId, pageUrl);
  }

  /**
   * Update cluster gaps
   */
  async updateClusterGaps(clusterId: string, gaps: string[]): Promise<void> {
    await this.repo.update(clusterId, { gaps });
  }

  /**
   * Delete a cluster
   */
  async deleteCluster(clusterId: string): Promise<boolean> {
    return this.repo.delete(clusterId);
  }

  /**
   * Build the full cluster response with pages
   */
  private buildClusterResponse(
    cluster: AnalyticsTopicCluster,
    spokePages: ClusterPageData[],
    hubPageData: ClusterPageData | null
  ): TopicClusterWithPages {
    const hubPage = hubPageData
      ? {
          url: hubPageData.pageUrl,
          topic: hubPageData.pageTopic || cluster.hubTopic,
          title: undefined,
          clicks: hubPageData.clicks,
          impressions: hubPageData.impressions,
          position: hubPageData.position ?? 0,
          internalLinks: hubPageData.internalLinkCount,
        }
      : {
          url: cluster.hubPageUrl,
          topic: cluster.hubTopic,
          title: undefined,
          clicks: 0,
          impressions: 0,
          position: 0,
          internalLinks: 0,
        };

    const spokes = spokePages.map((p) => ({
      url: p.pageUrl,
      topic: p.pageTopic,
      title: undefined,
      linksToHub: p.linksToHub,
      internalLinkCount: p.internalLinkCount,
      clicks: p.clicks,
      impressions: p.impressions,
      position: p.position,
    }));

    return {
      id: cluster.id,
      siteId: cluster.siteId,
      name: cluster.name,
      hubPage,
      spokePages: spokes,
      coverage: cluster.coverage ?? 0,
      gaps: cluster.gaps || [],
      totalClicks: cluster.totalClicks ?? 0,
      totalImpressions: cluster.totalImpressions ?? 0,
      avgPosition: cluster.avgPosition ?? 0,
      lastAnalyzedAt: cluster.lastAnalyzedAt,
      createdAt: cluster.createdAt,
      updatedAt: cluster.updatedAt,
    };
  }

  /**
   * Generate a suggested title for a gap subtopic
   */
  private generateSuggestedTitle(_hubTopic: string, subtopic: string): string {
    // Simple title generation - in production, this could use AI
    const capitalizedSubtopic =
      subtopic.charAt(0).toUpperCase() + subtopic.slice(1);
    return `${capitalizedSubtopic}: A Complete Guide`;
  }
}
