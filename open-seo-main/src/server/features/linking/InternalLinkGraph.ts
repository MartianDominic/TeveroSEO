/**
 * Internal Link Graph with PageRank Authority Calculation.
 * Phase 92-06: Internal Linking PageRank
 *
 * Provides:
 * - PageRank-based authority scoring using ngraph.pagerank
 * - Quality-aware link recommendations
 * - Anchor text diversity analysis
 *
 * Key features:
 * - Damping factor configurable (default 0.85)
 * - Link recommendations filtered by destination quality score
 * - Combined scoring: relevance, authority, and quality weights
 *
 * @see .planning/phases/92-on-page-seo-mastery/92-06-PLAN.md
 */
import createGraph from 'ngraph.graph';
import type { Graph, Node } from 'ngraph.graph';
import { eq, and } from 'drizzle-orm';
import { linkGraph } from '@/db/link-schema';
import { pageQualityScores } from '@/db/onpage-mastery-schema';
import { db, type DbClient } from '@/db';

// Type declaration for ngraph.pagerank (no TypeScript types available)
type PageRankFn = (
  graph: Graph,
  options?: { damping?: number }
) => Record<string, number>;

// Dynamic import for pagerank (CommonJS module without types)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pagerank: PageRankFn = require('ngraph.pagerank');

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Page authority metrics from PageRank calculation.
 */
export interface PageAuthority {
  url: string;
  score: number; // PageRank score 0-1
  rank: number; // 1 = highest authority
  inboundLinks: number;
  outboundLinks: number;
}

/**
 * Link recommendation with multi-factor scoring.
 */
export interface LinkRecommendation {
  sourceUrl: string;
  targetUrl: string;
  relevanceScore: number; // Semantic similarity 0-1
  authorityScore: number; // PageRank 0-1
  qualityScore: number; // Content quality 0-100
  combinedScore: number; // Weighted combination
  suggestedAnchor?: string;
  reason: string;
}

/**
 * PageRank configuration options.
 */
export interface PageRankConfig {
  dampingFactor: number; // Default 0.85
  maxIterations: number; // Default 100
  tolerance: number; // Default 1e-6
}

/**
 * Anchor diversity metrics.
 */
export interface AnchorDiversity {
  totalLinks: number;
  uniqueAnchors: number;
  diversityScore: number; // 0-1, higher = more diverse
  anchors: string[];
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG: PageRankConfig = {
  dampingFactor: 0.85,
  maxIterations: 100,
  tolerance: 1e-6,
};

// ============================================================================
// InternalLinkGraph Class
// ============================================================================

/**
 * Internal link graph with PageRank authority calculation.
 *
 * This class provides PageRank-based authority scoring and quality-aware
 * link recommendations for internal linking optimization.
 *
 * @example
 * ```typescript
 * const graph = new InternalLinkGraph(db);
 *
 * // Get authority scores for all pages
 * const authorities = await graph.calculatePageAuthority('client-123');
 *
 * // Get link recommendations for a page
 * const recommendations = await graph.getLinkRecommendations(
 *   'client-123',
 *   '/source-page',
 *   'Page content here...',
 *   { minQualityScore: 70, limit: 10 }
 * );
 * ```
 */
export class InternalLinkGraph {
  private db: DbClient;
  private config: PageRankConfig;

