/**
 * CannibalizationScorer - Risk Scoring Algorithms
 *
 * Single responsibility: Calculate severity, impact, and recommendations
 * for cannibalization issues.
 *
 * SEVERITY TIERS (4-tier model):
 * - CRITICAL: >5 pages competing OR top 3 all in positions 1-5
 * - HIGH: >3 pages OR top 2 in positions 1-10 with similar impressions
 * - MEDIUM: 2-3 pages with distributed traffic (no page >70% impressions)
 * - LOW: 2 pages where one dominates (>80% impressions)
 */
import type { CannibalizationSeverity } from '@/db/link-schema';
import { getExpectedCtr } from '../utils/ctr-benchmark-calculator';

// =============================================================================
// Type Definitions
// =============================================================================

export interface CannibalizingPage {
  pageUrl: string;
  clicks: number;
  impressions: number;
  avgPosition: number;
  ctr: number;
  impressionShare: number;
}

export interface ImpactEstimate {
  dailyLostClicks: number;
  monthlyLostClicks: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface Recommendation {
  action: 'consolidate' | 'canonical' | 'redirect' | 'differentiate';
  primaryPage: string;
  secondaryPages: string[];
  rationale: string;
  priority: number;
}

export interface CannibalizationIssue {
  id?: string;
  query: string;
  pages: CannibalizingPage[];
  severity: CannibalizationSeverity;
  impactEstimate: ImpactEstimate;
  recommendation: Recommendation;
  detectedAt?: Date;
  status?: 'new' | 'detected' | 'acknowledged' | 'in_progress' | 'resolved' | 'ignored' | 'monitoring';
}

export interface DetectionSummary {
  total: number;
  bySeverity: Record<CannibalizationSeverity, number>;
  totalMonthlyImpact: number;
  topPriorityIssues: CannibalizationIssue[];
}

// =============================================================================
// CannibalizationScorer Class
// =============================================================================

export class CannibalizationScorer {
  /**
   * Create a complete CannibalizationIssue from query and pages.
   */
  createIssue(query: string, pages: CannibalizingPage[]): CannibalizationIssue {
    const severity = this.calculateSeverity(pages);
    const impactEstimate = this.calculateImpact(pages);
    const recommendation = this.generateRecommendation(pages, query);

    return {
      query,
      pages,
      severity,
      impactEstimate,
      recommendation,
      detectedAt: new Date(),
      status: 'new',
    };
  }

  /**
   * Calculate severity using the 4-tier model.
   *
   * CRITICAL: >5 pages competing OR top 3 all in positions 1-5
   * HIGH: >3 pages OR top 2 in positions 1-10 with similar impressions
   * MEDIUM: 2-3 pages with distributed traffic (no page >70% impressions)
   * LOW: 2 pages where one dominates (>80% impressions)
   */
  calculateSeverity(pages: CannibalizingPage[]): CannibalizationSeverity {
    const pageCount = pages.length;

    // CRITICAL: More than 5 pages competing
    if (pageCount > 5) {
      return 'critical';
    }

    // Sort by position to analyze top performers
    const sortedByPosition = [...pages].sort((a, b) => a.avgPosition - b.avgPosition);

    // CRITICAL: Top 3 pages all in positions 1-5
    if (pageCount >= 3) {
      const top3Positions = sortedByPosition.slice(0, 3).map(p => p.avgPosition);
      if (top3Positions.every(pos => pos <= 5)) {
        return 'critical';
      }
    }

    // HIGH: More than 3 pages competing
    if (pageCount > 3) {
      return 'high';
    }

    // Check top 2 positions and impression distribution
    const top2Positions = sortedByPosition.slice(0, 2).map(p => p.avgPosition);
    const maxImpressionShare = Math.max(...pages.map(p => p.impressionShare));

    // HIGH: Top 2 pages both in top 10 with similar traffic
    if (top2Positions.every(pos => pos <= 10) && maxImpressionShare < 0.7) {
      return 'high';
    }

    // LOW: One page dominates (>80% of impressions)
    if (maxImpressionShare > 0.8) {
      return 'low';
    }

    // MEDIUM: Everything else (2-3 pages with distributed traffic)
    return 'medium';
  }

