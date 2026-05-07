/**
 * PerformanceAnalyzer - Core Web Vitals Performance Analysis
 * Phase 95-07: Core Web Vitals Integration
 *
 * Analyzes page performance using CWV data from the scraping infrastructure.
 * Generates scores and recommendations based on Google's thresholds.
 *
 * Features:
 * - CWV-based scoring (LCP, INP, CLS)
 * - Overall performance grade calculation
 * - Recommendations for poor metrics
 * - Data source transparency
 */

import type { CwvMetrics } from '../../scraping/cwv/types';

// =============================================================================
// Types
// =============================================================================

export interface Score {
  score: number | null;
  status: 'good' | 'needs-improvement' | 'poor' | 'unavailable';
}

export interface PerformanceAnalysis {
  // Individual metric scores
  lcpScore: Score;
  inpScore: Score;
  clsScore: Score;

  // Overall grade
  performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A';

  // Recommendations
  recommendations: string[];

  // Data source and freshness
  dataSource: 'crux' | 'psi' | 'unavailable';
  dataFreshness: Date | null;
}

// =============================================================================
// PerformanceAnalyzer
// =============================================================================

export class PerformanceAnalyzer {
  /**
   * Analyze performance based on CWV metrics.
   */
  analyze(cwv: CwvMetrics | undefined): PerformanceAnalysis {
    if (!cwv || cwv.source === 'unavailable') {
      return this.unavailableAnalysis();
    }

    const lcpScore = this.scoreLcp(cwv.lcp);
    const inpScore = this.scoreInp(cwv.inp);
    const clsScore = this.scoreCls(cwv.cls);

    const performanceGrade = this.calculateGrade(lcpScore, inpScore, clsScore);
    const recommendations = this.generateRecommendations(cwv);

    return {
      lcpScore,
      inpScore,
      clsScore,
      performanceGrade,
      recommendations,
      dataSource: cwv.source,
      dataFreshness: cwv.fetchedAt,
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private scoreLcp(lcp: number | undefined): Score {
    if (!lcp) {
      return { score: null, status: 'unavailable' };
    }

    if (lcp <= 2500) {
      return { score: 100, status: 'good' };
    }

    if (lcp <= 4000) {
      // Linear scale from 100 to 50
      const score = 100 - ((lcp - 2500) / 1500) * 50;
      return { score: Math.round(score), status: 'needs-improvement' };
    }

    // Linear scale from 50 to 0 (cap at 8000ms)
    const score = Math.max(0, 50 - ((lcp - 4000) / 4000) * 50);
    return { score: Math.round(score), status: 'poor' };
  }

  private scoreInp(inp: number | undefined): Score {
    if (!inp) {
      return { score: null, status: 'unavailable' };
    }

    if (inp <= 200) {
      return { score: 100, status: 'good' };
    }

    if (inp <= 500) {
      // Linear scale from 100 to 50
      const score = 100 - ((inp - 200) / 300) * 50;
      return { score: Math.round(score), status: 'needs-improvement' };
    }

    // Linear scale from 50 to 0 (cap at 1000ms)
    const score = Math.max(0, 50 - ((inp - 500) / 500) * 50);
    return { score: Math.round(score), status: 'poor' };
  }

  private scoreCls(cls: number | undefined): Score {
    if (!cls) {
      return { score: null, status: 'unavailable' };
    }

    if (cls <= 0.1) {
      return { score: 100, status: 'good' };
    }

    if (cls <= 0.25) {
      // Linear scale from 100 to 50
      const score = 100 - ((cls - 0.1) / 0.15) * 50;
      return { score: Math.round(score), status: 'needs-improvement' };
    }

    // Linear scale from 50 to 0 (cap at 0.5)
    const score = Math.max(0, 50 - ((cls - 0.25) / 0.25) * 50);
    return { score: Math.round(score), status: 'poor' };
  }

  private calculateGrade(
    lcpScore: Score,
    inpScore: Score,
    clsScore: Score
  ): 'A' | 'B' | 'C' | 'D' | 'F' | 'N/A' {
    const scores = [lcpScore.score, inpScore.score, clsScore.score].filter(
      (s): s is number => s !== null
    );

    if (scores.length === 0) {
      return 'N/A';
    }

    const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;

    if (avgScore >= 90) return 'A';
    if (avgScore >= 75) return 'B';
    if (avgScore >= 60) return 'C';
    if (avgScore >= 40) return 'D';
    return 'F';
  }

  private generateRecommendations(cwv: CwvMetrics): string[] {
    const recommendations: string[] = [];

    // LCP recommendations
    if (cwv.lcp && cwv.lcp > 2500) {
      if (cwv.lcp > 4000) {
        recommendations.push(
          'Critical: Largest Contentful Paint is poor (>4s). Optimize server response time, render-blocking resources, and image loading.'
        );
      } else {
        recommendations.push(
          'Warning: Largest Contentful Paint needs improvement. Consider preloading key resources and optimizing largest content element.'
        );
      }
    }

    // INP recommendations
    if (cwv.inp && cwv.inp > 200) {
      if (cwv.inp > 500) {
        recommendations.push(
          'Critical: Interaction to Next Paint is poor (>500ms). Reduce JavaScript execution time and optimize event handlers.'
        );
      } else {
        recommendations.push(
          'Warning: Interaction to Next Paint needs improvement. Consider code splitting and reducing long tasks.'
        );
      }
    }

    // CLS recommendations
    if (cwv.cls && cwv.cls > 0.1) {
      if (cwv.cls > 0.25) {
        recommendations.push(
          'Critical: Cumulative Layout Shift is poor (>0.25). Add size attributes to images/videos and avoid inserting content above existing content.'
        );
      } else {
        recommendations.push(
          'Warning: Cumulative Layout Shift needs improvement. Reserve space for dynamic content and use CSS aspect-ratio.'
        );
      }
    }

    // TTFB recommendation (if available and slow)
    if (cwv.ttfb && cwv.ttfb > 800) {
      recommendations.push(
        'Server response time is slow. Consider caching, CDN, or upgrading server resources.'
      );
    }

    if (recommendations.length === 0) {
      recommendations.push(
        'All Core Web Vitals are in the "Good" range. Maintain current performance!'
      );
    }

    return recommendations;
  }

  private unavailableAnalysis(): PerformanceAnalysis {
    return {
      lcpScore: { score: null, status: 'unavailable' },
      inpScore: { score: null, status: 'unavailable' },
      clsScore: { score: null, status: 'unavailable' },
      performanceGrade: 'N/A',
      recommendations: [
        'Core Web Vitals data is not available for this page. It may not have enough traffic in the Chrome UX Report.',
      ],
      dataSource: 'unavailable',
      dataFreshness: null,
    };
  }
}
