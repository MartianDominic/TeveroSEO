/**
 * RecommendationEngine
 *
 * Generates prioritized discovery recommendations by analyzing pSEO clusters,
 * side keywords, and product linkages.
 */

import type {
  PSEOCluster,
  SideKeywordExpansion,
  DiscoveryResult,
  DiscoveryRecommendation,
  DiscoveryMetadata,
} from './types';
import type { ProductLinkage } from './ProductLinker';

/**
 * Priority thresholds for opportunity scoring
 */
const PRIORITY_THRESHOLDS = {
  HIGH: 0.7,
  MEDIUM: 0.5,
} as const;

/**
 * Determine priority based on opportunity score
 */
function getPriority(score: number): 'high' | 'medium' | 'low' {
  if (score >= PRIORITY_THRESHOLDS.HIGH) return 'high';
  if (score >= PRIORITY_THRESHOLDS.MEDIUM) return 'medium';
  return 'low';
}

/**
 * Generate recommendations from pSEO clusters
 */
function generatePSEORecommendations(
  clusters: PSEOCluster[],
): DiscoveryRecommendation[] {
  return clusters.map(cluster => {
    const priority = getPriority(cluster.opportunityScore);

    return {
      type: 'pseo_template' as const,
      priority,
      title: `Create pSEO template: ${cluster.pattern}`,
      description: `Build a programmatic SEO template to target ${cluster.cities.length} cities with ${cluster.keywords.length} keyword variations. Estimated ${cluster.estimatedPages} pages with total volume of ${cluster.totalVolume}.`,
      keywords: cluster.keywords,
      estimatedImpact: {
        volume: cluster.totalVolume,
        pages: cluster.estimatedPages,
      },
    };
  });
}

/**
 * Generate recommendations from unlinked keywords (content gaps)
 */
function generateContentGapRecommendations(
  linkages: ProductLinkage[],
): DiscoveryRecommendation[] {
  const unlinked = linkages.filter(
    link => link.linkageConfidence < 0.5 || link.linkedProducts.length === 0,
  );

  if (unlinked.length === 0) return [];

  // Group by suggested landing page for better recommendations
  const grouped = new Map<string, ProductLinkage[]>();
  for (const link of unlinked) {
    const existing = grouped.get(link.suggestedLandingPage) || [];
    existing.push(link);
    grouped.set(link.suggestedLandingPage, existing);
  }

  const recommendations: DiscoveryRecommendation[] = [];
  Array.from(grouped.entries()).forEach(([landingPage, links]) => {
    recommendations.push({
      type: 'content_gap' as const,
      priority: 'medium',
      title: `Content gap: ${links.length} unlinked keywords`,
      description: `Create content for ${links.length} keywords that don't match existing products. Suggested landing page: ${landingPage}`,
      keywords: links.map(l => l.keyword),
      estimatedImpact: {
        volume: 0, // Would need volume data from original keywords
        pages: 1,
      },
    });
  });

  return recommendations;
}

/**
 * Compute discovery metadata
 */
function computeMetadata(
  pseoOpportunities: PSEOCluster[],
  sideKeywords: SideKeywordExpansion[],
  linkages: ProductLinkage[],
): DiscoveryMetadata {
  const totalPSEOPages = pseoOpportunities.reduce(
    (sum, cluster) => sum + cluster.estimatedPages,
    0,
  );

  const totalSideKeywords = sideKeywords.reduce(
    (sum, expansion) => sum + expansion.discoveredKeywords.length,
    0,
  );

  const linkedCount = linkages.filter(
    link => link.linkageConfidence >= 0.5 && link.linkedProducts.length > 0,
  ).length;

  const linkageRate = linkages.length > 0 ? linkedCount / linkages.length : 0;

  return {
    totalPSEOPages,
    totalSideKeywords,
    linkageRate,
  };
}

/**
 * Sort recommendations by priority
 */
function sortRecommendations(
  recommendations: DiscoveryRecommendation[],
): DiscoveryRecommendation[] {
  const priorityOrder = { high: 0, medium: 1, low: 2 };

  return recommendations.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );
}

/**
 * Generate complete discovery result
 *
 * Aggregates pSEO opportunities, side keywords, and product linkages
 * into a unified result with prioritized recommendations.
 */
export function generateDiscoveryResult(
  pseoOpportunities: PSEOCluster[],
  sideKeywords: SideKeywordExpansion[],
  productLinkages: ProductLinkage[],
): DiscoveryResult {
  // Generate recommendations from different sources
  const pseoRecs = generatePSEORecommendations(pseoOpportunities);
  const contentGapRecs = generateContentGapRecommendations(productLinkages);

  // Combine and sort recommendations
  const allRecommendations = [...pseoRecs, ...contentGapRecs];
  const sortedRecommendations = sortRecommendations(allRecommendations);

  // Compute metadata
  const metadata = computeMetadata(pseoOpportunities, sideKeywords, productLinkages);

  return {
    pseoOpportunities,
    sideKeywords,
    productLinkages,
    recommendations: sortedRecommendations,
    metadata,
  };
}

/**
 * RecommendationEngine class
 *
 * Stateful engine for generating discovery recommendations.
 */
export class RecommendationEngine {
  /**
   * Generate discovery result from all inputs
   */
  generate(
    pseoOpportunities: PSEOCluster[],
    sideKeywords: SideKeywordExpansion[],
    productLinkages: ProductLinkage[],
  ): DiscoveryResult {
    return generateDiscoveryResult(pseoOpportunities, sideKeywords, productLinkages);
  }
}