  /**
   * Calculate impact estimate using AWR CTR benchmarks.
   *
   * Estimates the potential clicks if all impressions went to a
   * consolidated page at the best achieved position.
   */
  calculateImpact(pages: CannibalizingPage[]): ImpactEstimate {
    const totalImpressions = pages.reduce((sum, p) => sum + p.impressions, 0);
    const totalClicks = pages.reduce((sum, p) => sum + p.clicks, 0);

    // Find best position achieved
    const bestPosition = Math.min(...pages.map(p => p.avgPosition));
    const targetCTR = getExpectedCtr(bestPosition);

    // Estimate potential clicks if consolidated
    const potentialClicks = totalImpressions * targetCTR;
    const dailyLostClicks = Math.max(0, Math.round(potentialClicks - totalClicks));

    // Confidence based on impression volume
    let confidence: 'high' | 'medium' | 'low';
    if (totalImpressions >= 10000) {
      confidence = 'high';
    } else if (totalImpressions >= 1000) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }

    return {
      dailyLostClicks,
      monthlyLostClicks: dailyLostClicks * 30,
      confidence,
    };
  }

  /**
   * Generate actionable recommendation based on page data.
   */
  generateRecommendation(pages: CannibalizingPage[], query: string): Recommendation {
    // Sort by combined metric: clicks + (impressions * position weight)
    const sortedPages = [...pages].sort((a, b) => {
      const scoreA = a.clicks + (a.impressions * (1 / (a.avgPosition + 1)));
      const scoreB = b.clicks + (b.impressions * (1 / (b.avgPosition + 1)));
      return scoreB - scoreA;
    });

    const primaryPage = sortedPages[0];
    const secondaryPages = sortedPages.slice(1);
    const pageCount = pages.length;

    // Determine action based on severity and patterns
    let action: Recommendation['action'];
    let rationale: string;
    let priority: number;

    // Check for position/traffic mismatch
    const bestRankedPage = [...pages].sort((a, b) => a.avgPosition - b.avgPosition)[0];
    const hasMismatch = bestRankedPage.pageUrl !== primaryPage.pageUrl;

    if (pageCount > 3) {
      action = 'consolidate';
      rationale = `${pageCount} pages compete for "${query}". Consolidate content to ${this.getSlug(primaryPage.pageUrl)} and redirect others.`;
      priority = Math.min(100, 60 + (pageCount * 5));
    } else if (hasMismatch) {
      action = 'differentiate';
      rationale = `${this.getSlug(bestRankedPage.pageUrl)} ranks higher (pos ${bestRankedPage.avgPosition.toFixed(1)}) but ${this.getSlug(primaryPage.pageUrl)} gets more traffic. Evaluate which page better serves user intent for "${query}".`;
      priority = 70;
    } else if (secondaryPages.length === 1 && secondaryPages[0].impressionShare < 0.3) {
      action = 'redirect';
      rationale = `301 redirect ${this.getSlug(secondaryPages[0].pageUrl)} to ${this.getSlug(primaryPage.pageUrl)} since it has minimal traffic share.`;
      priority = 50;
    } else {
      action = 'canonical';
      rationale = `Add canonical tag from secondary pages to ${this.getSlug(primaryPage.pageUrl)}, or merge content for "${query}".`;
      priority = 55;
    }

    return {
      action,
      primaryPage: primaryPage.pageUrl,
      secondaryPages: secondaryPages.map(p => p.pageUrl),
      rationale,
      priority,
    };
  }

  /**
   * Calculate summary statistics from issues.
   */
  calculateSummary(issues: CannibalizationIssue[]): DetectionSummary {
    const bySeverity: Record<CannibalizationSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    };

    let totalMonthlyImpact = 0;

    for (const issue of issues) {
      bySeverity[issue.severity]++;
      totalMonthlyImpact += issue.impactEstimate.monthlyLostClicks;
    }

    // Top 5 priority issues
    const topPriorityIssues = [...issues]
      .sort((a, b) => b.recommendation.priority - a.recommendation.priority)
      .slice(0, 5);

    return {
      total: issues.length,
      bySeverity,
      totalMonthlyImpact,
      topPriorityIssues,
    };
  }

  /**
   * Extract readable slug from URL.
   */
  private getSlug(url: string): string {
    try {
      const path = new URL(url).pathname;
      return path.length > 40 ? path.substring(0, 40) + '...' : path;
    } catch {
      return url.substring(0, 40);
    }
  }
}

// =============================================================================
// Singleton
// =============================================================================

let instance: CannibalizationScorer | null = null;

export function getCannibalizationScorer(): CannibalizationScorer {
  if (!instance) {
    instance = new CannibalizationScorer();
  }
  return instance;
}

export function resetCannibalizationScorer(): void {
  instance = null;
}
