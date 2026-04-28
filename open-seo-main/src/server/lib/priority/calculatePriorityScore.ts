/**
 * Priority scoring algorithm for prospects.
 * Phase 30.5-03: Pipeline Automation
 *
 * Calculates a 0-100 priority score based on:
 * - Domain authority (20% weight)
 * - Organic traffic (15% weight)
 * - Opportunity count (25% weight)
 * - Average opportunity score (25% weight)
 * - Recency bonus (15% weight)
 */

import type {
  DomainMetrics,
  KeywordGap,
  OpportunityKeyword,
} from "@/db/prospect-schema";

export interface PriorityScoreInput {
  domainMetrics?: DomainMetrics | null;
  keywordGaps?: KeywordGap[] | null;
  opportunityKeywords?: OpportunityKeyword[] | null;
  analysisCompletedAt?: Date | null;
}

/**
 * Weight configuration for priority score components.
 */
const WEIGHTS = {
  domainAuthority: 0.2,
  organicTraffic: 0.15,
  opportunityCount: 0.25,
  avgOpportunityScore: 0.25,
  recencyBonus: 0.15,
} as const;

/**
 * Normalization thresholds.
 */
const THRESHOLDS = {
  maxTrafficForNormalization: 10000,
  maxOpportunityCountForNormalization: 50,
  recencyDaysForFullBonus: 7,
  recencyDaysForNoBonus: 30,
} as const;

/**
 * Calculate recency bonus based on when analysis was completed.
 * Returns 1.0 for analyses within 7 days, declining to 0 after 30 days.
 */
function calculateRecencyBonus(analysisCompletedAt?: Date | null): number {
  if (!analysisCompletedAt) return 0;

  const now = new Date();
  const daysSinceAnalysis = Math.floor(
    (now.getTime() - analysisCompletedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceAnalysis <= THRESHOLDS.recencyDaysForFullBonus) {
    return 1.0;
  }

  if (daysSinceAnalysis >= THRESHOLDS.recencyDaysForNoBonus) {
    return 0;
  }

  // Linear decline from day 7 to day 30
  const daysInDeclineWindow =
    THRESHOLDS.recencyDaysForNoBonus - THRESHOLDS.recencyDaysForFullBonus;
  const daysIntoDeClineWindow =
    daysSinceAnalysis - THRESHOLDS.recencyDaysForFullBonus;

  return 1 - daysIntoDeClineWindow / daysInDeclineWindow;
}

/**
 * Calculate average opportunity score from keyword gaps and AI opportunities.
 */
function calculateAvgOpportunityScore(
  keywordGaps?: KeywordGap[] | null,
  opportunityKeywords?: OpportunityKeyword[] | null
): number {
  const scores: number[] = [];

  // Include achievability scores from keyword gaps (0-100)
  if (keywordGaps?.length) {
    for (const gap of keywordGaps) {
      if (gap.achievability !== undefined) {
        scores.push(gap.achievability);
      }
    }
  }

  // Include opportunity scores from AI-discovered keywords (0-100)
  if (opportunityKeywords?.length) {
    for (const opp of opportunityKeywords) {
      if (opp.opportunityScore !== undefined) {
        scores.push(opp.opportunityScore);
      }
    }
  }

  if (scores.length === 0) return 0;

  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

/**
 * Count total opportunities (keyword gaps + AI opportunities).
 */
function countOpportunities(
  keywordGaps?: KeywordGap[] | null,
  opportunityKeywords?: OpportunityKeyword[] | null
): number {
  return (keywordGaps?.length ?? 0) + (opportunityKeywords?.length ?? 0);
}

/**
 * Calculate priority score for a prospect.
 *
 * Formula:
 * priorityScore = (
 *   (domainAuthority ?? 0) * 0.2 +
 *   Math.min(organicTraffic / 10000, 1) * 0.15 +
 *   Math.min(opportunityCount / 50, 1) * 0.25 +
 *   (avgOpportunityScore / 100) * 0.25 +
 *   recencyBonus * 0.15
 * ) * 100
 *
 * @returns Priority score between 0-100, or null if no analysis data
 */
export function calculatePriorityScore(input: PriorityScoreInput): number | null {
  const { domainMetrics, keywordGaps, opportunityKeywords, analysisCompletedAt } =
    input;

  // Return null if no meaningful data to score
  const hasData =
    domainMetrics ||
    (keywordGaps && keywordGaps.length > 0) ||
    (opportunityKeywords && opportunityKeywords.length > 0);

  if (!hasData) {
    return null;
  }

  // Extract domain authority (domainRank from DataForSEO, 0-100 scale)
  const domainAuthority = domainMetrics?.domainRank ?? 0;
  const normalizedDA = Math.min(domainAuthority / 100, 1);

  // Normalize organic traffic (cap at 10k for full score)
  const organicTraffic = domainMetrics?.organicTraffic ?? 0;
  const normalizedTraffic = Math.min(
    organicTraffic / THRESHOLDS.maxTrafficForNormalization,
    1
  );

  // Count and normalize opportunities (cap at 50 for full score)
  const opportunityCount = countOpportunities(keywordGaps, opportunityKeywords);
  const normalizedOpportunityCount = Math.min(
    opportunityCount / THRESHOLDS.maxOpportunityCountForNormalization,
    1
  );

  // Calculate average opportunity score (already 0-100)
  const avgOpportunityScore = calculateAvgOpportunityScore(
    keywordGaps,
    opportunityKeywords
  );
  const normalizedAvgScore = avgOpportunityScore / 100;

  // Calculate recency bonus
  const recencyBonus = calculateRecencyBonus(analysisCompletedAt);

  // Apply weighted formula
  const score =
    normalizedDA * WEIGHTS.domainAuthority +
    normalizedTraffic * WEIGHTS.organicTraffic +
    normalizedOpportunityCount * WEIGHTS.opportunityCount +
    normalizedAvgScore * WEIGHTS.avgOpportunityScore +
    recencyBonus * WEIGHTS.recencyBonus;

  // Scale to 0-100 and round to 2 decimal places
  return Math.round(score * 100 * 100) / 100;
}
