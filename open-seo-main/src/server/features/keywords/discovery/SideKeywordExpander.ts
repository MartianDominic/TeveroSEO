/**
 * Side Keyword Expander
 *
 * Discovers related keywords via problem-to-solution expansion using DataForSEO.
 * Phase KW-1: DfsCostTracker integration for cost attribution.
 */

import { fetchKeywordIdeasRaw } from '@/server/lib/dataforseo';
import type {
  SideKeywordExpansion,
  SideKeyword,
  SideKeywordExpanderConfig,
} from './types';
import type { AnalysisConstraints } from '@/server/features/keywords/conversation/types';
import { db } from '@/db';
import { getDfsCostTracker } from '@/server/features/scraping/providers/DfsCostTracker';
import { getLabsCost } from '@/server/features/scraping/cost';

/**
 * Options for cost attribution when expanding keywords.
 */
export interface ExpandOptions {
  /** Client ID for cost attribution (required) */
  clientId?: string;
  /** Workspace ID for cost attribution */
  workspaceId?: string;
  /** Job ID for tracking */
  jobId?: string;
}

// DataForSEO Labs Keyword Ideas API cost per request (from centralized pricing)
const DFS_KEYWORD_IDEAS_COST = getLabsCost("keywordIdeas");

/**
 * Discover side keywords from conversation constraints.
 *
 * Extracts problem terms from businessContext and expands them via DataForSEO
 * keyword ideas API. Filters results by existing keywords and relevance threshold.
 *
 * @param constraints - Analysis constraints with problemsSolved
 * @param existingKeywords - Set of keywords to exclude
 * @param config - Expander configuration
 * @param options - Cost attribution options (clientId, workspaceId, jobId)
 * @returns Array of side keyword expansions
 */
export async function discoverSideKeywords(
  constraints: AnalysisConstraints,
  existingKeywords: Set<string>,
  config: SideKeywordExpanderConfig,
  options: ExpandOptions = {},
): Promise<SideKeywordExpansion[]> {
  const expansions: SideKeywordExpansion[] = [];
  const { clientId, workspaceId, jobId } = options;

  // Get cost tracker for attribution
  const costTracker = getDfsCostTracker(db);

  // Extract problems from conversation
  const problems = constraints.business.problemsSolved || [];

  // For each problem, get DataForSEO keyword ideas
  for (const problem of problems) {
    const startTime = Date.now();
    try {
      const response = await fetchKeywordIdeasRaw(
        problem,
        config.locationCode,
        config.languageCode,
        config.limit,
      );

      // Record cost (fire-and-forget pattern - don't block on tracking)
      costTracker
        .recordCost({
          url: `keyword-ideas:${problem}`,
          domain: 'dataforseo-labs',
          mode: 'basic',
          usedStandardQueue: false,
          estimatedCost: DFS_KEYWORD_IDEAS_COST,
          actualCost: response.billing?.costUsd ?? DFS_KEYWORD_IDEAS_COST,
          success: true,
          responseTimeMs: Date.now() - startTime,
          clientId,
          workspaceId,
          jobId: jobId ?? 'side-keyword-expander',
        })
        .catch(() => {
          // Silent failure - cost tracking must not break the flow
        });

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
      // Record failed cost (fire-and-forget)
      costTracker
        .recordCost({
          url: `keyword-ideas:${problem}`,
          domain: 'dataforseo-labs',
          mode: 'basic',
          usedStandardQueue: false,
          estimatedCost: DFS_KEYWORD_IDEAS_COST,
          success: false,
          errorMessage: error instanceof Error ? error.message : String(error),
          responseTimeMs: Date.now() - startTime,
          clientId,
          workspaceId,
          jobId: jobId ?? 'side-keyword-expander',
        })
        .catch(() => {
          // Silent failure - cost tracking must not break the flow
        });

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

  /**
   * Expand keywords from conversation constraints.
   *
   * @param constraints - Analysis constraints with problemsSolved
   * @param existingKeywords - Set of keywords to exclude
   * @param options - Cost attribution options (clientId, workspaceId, jobId)
   * @returns Array of side keyword expansions
   */
  async expand(
    constraints: AnalysisConstraints,
    existingKeywords: Set<string>,
    options: ExpandOptions = {},
  ): Promise<SideKeywordExpansion[]> {
    return discoverSideKeywords(constraints, existingKeywords, this.config, options);
  }
}
