/**
 * Composite Scoring for Keyword Filtering
 *
 * Combines relevance, funnel confidence, geo score, and volume into a single score
 * with priority multiplier and quick win bonus.
 */

import type {
  CompositeScore,
  CategoryPriorityInput,
  ClassifiedKeywordInput,
} from './types';
import { SCORING_WEIGHTS } from './types';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Normalize search volume to 0-1 scale using log10.
 *
 * Scale:
 * - 0 volume → 0
 * - 100 volume → 0.5
 * - 10000 volume → 1.0
 *
 * @param volume - Search volume
 * @returns Normalized score 0-1
 */
export function normalizeVolume(volume: number): number {
  if (volume <= 0) return 0;
  const logVol = Math.log10(volume);
  return Math.min(1, Math.max(0, logVol / 4)); // log10(10000) = 4
}

/**
 * Check if keyword matches category (case-insensitive substring match).
 *
 * @param keyword - Keyword to check
 * @param category - Category name
 * @param categoryLt - Lithuanian variant (optional)
 * @returns True if keyword contains category
 */
function keywordMatchesCategory(
  keyword: string,
  category: string,
  categoryLt?: string
): boolean {
  const lowerKeyword = keyword.toLowerCase();
  if (lowerKeyword.includes(category.toLowerCase())) return true;
  if (categoryLt && lowerKeyword.includes(categoryLt.toLowerCase())) return true;
  return false;
}

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Compute base score from weighted combination of signals.
 *
 * Formula:
 *   baseScore = relevance*0.4 + funnelConfidence*0.3 + geoScore*0.2 + volumeNormalized*0.1
 *
 * @param input - Scoring input signals
 * @returns Base score 0-1
 */
export function computeBaseScore(input: {
  relevanceScore?: number;
  funnelConfidence?: number;
  geoScore?: number;
  volume?: number;
}): number {
  const relevance = input.relevanceScore ?? 0.5;
  const funnel = input.funnelConfidence ?? 0.5;
  const geo = input.geoScore ?? 0.5;
  const volumeNorm = normalizeVolume(input.volume ?? 0);

  return (
    relevance * SCORING_WEIGHTS.relevance +
    funnel * SCORING_WEIGHTS.funnelConfidence +
    geo * SCORING_WEIGHTS.geoScore +
    volumeNorm * SCORING_WEIGHTS.volumeNormalized
  );
}

/**
 * Compute priority multiplier from category matches.
 *
 * Returns the weight multiplier of the first matching category.
 * If no match, returns 1.0 (neutral).
 *
 * @param keyword - Keyword to check
 * @param priorities - Category priority list
 * @returns Priority multiplier 1.0-2.0
 */
export function computePriorityMultiplier(
  keyword: string,
  priorities: CategoryPriorityInput[]
): number {
  for (const priority of priorities) {
    if (keywordMatchesCategory(keyword, priority.category, priority.categoryLt)) {
      return priority.weightMultiplier;
    }
  }
  return 1.0; // No priority match
}

/**
 * Compute quick win bonus from position opportunity.
 *
 * Thresholds:
 * - Position 11-20 (striking distance):
 *   - volume >= 100: 0.2 bonus
 *   - volume >= 50: 0.15 bonus
 *   - else: 0.1 bonus
 * - Position 21-50 (opportunity):
 *   - volume >= 500: 0.15 bonus
 *   - volume >= 200: 0.1 bonus
 *   - else: 0 bonus
 *
 * @param position - Current ranking position (null if not ranking)
 * @param volume - Search volume
 * @returns Quick win bonus 0-0.2
 */
export function computeQuickWinBonus(
  position: number | null | undefined,
  volume: number | undefined
): number {
  if (position === null || position === undefined) return 0;

  const vol = volume ?? 0;

  // Position 11-20: striking distance
  if (position >= 11 && position <= 20) {
    if (vol >= 100) return 0.2;
    if (vol >= 50) return 0.15;
    return 0.1;
  }

  // Position 21-50: opportunity
  if (position >= 21 && position <= 50) {
    if (vol >= 500) return 0.15;
    if (vol >= 200) return 0.1;
  }

  return 0;
}

// ============================================================================
// CompositeScorer Class
// ============================================================================

/**
 * Composite scorer combining base score, priority multiplier, and quick win bonus.
 *
 * Formula:
 *   finalScore = baseScore * priorityMultiplier + quickWinBonus
 *
 * Example:
 * ```typescript
 * const scorer = new CompositeScorer([
 *   { category: 'detailing', weightMultiplier: 1.5 }
 * ]);
 *
 * const score = scorer.score({
 *   keyword: 'detailing paslaugos šiauliuose',
 *   relevanceScores: { combinedScore: 0.75 },
 *   funnelConfidence: 0.9,
 *   geoClassification: { passesGeoFilter: true, city: 'šiauliai', geoScore: 1.0 },
 *   volume: 320,
 *   position: 15,
 * });
 *
 * // score.finalScore ≈ 1.45 (high priority BOFU keyword with quick win)
 * ```
 */
export class CompositeScorer {
  private priorities: CategoryPriorityInput[];

  /**
   * Create a composite scorer.
   *
   * @param priorities - Category priority list (optional)
   */
  constructor(priorities: CategoryPriorityInput[] = []) {
    this.priorities = priorities;
  }

  /**
   * Compute composite score for a keyword.
   *
   * @param input - Classified keyword input
   * @returns Composite score with breakdown
   */
  score(input: ClassifiedKeywordInput): CompositeScore {
    const baseScore = computeBaseScore({
      relevanceScore: input.relevanceScores?.combinedScore,
      funnelConfidence: input.funnelConfidence,
      geoScore: input.geoClassification?.geoScore,
      volume: input.volume,
    });

    const priorityMultiplier = computePriorityMultiplier(input.keyword, this.priorities);
    const quickWinBonus = computeQuickWinBonus(input.position, input.volume);
    const finalScore = baseScore * priorityMultiplier + quickWinBonus;

    return { baseScore, priorityMultiplier, quickWinBonus, finalScore };
  }
}
