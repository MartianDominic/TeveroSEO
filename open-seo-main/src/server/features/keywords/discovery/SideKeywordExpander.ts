/**
 * Side Keyword Expander
 *
 * Discovers related keywords via problem-to-solution expansion using DataForSEO.
 */

import { fetchKeywordIdeasRaw } from '@/server/lib/dataforseo';
import type {
  SideKeywordExpansion,
  SideKeyword,
  SideKeywordExpanderConfig,
} from './types';
import type { AnalysisConstraints } from '@/server/features/keywords/conversation/types';

/**
 * Discover side keywords from conversation constraints.
 *
 * Extracts problem terms from businessContext and expands them via DataForSEO
 * keyword ideas API. Filters results by existing keywords and relevance threshold.
 *
 * @param constraints - Analysis constraints with problemsSolved
 * @param existingKeywords - Set of keywords to exclude
 * @param config - Expander configuration
 * @returns Array of side keyword expansions
 */
export async function discoverSideKeywords(
  constraints: AnalysisConstraints,
  existingKeywords: Set<string>,
  config: SideKeywordExpanderConfig,
): Promise<SideKeywordExpansion[]> {
  const expansions: SideKeywordExpansion[] = [];

  // Extract problems from conversation
  const problems = constraints.businessContext.problemsSolved || [];

  // For each problem, get DataForSEO keyword ideas
  for (const problem of problems) {
    try {
      const response = await fetchKeywordIdeasRaw(
        problem,
        config.locationCode,
        config.languageCode,
        config.limit,
      );

      // Filter to new keywords only
      const newKeywords = response.data.filter(
        (item) => item.keyword && !existingKeywords.has(item.keyword),
      );

      // Score relevance (stub: volume/difficulty ratio until Phase 78 integrated)
      const scoredKeywords: SideKeyword[] = [];
      for (const item of newKeywords) {
        const volume = item.keyword_info?.search_volume ?? 0;
        const difficulty =
          item.keyword_properties?.keyword_difficulty ??
          (item.keyword_info?.competition ? item.keyword_info.competition * 100 : 50);

        // Stub relevance: normalize volume/difficulty ratio
        // High volume + low difficulty = high relevance
        const rawScore = difficulty > 0 ? volume / difficulty : 0;
        const relevanceScore = Math.min(rawScore / 10, 1.0); // Normalize to 0-1

        // Filter by relevance threshold
        if (relevanceScore >= config.relevanceThreshold) {
          scoredKeywords.push({
            keyword: item.keyword,
            volume,
            difficulty,
            relevanceScore,
            passesFilters: true, // Stub - will integrate Phase 79 filtering
            discoverySource: problem,
          });
        }
      }

      expansions.push({
        source: 'problem',
        seedTerm: problem,
        discoveredKeywords: scoredKeywords,
        expansionMethod: 'dataforseo_keyword_ideas',
      });
    } catch (error) {
      // Log error but continue with other problems
      console.error(`Failed to expand problem "${problem}":`, error);
      expansions.push({
        source: 'problem',
        seedTerm: problem,
        discoveredKeywords: [],
        expansionMethod: 'dataforseo_keyword_ideas',
      });
    }
  }

  return expansions;
}

/**
 * Stateful side keyword expander.
 */
export class SideKeywordExpander {
  constructor(private config: SideKeywordExpanderConfig) {}

  async expand(
    constraints: AnalysisConstraints,
    existingKeywords: Set<string>,
  ): Promise<SideKeywordExpansion[]> {
    return discoverSideKeywords(constraints, existingKeywords, this.config);
  }
}