  constructor(dbClient: DbClient, config?: Partial<PageRankConfig>) {
    this.db = dbClient;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // Public API
  // ==========================================================================

  /**
   * Calculate PageRank authority scores for all pages in a client's site.
   *
   * @param clientId - Client identifier for tenant isolation
   * @param auditId - Optional audit ID to scope to specific audit
   * @returns Array of PageAuthority sorted by score (highest first)
   */
  async calculatePageAuthority(
    clientId: string,
    auditId?: string
  ): Promise<PageAuthority[]> {
    // 1. Load link graph from database
    const whereClause = auditId
      ? and(eq(linkGraph.clientId, clientId), eq(linkGraph.auditId, auditId))
      : eq(linkGraph.clientId, clientId);

    const links = await this.db
      .select({
        sourceUrl: linkGraph.sourceUrl,
        targetUrl: linkGraph.targetUrl,
      })
      .from(linkGraph)
      .where(whereClause);

    if (links.length === 0) {
      return [];
    }

    // 2. Build ngraph structure
    const graph = createGraph();
    const linkCounts = new Map<string, { inbound: number; outbound: number }>();

    for (const link of links) {
      graph.addLink(link.sourceUrl, link.targetUrl);

      // Track link counts
      const sourceData = linkCounts.get(link.sourceUrl) || {
        inbound: 0,
        outbound: 0,
      };
      sourceData.outbound++;
      linkCounts.set(link.sourceUrl, sourceData);

      const targetData = linkCounts.get(link.targetUrl) || {
        inbound: 0,
        outbound: 0,
      };
      targetData.inbound++;
      linkCounts.set(link.targetUrl, targetData);
    }

    // 3. Calculate PageRank
    // Note: ngraph.pagerank uses 'damping' not 'dampingFactor'
    const ranks = pagerank(graph, {
      damping: this.config.dampingFactor,
    });

    // 4. Convert to PageAuthority array
    const authorities: PageAuthority[] = [];
    graph.forEachNode((node: Node) => {
      const url = node.id as string;
      const counts = linkCounts.get(url) || { inbound: 0, outbound: 0 };
      authorities.push({
        url,
        score: ranks[url] || 0,
        rank: 0, // Assigned after sort
        inboundLinks: counts.inbound,
        outboundLinks: counts.outbound,
      });
    });

    // 5. Sort by score and assign ranks
    authorities.sort((a, b) => b.score - a.score);
    authorities.forEach((auth, i) => (auth.rank = i + 1));

    return authorities;
  }

  /**
   * Get link recommendations for a page, filtered by quality.
   *
   * Recommendations are scored using a combination of:
   * - PageRank authority (30%)
   * - Content quality score (40%)
   * - Semantic relevance (30%) - requires embeddings
   *
   * @param clientId - Client identifier for tenant isolation
   * @param sourceUrl - URL of the source page
   * @param sourceContent - Content of the source page for relevance calculation
   * @param options - Configuration options
   * @returns Array of LinkRecommendation sorted by combined score
   */
  async getLinkRecommendations(
    clientId: string,
    sourceUrl: string,
    sourceContent: string,
    options?: {
      limit?: number;
      minQualityScore?: number;
      minRelevance?: number;
    }
  ): Promise<LinkRecommendation[]> {
    const limit = options?.limit ?? 10;
    const minQualityScore = options?.minQualityScore ?? 70;

    // 1. Get authority scores
    const authorities = await this.calculatePageAuthority(clientId);
    const authorityMap = new Map(authorities.map((a) => [a.url, a.score]));

    // 2. Get quality scores for all pages
    const qualityScores = await this.db
      .select({
        pageUrl: pageQualityScores.pageUrl,
        overallScore: pageQualityScores.overallScore,
      })
      .from(pageQualityScores)
      .where(eq(pageQualityScores.clientId, clientId));

    const qualityMap = new Map<string, number>(
      qualityScores.map((q) => [q.pageUrl, q.overallScore])
    );

    // 3. Filter candidates by quality score
    const candidates = authorities.filter((a) => {
      const quality = qualityMap.get(a.url) ?? 0;
      return quality >= minQualityScore && a.url !== sourceUrl;
    });

    if (candidates.length === 0) {
      return [];
    }

    // 4. Calculate combined scores
    // Note: Semantic relevance would require embedding comparison
    // For now, we skip relevance (set to 0) and weight authority + quality
    const recommendations: LinkRecommendation[] = [];

    for (const candidate of candidates) {
      const authorityScore = authorityMap.get(candidate.url) || 0;
      const qualityScore = qualityMap.get(candidate.url) || 0;

      // Combined score: 30% authority + 40% quality (no relevance without embeddings)
      // Normalize quality to 0-1 range
      const combinedScore =
        authorityScore * 0.3 + (qualityScore / 100) * 0.4;

      recommendations.push({
        sourceUrl,
        targetUrl: candidate.url,
        relevanceScore: 0, // Would require embedding comparison
        authorityScore,
        qualityScore,
        combinedScore,
        reason: this.generateReason(0, authorityScore, qualityScore),
      });
    }

    // 5. Sort by combined score and limit
    recommendations.sort((a, b) => b.combinedScore - a.combinedScore);
    return recommendations.slice(0, limit);
  }

  /**
   * Get existing internal links for a page.
   *
   * @param clientId - Client identifier
   * @param pageUrl - URL of the page
   * @returns Array of existing links with anchor text
   */
  async getExistingLinks(
    clientId: string,
    pageUrl: string
  ): Promise<Array<{ targetUrl: string; anchorText: string | null }>> {
    return this.db
      .select({
        targetUrl: linkGraph.targetUrl,
        anchorText: linkGraph.anchorText,
      })
      .from(linkGraph)
      .where(and(eq(linkGraph.clientId, clientId), eq(linkGraph.sourceUrl, pageUrl)));
  }

  /**
   * Check anchor text diversity for a target URL.
   *
   * High diversity (many unique anchors) is preferred to avoid
   * over-optimization penalties.
   *
   * @param clientId - Client identifier
   * @param targetUrl - URL of the target page
   * @returns Anchor diversity metrics
   */
  async checkAnchorDiversity(
    clientId: string,
    targetUrl: string
  ): Promise<AnchorDiversity> {
    const links = await this.db
      .select({
        anchorText: linkGraph.anchorText,
      })
      .from(linkGraph)
      .where(and(eq(linkGraph.clientId, clientId), eq(linkGraph.targetUrl, targetUrl)));

    const anchors = links
      .map((l) => l.anchorText)
      .filter((a): a is string => a !== null && a !== '');
    const uniqueAnchors = [...new Set(anchors)];

    return {
      totalLinks: links.length,
      uniqueAnchors: uniqueAnchors.length,
      diversityScore: links.length > 0 ? uniqueAnchors.length / links.length : 1,
      anchors: uniqueAnchors,
    };
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  /**
   * Generate human-readable reason for recommendation.
   */
  private generateReason(
    relevance: number,
    authority: number,
    quality: number
  ): string {
    const reasons: string[] = [];

    if (relevance >= 0.8) {
      reasons.push('highly relevant');
    } else if (relevance >= 0.6) {
      reasons.push('relevant');
    }

    // PageRank scores are typically very small (0.001-0.01 range)
    if (authority >= 0.01) {
      reasons.push('high authority');
    } else if (authority >= 0.005) {
      reasons.push('good authority');
    }

    if (quality >= 90) {
      reasons.push('excellent quality');
    } else if (quality >= 80) {
      reasons.push('high quality');
    } else if (quality >= 70) {
      reasons.push('good quality');
    }

    return reasons.length > 0
      ? `Recommended: ${reasons.join(', ')}`
      : 'Good link candidate';
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an InternalLinkGraph instance using the default database connection.
 *
 * @param config - Optional PageRank configuration
 * @returns InternalLinkGraph instance
 */
export function getInternalLinkGraph(
  config?: Partial<PageRankConfig>
): InternalLinkGraph {
  return new InternalLinkGraph(db, config);
}

/**
 * Standalone function for quick authority calculation.
 *
 * @param clientId - Client identifier
 * @param auditId - Optional audit ID
 * @returns Array of PageAuthority
 */
export async function calculatePageAuthority(
  clientId: string,
  auditId?: string
): Promise<PageAuthority[]> {
  const graph = getInternalLinkGraph();
  return graph.calculatePageAuthority(clientId, auditId);
}
