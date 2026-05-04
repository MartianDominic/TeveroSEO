/**
 * PSEODetector - Programmatic SEO Pattern Detection
 *
 * Detects when multiple keywords follow a "[service/product] [CITY]" pattern,
 * indicating a template opportunity.
 */

import { extractCityFromKeyword, removeCity, LITHUANIAN_CITIES } from './LithuanianCities';
import type { PSEOCluster, PSEODetectorConfig } from './types';

const DEFAULT_CONFIG: PSEODetectorConfig = {
  minClusterSize: 3,
  volumeWeight: 0.35,
  cityWeight: 0.25,
  difficultyWeight: 0.20,
  funnelWeight: 0.20,
};

interface KeywordWithMetrics {
  keyword: string;
  volume: number;
  difficulty: number;
  type: 'bofu' | 'mofu' | 'tofu';
}

/**
 * Compute pSEO opportunity score
 *
 * @param cluster - The PSEOCluster to score
 * @param keywords - Original keywords with metrics
 * @param config - Detector configuration
 * @returns Score between 0 and 1
 */
export function computePSEOScore(
  cluster: PSEOCluster,
  keywords: KeywordWithMetrics[],
  config: PSEODetectorConfig = DEFAULT_CONFIG
): number {
  // Volume score: normalized against 5000 volume target
  const volumeScore = Math.min(cluster.totalVolume / 5000, 1.0);

  // City score: normalized against 10 cities
  const cityScore = Math.min(cluster.cities.length / 10, 1.0);

  // Difficulty score: lower difficulty = higher score
  const difficultyScore = 1 - cluster.avgDifficulty / 100;

  // Funnel score: BOFU = 1.0, MOFU = 0.7, TOFU = 0.4
  const clusterKeywords = keywords.filter(k => cluster.keywords.includes(k.keyword));
  const funnelValues = clusterKeywords.map(k => {
    if (k.type === 'bofu') return 1.0;
    if (k.type === 'mofu') return 0.7;
    return 0.4;
  });
  const funnelScore = funnelValues.length > 0
    ? funnelValues.reduce((sum, v) => sum + v, 0) / funnelValues.length
    : 0.4;

  // Weighted sum
  return (
    volumeScore * config.volumeWeight +
    cityScore * config.cityWeight +
    difficultyScore * config.difficultyWeight +
    funnelScore * config.funnelWeight
  );
}

/**
 * Generate URL template from keyword base
 *
 * @param base - The keyword without city (e.g., "automobilių plovykla")
 * @returns URL template (e.g., "/automobiliu-plovykla/{city}")
 */
function generateURLTemplate(base: string): string {
  // Convert to lowercase
  let slug = base.toLowerCase();

  // Replace Lithuanian characters with ASCII equivalents
  const lithuanianToAscii: Record<string, string> = {
    'ą': 'a', 'č': 'c', 'ę': 'e', 'ė': 'e', 'į': 'i',
    'š': 's', 'ų': 'u', 'ū': 'u', 'ž': 'z',
  };

  for (const [lt, ascii] of Object.entries(lithuanianToAscii)) {
    slug = slug.replace(new RegExp(lt, 'g'), ascii);
  }

  // Replace spaces with hyphens
  slug = slug.replace(/\s+/g, '-');

  // Remove any non-alphanumeric characters except hyphens
  slug = slug.replace(/[^a-z0-9-]/g, '');

  // Remove multiple consecutive hyphens
  slug = slug.replace(/-+/g, '-');

  // Remove leading/trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');

  return `/${slug}/{city}`;
}

/**
 * Detect pSEO patterns from keywords
 *
 * @param keywords - Keywords with volume and difficulty metrics
 * @param config - Detector configuration
 * @returns Array of PSEOClusters sorted by opportunity score
 */
export function detectPSEOPatterns(
  keywords: KeywordWithMetrics[],
  config: PSEODetectorConfig = DEFAULT_CONFIG
): PSEOCluster[] {
  // Group keywords by pattern (keyword without city)
  const groups = new Map<string, {
    keywords: KeywordWithMetrics[];
    cities: Set<string>;
  }>();

  for (const kw of keywords) {
    const cityExtraction = extractCityFromKeyword(kw.keyword);

    if (cityExtraction) {
      const base = removeCity(kw.keyword, cityExtraction.variant).toLowerCase();

      if (!groups.has(base)) {
        groups.set(base, {
          keywords: [],
          cities: new Set(),
        });
      }

      const group = groups.get(base)!;
      group.keywords.push(kw);
      group.cities.add(cityExtraction.city);
    }
  }

  // Filter to clusters with minimum size
  const clusters: PSEOCluster[] = [];

  Array.from(groups.entries()).forEach(([base, group]) => {
    if (group.keywords.length >= config.minClusterSize) {
      const totalVolume = group.keywords.reduce((sum, k) => sum + k.volume, 0);
      const avgDifficulty = group.keywords.reduce((sum, k) => sum + k.difficulty, 0) / group.keywords.length;

      const cluster: PSEOCluster = {
        pattern: `${base} [CITY]`,
        template: generateURLTemplate(base),
        keywords: group.keywords.map(k => k.keyword),
        cities: Array.from(group.cities),
        estimatedPages: LITHUANIAN_CITIES.length,
        totalVolume,
        avgDifficulty,
        opportunityScore: 0, // Will be computed next
      };

      // Compute opportunity score
      cluster.opportunityScore = computePSEOScore(cluster, group.keywords, config);

      clusters.push(cluster);
    }
  });

  // Sort by opportunity score descending
  return clusters.sort((a, b) => b.opportunityScore - a.opportunityScore);
}

/**
 * PSEODetector Class
 *
 * Stateful detector with configuration
 */
export class PSEODetector {
  private config: PSEODetectorConfig;

  constructor(config: Partial<PSEODetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Detect pSEO patterns
   *
   * @param keywords - Keywords with metrics
   * @returns Array of PSEOClusters sorted by opportunity score
   */
  detect(keywords: KeywordWithMetrics[]): PSEOCluster[] {
    return detectPSEOPatterns(keywords, this.config);
  }
}
