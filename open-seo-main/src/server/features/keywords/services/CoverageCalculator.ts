import { db } from "@/db";
import { prospectKeywords } from "@/db/prospect-keyword-schema";
import { researchSessions } from "@/db/research-session-schema";
import { eq, sql, and, or, isNull, notInArray, desc, count } from "drizzle-orm";

/**
 * Coverage level classification per 93-RESEARCH.md
 */
export type CoverageLevel = 'comprehensive' | 'moderate' | 'minimal' | 'missing';

/**
 * Coverage by tier (proxy for service line until full clustering persisted)
 */
export interface TierCoverage {
  tier: string;
  keywordCount: number;
  avgSearchVolume: number;
  coverageLevel: CoverageLevel;
}

/**
 * Overall coverage summary for a prospect
 */
export interface CoverageSummary {
  totalKeywords: number;
  totalActiveKeywords: number;  // Excluding excluded/ignored
  lastResearchedAt: Date | null;
  tiers: TierCoverage[];
  suggestedAction: string | null;  // e.g., "Consider EXPAND research" or null if comprehensive
}

/**
 * Classify coverage level based on keyword count.
 * Thresholds from 93-RESEARCH.md.
 */
function classifyCoverage(count: number): CoverageLevel {
  if (count >= 100) return 'comprehensive';
  if (count >= 30) return 'moderate';
  if (count >= 10) return 'minimal';
  return 'missing';
}

/**
 * CoverageCalculator - computes keyword coverage metrics for prospects.
 * Used by coverage dashboard to show gaps before allowing new research.
 */
export class CoverageCalculator {
  /**
   * Calculate coverage for a prospect.
   * Groups keywords by tier and computes coverage levels.
   * 
   * Per 93-RESEARCH.md pitfall #3:
   * - Excludes tier='excluded' (geo-filtered)
   * - Excludes tier='ignore' (user intentionally ignored)
   */
  async calculateCoverage(prospectId: string): Promise<CoverageSummary> {
    // Excluded tiers that should NOT count toward coverage
    const excludedTiers = ['excluded', 'ignore'];

    // Get total keyword count (all tiers)
    const [totalResult] = await db
      .select({ count: count() })
      .from(prospectKeywords)
      .where(eq(prospectKeywords.prospectId, prospectId));
    
    const totalKeywords = totalResult?.count ?? 0;

    // Aggregate by tier, excluding excluded/ignored
    const tierStats = await db
      .select({
        tier: prospectKeywords.tier,
        keywordCount: count(),
        avgVolume: sql<number>`COALESCE(AVG(${prospectKeywords.searchVolume}), 0)::int`,
      })
      .from(prospectKeywords)
      .where(
        and(
          eq(prospectKeywords.prospectId, prospectId),
          or(
            isNull(prospectKeywords.tier),
            notInArray(prospectKeywords.tier, excludedTiers)
          )
        )
      )
      .groupBy(prospectKeywords.tier);

    // Map to TierCoverage
    const tiers: TierCoverage[] = tierStats.map(t => ({
      tier: t.tier || 'unclassified',
      keywordCount: Number(t.keywordCount),
      avgSearchVolume: t.avgVolume,
      coverageLevel: classifyCoverage(Number(t.keywordCount)),
    }));

    // Calculate total active (non-excluded, non-ignored)
    const totalActiveKeywords = tiers.reduce((sum, t) => sum + t.keywordCount, 0);

    // Get last research date
    const lastSession = await db
      .select({ createdAt: researchSessions.createdAt })
      .from(researchSessions)
      .where(eq(researchSessions.prospectId, prospectId))
      .orderBy(desc(researchSessions.createdAt))
      .limit(1);

    const lastResearchedAt = lastSession[0]?.createdAt || null;

    // Determine suggested action
    let suggestedAction: string | null = null;
    if (totalActiveKeywords === 0) {
      suggestedAction = 'No keywords researched. Start with EXPAND mode.';
    } else if (totalActiveKeywords < 30) {
      suggestedAction = 'Coverage is minimal. Consider EXPAND research for broader coverage.';
    } else {
      const hasMinimalTier = tiers.some(t => t.coverageLevel === 'minimal' || t.coverageLevel === 'missing');
      if (hasMinimalTier) {
        suggestedAction = 'Some tiers have low coverage. Consider DEEP-DIVE into weak areas.';
      }
      // null = coverage is sufficient
    }

    return {
      totalKeywords,
      totalActiveKeywords,
      lastResearchedAt,
      tiers,
      suggestedAction,
    };
  }
}

export const coverageCalculator = new CoverageCalculator();
