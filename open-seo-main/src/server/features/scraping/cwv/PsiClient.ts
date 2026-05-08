/**
 * PsiClient - PageSpeed Insights API Client
 * Phase 95-07: Core Web Vitals Integration
 *
 * Fetches lab-based Core Web Vitals data from PageSpeed Insights API.
 * Used as fallback when CrUX data is unavailable.
 *
 * Features:
 * - Lighthouse performance analysis
 * - Field data extraction when available
 * - Configurable strategy (mobile/desktop)
 * - Rate limit handling (400 req/100s)
 * - Performance score + raw metrics
 */

import type { CwvMetrics } from './types';
import { cruxLogger } from '../logging';

// =============================================================================
// Types
// =============================================================================

export interface PsiClientConfig {
  apiKey: string;
  timeout?: number;
  strategy?: 'mobile' | 'desktop';
  categories?: ('performance' | 'accessibility' | 'seo')[];
}

interface AuditResult {
  score: number | null;
  numericValue: number;
  displayValue: string;
}

interface PsiResponse {
  lighthouseResult: {
    categories: {
      performance: {
        score: number;
      };
    };
    audits: {
      'largest-contentful-paint': AuditResult;
      'cumulative-layout-shift': AuditResult;
      'total-blocking-time': AuditResult;
      'first-contentful-paint': AuditResult;
      'speed-index': AuditResult;
      interactive: AuditResult;
    };
  };
  loadingExperience?: {
    metrics: {
      LARGEST_CONTENTFUL_PAINT_MS?: { percentile: number };
      CUMULATIVE_LAYOUT_SHIFT_SCORE?: { percentile: number };
      INTERACTION_TO_NEXT_PAINT?: { percentile: number };
      FIRST_CONTENTFUL_PAINT_MS?: { percentile: number };
      EXPERIMENTAL_TIME_TO_FIRST_BYTE?: { percentile: number };
    };
  };
}

// =============================================================================
// PsiClient
// =============================================================================

export class PsiClient {
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly strategy: 'mobile' | 'desktop';
  private readonly _categories: string[]; // Reserved for future multi-category support
  private readonly baseUrl = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

  constructor(config: PsiClientConfig) {
    if (!config.apiKey) {
      throw new Error('PSI API key is required');
    }

    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30000; // 30s default for slow pages
    this.strategy = config.strategy ?? 'mobile';
    this._categories = config.categories ?? ['performance'];
  }

  /**
   * Run Lighthouse analysis via PSI API.
   */
  async analyze(url: string): Promise<PsiResponse | null> {
    try {
      const params = new URLSearchParams({
        url,
        key: this.apiKey,
        strategy: this.strategy,
        category: 'performance', // Only fetch performance to minimize response size
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 429) {
        cruxLogger.warn({ url }, 'PSI rate limit exceeded');
        return null;
      }

      if (!response.ok) {
        cruxLogger.error({ url, status: response.status, statusText: response.statusText }, 'PSI API error');
        return null;
      }

      const data = await response.json();
      return data as PsiResponse;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        cruxLogger.warn({ url }, 'PSI request timeout');
      } else {
        const err = error instanceof Error ? error : new Error(String(error));
        cruxLogger.error({ url, error: err.message, stack: err.stack }, 'PSI request failed');
      }
      return null;
    }
  }

  /**
   * Extract CWV metrics from PSI response.
   * Prefers field data over lab data when available.
   */
  extractMetrics(response: PsiResponse): Partial<CwvMetrics> {
    const hasFieldData = this.hasFieldData(response);
    const now = new Date();

    if (hasFieldData) {
      // Field data (real user data) available
      const fieldMetrics = response.loadingExperience!.metrics;
      return {
        source: 'psi',
        fetchedAt: now,
        lcp: fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile,
        cls: fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile
          ? fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
          : undefined,
        inp: fieldMetrics.INTERACTION_TO_NEXT_PAINT?.percentile,
        fcp: fieldMetrics.FIRST_CONTENTFUL_PAINT_MS?.percentile,
        ttfb: fieldMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE?.percentile,
        performanceScore: Math.round(
          response.lighthouseResult.categories.performance.score * 100
        ),
        lcpRating: this.rateLcp(fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile),
        inpRating: this.rateInp(fieldMetrics.INTERACTION_TO_NEXT_PAINT?.percentile),
        clsRating: this.rateCls(
          fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile
            ? fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100
            : undefined
        ),
      };
    }

    // Lab data only
    const { audits } = response.lighthouseResult;
    return {
      source: 'psi',
      fetchedAt: now,
      lcp: audits['largest-contentful-paint'].numericValue,
      cls: audits['cumulative-layout-shift'].numericValue,
      fcp: audits['first-contentful-paint'].numericValue,
      si: audits['speed-index'].numericValue,
      tbt: audits['total-blocking-time'].numericValue,
      performanceScore: Math.round(
        response.lighthouseResult.categories.performance.score * 100
      ),
      lcpRating: this.rateLcp(audits['largest-contentful-paint'].numericValue),
      inpRating: 'poor', // Lab data doesn't have INP
      clsRating: this.rateCls(audits['cumulative-layout-shift'].numericValue),
    };
  }

  /**
   * Check if field data (real user data) is available in response.
   */
  hasFieldData(response: PsiResponse): boolean {
    return !!response.loadingExperience?.metrics;
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private rateLcp(lcp: number | undefined): 'good' | 'needs-improvement' | 'poor' {
    if (!lcp) return 'poor';
    if (lcp <= 2500) return 'good';
    if (lcp <= 4000) return 'needs-improvement';
    return 'poor';
  }

  private rateInp(inp: number | undefined): 'good' | 'needs-improvement' | 'poor' {
    if (!inp) return 'poor';
    if (inp <= 200) return 'good';
    if (inp <= 500) return 'needs-improvement';
    return 'poor';
  }

  private rateCls(cls: number | undefined): 'good' | 'needs-improvement' | 'poor' {
    if (!cls) return 'poor';
    if (cls <= 0.1) return 'good';
    if (cls <= 0.25) return 'needs-improvement';
    return 'poor';
  }
}
