/**
 * Opportunity detection algorithms.
 * Phase 25: Team & Intelligence - Opportunity Identification
 *
 * Analyzes client data to surface actionable insights:
 * - CTR improvements: High impressions, low CTR
 * - Ranking gaps: Keywords in position 11-20 (almost page 1)
 * - Quick wins: Recently dropped rankings to recover
 */

import { getOpenSeo } from "@/lib/server-fetch";
import type {
  Opportunity,
  OpportunityType,
  ImpactLevel,
  EffortLevel,
  PRIORITY_MATRIX,
} from "@/types/opportunities";

// Generate unique IDs without external dependency
function generateId(): string {
  return `opp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Expected CTR by position (industry averages).
 * Position 1 gets ~28.5% CTR, dropping exponentially.
 */
const EXPECTED_CTR_BY_POSITION: Record<number, number> = {
  1: 28.5,
  2: 15.7,
  3: 11.0,
  4: 8.0,
  5: 7.2,
  6: 5.1,
  7: 4.0,
  8: 3.2,
  9: 2.8,
  10: 2.5,
};

function getExpectedCTR(position: number): number {
  const pos = Math.round(Math.max(1, Math.min(10, position)));
  return EXPECTED_CTR_BY_POSITION[pos] ?? 1.0;
}

/**
 * Calculate priority based on impact and effort.
 */
function calculatePriority(impact: ImpactLevel, effort: EffortLevel): number {
  const matrix: Record<ImpactLevel, Record<EffortLevel, number>> = {
    high: { low: 9, medium: 7, high: 5 },
    medium: { low: 6, medium: 4, high: 2 },
    low: { low: 3, medium: 2, high: 1 },
  };
  return matrix[impact][effort];
}

/**
 * Interface for GSC query data from backend.
 */
interface QueryData {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/**
 * Interface for keyword ranking data from backend.
 */
interface KeywordRanking {
  keyword: string;
  position: number;
  url?: string;
  previousPosition?: number;
  checkedAt?: string;
}

/**
 * Detect CTR improvement opportunities.
 * Finds queries with high impressions but below-expected CTR.
 */
export async function detectCTROpportunities(
  clientId: string
): Promise<Opportunity[]> {
  const opportunities: Opportunity[] = [];

  try {
    // Fetch top queries from backend (last 7 days)
    const queries = await getOpenSeo<QueryData[]>(
      `/api/clients/${clientId}/analytics/queries?days=7&limit=50`
    );

    for (const query of queries) {
      // Skip low-impression queries
      if (query.impressions < 100) continue;

      // Only analyze queries already ranking in top 10
      if (query.position > 10) continue;

      const expectedCTR = getExpectedCTR(query.position);
      const actualCTR = query.ctr * 100; // Convert from decimal
      const ctrGap = expectedCTR - actualCTR;

      // Only flag if CTR is at least 2% below expected
      if (ctrGap > 2) {
        const potentialClicks = Math.round(
          (expectedCTR / 100) * query.impressions
        );
        const estimatedGain = Math.max(0, potentialClicks - query.clicks);

        const impact: ImpactLevel =
          estimatedGain > 50 ? "high" : estimatedGain > 20 ? "medium" : "low";

        opportunities.push({
          id: generateId(),
          clientId,
          type: "ctr_improvement",
          title: `Improve CTR for "${truncate(query.query, 40)}"`,
          description: `This query has ${query.impressions.toLocaleString()} impressions but only ${actualCTR.toFixed(1)}% CTR (expected ${expectedCTR.toFixed(1)}% for position ${Math.round(query.position)}). Improving title/meta description could add ~${estimatedGain} clicks/week.`,
          impact,
          effort: "low", // Title/meta changes are low effort
          priority: calculatePriority(impact, "low"),
          keywords: [query.query],
          metrics: {
            currentValue: actualCTR,
            potentialValue: expectedCTR,
            estimatedGain,
          },
          createdAt: new Date(),
        });
      }
    }
  } catch {
    // Return empty if backend unavailable
  }

  return opportunities.slice(0, 10); // Limit to top 10
}

/**
 * Detect ranking gap opportunities.
 * Finds keywords ranking 11-20 (almost on page 1).
 */
export async function detectRankingGaps(
  clientId: string
): Promise<Opportunity[]> {
  const opportunities: Opportunity[] = [];

  try {
    // Fetch keyword rankings from backend
    const rankings = await getOpenSeo<KeywordRanking[]>(
      `/api/clients/${clientId}/keywords/rankings?minPosition=11&maxPosition=20&limit=20`
    );

    for (const kw of rankings) {
      const positionsToMove = kw.position - 10;

      const impact: ImpactLevel =
        positionsToMove <= 3 ? "high" : positionsToMove <= 5 ? "medium" : "low";
      const effort: EffortLevel = positionsToMove <= 3 ? "low" : "medium";

      opportunities.push({
        id: generateId(),
        clientId,
        type: "ranking_gap",
        title: `Push "${truncate(kw.keyword, 40)}" to Page 1`,
        description: `Currently at position ${Math.round(kw.position)}, just ${positionsToMove} spots from page 1. Small content improvements could boost visibility significantly.`,
        impact,
        effort,
        priority: calculatePriority(impact, effort),
        keywords: [kw.keyword],
        pages: kw.url ? [kw.url] : [],
        metrics: {
          currentValue: kw.position,
          potentialValue: 10,
        },
        createdAt: new Date(),
      });
    }
  } catch {
    // Return empty if backend unavailable
  }

  return opportunities.slice(0, 5); // Limit to top 5
}

/**
 * Detect quick win opportunities.
 * Finds keywords that recently dropped from good positions.
 */
export async function detectQuickWins(
  clientId: string
): Promise<Opportunity[]> {
  const opportunities: Opportunity[] = [];

  try {
    // Fetch keywords with recent ranking drops
    const drops = await getOpenSeo<KeywordRanking[]>(
      `/api/clients/${clientId}/keywords/drops?days=14&minDrop=3&limit=10`
    );

    for (const kw of drops) {
      if (!kw.previousPosition) continue;

      // Only flag if they were in top 10 before
      if (kw.previousPosition > 10) continue;

      const dropAmount = kw.position - kw.previousPosition;

      opportunities.push({
        id: generateId(),
        clientId,
        type: "quick_win",
        title: `Recover "${truncate(kw.keyword, 40)}" Ranking`,
        description: `This keyword dropped from position ${Math.round(kw.previousPosition)} to ${Math.round(kw.position)} recently. Investigating and fixing the cause could quickly recover the ranking.`,
        impact: "high",
        effort: "medium",
        priority: calculatePriority("high", "medium"),
        keywords: [kw.keyword],
        metrics: {
          currentValue: kw.position,
          potentialValue: kw.previousPosition,
        },
        createdAt: new Date(),
      });
    }
  } catch {
    // Return empty if backend unavailable
  }

  return opportunities.slice(0, 5); // Limit to top 5
}

/**
 * Find all opportunities for a client.
 * Aggregates and prioritizes across all detection methods.
 */
export async function findOpportunities(
  clientId: string
): Promise<Opportunity[]> {
  const [ctrOpps, rankingGaps, quickWins] = await Promise.all([
    detectCTROpportunities(clientId),
    detectRankingGaps(clientId),
    detectQuickWins(clientId),
  ]);

  const allOpportunities = [...ctrOpps, ...rankingGaps, ...quickWins];

  // Sort by priority (highest first)
  return prioritizeOpportunities(allOpportunities);
}

/**
 * Sort opportunities by priority (impact/effort ratio).
 * Higher priority = better opportunity.
 */
export function prioritizeOpportunities(
  opportunities: Opportunity[]
): Opportunity[] {
  return [...opportunities].sort((a, b) => b.priority - a.priority);
}

/**
 * Truncate string with ellipsis.
 */
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + "...";
}
