/**
 * ConstraintFilter - Pipeline Orchestrator for Keyword Filtering
 *
 * Processes keywords through a 4-stage filter pipeline:
 * 1. Geo filter (wrong city, generic)
 * 2. Negative filter (DIY, competitors, etc.)
 * 3. Audience filter (B2B vs B2C)
 * 4. Relevance threshold filter
 *
 * Early exit: stops at first failing filter.
 */

import {
  checkGeoFilter,
  checkNegativeFilter,
  checkAudienceFilter,
  checkRelevanceFilter,
} from './filters';
import { humanReadableReason } from './types';
import { CompositeScorer } from './scoring';
import type {
  FilterConstraints,
  ClassifiedKeywordInput,
  FilterResult,
  ExclusionExport,
  ExclusionReason,
  CategoryPriorityInput,
} from './types';

// ============================================================================
// Options Interface
// ============================================================================

export interface ConstraintFilterOptions {
  constraints?: FilterConstraints;
  priorities?: CategoryPriorityInput[];
}

// ============================================================================
// Statistics Interface
// ============================================================================

export interface FilterStats {
  total: number;
  passed: number;
  excludedByGeo: number;
  excludedByNegative: number;
  excludedByAudience: number;
  excludedByRelevance: number;
}

// ============================================================================
// ConstraintFilter Class
// ============================================================================

export class ConstraintFilter {
  private constraints: FilterConstraints;
  private scorer: CompositeScorer;
  private stats: FilterStats;

  constructor(options: ConstraintFilterOptions = {}) {
    this.constraints = {
      relevanceThreshold: 0.4,
      ...options.constraints,
    };
    this.scorer = new CompositeScorer(options.priorities ?? []);
    this.stats = {
      total: 0,
      passed: 0,
      excludedByGeo: 0,
      excludedByNegative: 0,
      excludedByAudience: 0,
      excludedByRelevance: 0,
    };
  }

  /**
   * Filter a single keyword through all 4 stages.
   * Early exit on first failure.
   */
  filter(input: ClassifiedKeywordInput): FilterResult {
    const start = performance.now();

    // Stage 1: Geo filter
    const geoResult = checkGeoFilter(
      input.keyword,
      input.geoClassification,
      this.constraints.geoConstraints
    );
    if (!geoResult.passes) {
      this.stats.excludedByGeo++;
      return {
        keyword: input.keyword,
        passed: false,
        exclusionReason: geoResult.reason,
        exclusionStage: 'geo',
        processingTimeMs: performance.now() - start,
      };
    }

    // Stage 2: Negative filter
    const negativeResult = checkNegativeFilter(
      input.keyword,
      this.constraints.negativeFilters
    );
    if (!negativeResult.passes) {
      this.stats.excludedByNegative++;
      return {
        keyword: input.keyword,
        passed: false,
        exclusionReason: negativeResult.reason,
        exclusionStage: 'negative',
        processingTimeMs: performance.now() - start,
      };
    }

    // Stage 3: Audience filter
    const audienceResult = checkAudienceFilter(
      input.keyword,
      this.constraints.audienceConstraints
    );
    if (!audienceResult.passes) {
      this.stats.excludedByAudience++;
      return {
        keyword: input.keyword,
        passed: false,
        exclusionReason: audienceResult.reason,
        exclusionStage: 'audience',
        processingTimeMs: performance.now() - start,
      };
    }

    // Stage 4: Relevance filter
    const relevanceResult = checkRelevanceFilter(
      input.relevanceScores?.combinedScore,
      this.constraints.relevanceThreshold
    );
    if (!relevanceResult.passes) {
      this.stats.excludedByRelevance++;
      return {
        keyword: input.keyword,
        passed: false,
        exclusionReason: relevanceResult.reason,
        exclusionStage: 'relevance',
        processingTimeMs: performance.now() - start,
      };
    }

    // All filters passed - compute composite score
    const compositeScore = this.scorer.score(input);

    this.stats.passed++;
    return {
      keyword: input.keyword,
      passed: true,
      compositeScore,
      classification: {
        funnelStage: input.funnelStage ?? 'tofu',
        geoCity: input.geoClassification?.city ?? null,
        relevanceScore: input.relevanceScores?.combinedScore ?? 0,
      },
      processingTimeMs: performance.now() - start,
    };
  }

  /**
   * Process an array of keywords and return filter results.
   */
  filterBatch(inputs: ClassifiedKeywordInput[]): FilterResult[] {
    this.stats.total = inputs.length;
    return inputs.map(input => this.filter(input));
  }

  /**
   * Get filtering statistics.
   */
  getStats(): FilterStats {
    return { ...this.stats };
  }

  /**
   * Sort passed keywords by composite score (descending).
   *
   * @param results - Filter results array
   * @returns Sorted array of passed keywords with scores
   */
  sortByScore(results: FilterResult[]): FilterResult[] {
    return [...results]
      .filter(r => r.passed && r.compositeScore)
      .sort((a, b) => (b.compositeScore?.finalScore ?? 0) - (a.compositeScore?.finalScore ?? 0));
  }

  /**
   * Generate human-readable exclusion exports from filter results.
   */
  getExclusionExports(results: FilterResult[]): ExclusionExport[] {
    return results
      .filter(r => !r.passed)
      .map(r => ({
        keyword: r.keyword,
        reason: r.exclusionReason!,
        humanReadable: humanReadableReason(r.exclusionReason!),
        stage: r.exclusionStage!,
        details: this.extractDetails(r.exclusionReason!),
      }));
  }

  /**
   * Extract structured details from exclusion reason for export.
   */
  private extractDetails(reason: ExclusionReason): Record<string, unknown> {
    const parts = reason.split(':');
    const stage = parts[0];
    const type = parts[1];
    const value = parts[2];

    const details: Record<string, unknown> = {
      stage,
      type,
    };

    // Add stage-specific details
    if (stage === 'geo') {
      if (type === 'wrong_city' && value) {
        details.city = value;
        details.targetCities = this.constraints.geoConstraints?.includeCities || [];
      } else if (type === 'generic_not_allowed') {
        details.genericAllowed = this.constraints.geoConstraints?.genericAllowed || false;
      }
    } else if (stage === 'negative') {
      if (value) {
        details.matchedTerm = value;
      }
      if (type === 'term') {
        details.excludeTerms = this.constraints.negativeFilters?.excludeTerms || [];
      } else if (type === 'brand') {
        details.excludeBrands = this.constraints.negativeFilters?.excludeBrands || [];
      } else if (type === 'intent') {
        details.excludeIntents = this.constraints.negativeFilters?.excludeIntents || [];
      }
    } else if (stage === 'audience') {
      details.b2bOnly = this.constraints.audienceConstraints?.b2bOnly || false;
      details.b2cAllowed = this.constraints.audienceConstraints?.b2cAllowed !== false;
    } else if (stage === 'relevance') {
      if (value) {
        details.score = parseFloat(value);
      }
      details.threshold = this.constraints.relevanceThreshold;
    }

    return details;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a ConstraintFilter with default or custom constraints.
 */
export function createConstraintFilter(
  options?: ConstraintFilterOptions
): ConstraintFilter {
  return new ConstraintFilter(options);
}
