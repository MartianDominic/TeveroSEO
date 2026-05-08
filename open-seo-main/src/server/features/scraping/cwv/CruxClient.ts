/**
 * CruxClient - Chrome UX Report API Client
 * Phase 95-07: Core Web Vitals Integration
 * Phase 95-18: Resilience Hardening - Rate Limit Integration
 *
 * Fetches real-user Core Web Vitals data from the Chrome UX Report API.
 * Provides origin-level and URL-level queries with P75 metric extraction.
 *
 * Features:
 * - Origin-level queries (higher coverage)
 * - URL-level queries (page-specific data)
 * - P75 metric extraction from histogram data
 * - Exponential backoff retry logic
 * - Rate limit handling (25,000/day free tier)
 * - Integrated rate limit tracking (95-18)
 */

import type { CwvMetrics } from './types';
import { getCruxRateLimiter } from './CruxRateLimiter';
import { cruxLogger } from '../logging';

// =============================================================================
// Types
// =============================================================================

export interface CruxClientConfig {
  apiKey: string;
  timeout?: number;
  retries?: number;
}

interface MetricData {
  histogram: Array<{
    start: number;
    end?: number;
    density: number;
  }>;
  percentiles: {
    p75: number;
  };
}

interface CruxResponse {
  record: {
    key: {
      origin?: string;
      url?: string;
    };
    metrics: {
      largest_contentful_paint?: MetricData;
      interaction_to_next_paint?: MetricData;
      cumulative_layout_shift?: MetricData;
      first_input_delay?: MetricData;
      first_contentful_paint?: MetricData;
      experimental_time_to_first_byte?: MetricData;
    };
  };
}

// =============================================================================
// CruxClient
// =============================================================================

export class CruxClient {
  private readonly apiKey: string;
  private readonly timeout: number;
  private readonly retries: number;
  private readonly baseUrl = 'https://chromeuxreport.googleapis.com/v1/records:queryRecord';

  constructor(config: CruxClientConfig) {
    if (!config.apiKey) {
      throw new Error('CrUX API key is required');
    }

    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 10000;
    this.retries = config.retries ?? 3;
  }

  /**
   * Query CrUX by origin (domain-level).
   * Higher hit rate than URL-level queries.
   */
  async queryOrigin(origin: string): Promise<CruxResponse | null> {
    return this.query({ origin });
  }

  /**
   * Query CrUX by URL (page-level).
   * Lower hit rate, but more specific data.
   */
  async queryUrl(url: string): Promise<CruxResponse | null> {
    return this.query({ url });
  }

  /**
   * Extract CWV metrics from CrUX response.
   */
  extractMetrics(response: CruxResponse): Partial<CwvMetrics> {
    const { metrics } = response.record;
    const now = new Date();

    return {
      source: 'crux',
      fetchedAt: now,
      lcp: metrics.largest_contentful_paint?.percentiles.p75,
      inp: metrics.interaction_to_next_paint?.percentiles.p75,
      cls: metrics.cumulative_layout_shift?.percentiles.p75,
      fid: metrics.first_input_delay?.percentiles.p75,
      fcp: metrics.first_contentful_paint?.percentiles.p75,
      ttfb: metrics.experimental_time_to_first_byte?.percentiles.p75,
      lcpRating: this.rateLcp(metrics.largest_contentful_paint?.percentiles.p75),
      inpRating: this.rateInp(metrics.interaction_to_next_paint?.percentiles.p75),
      clsRating: this.rateCls(metrics.cumulative_layout_shift?.percentiles.p75),
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private async query(
    key: { origin?: string; url?: string }
  ): Promise<CruxResponse | null> {
    // Check rate limit before making request
    const rateLimiter = getCruxRateLimiter();
    const canProceed = await rateLimiter.canMakeRequest();

    if (!canProceed) {
      // Quota exhausted - return null to trigger PSI fallback
      return null;
    }

    let attempt = 0;

    while (attempt <= this.retries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(key),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Record request even on failure (counts against quota)
        await rateLimiter.recordRequest();

        // 404 means not in dataset - not an error
        if (response.status === 404) {
          return null;
        }

        if (!response.ok) {
          throw new Error(`CrUX API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data as CruxResponse;
      } catch (error) {
        // Record request on error too (request was made)
        await rateLimiter.recordRequest();

        attempt++;

        if (attempt > this.retries) {
          const err = error instanceof Error ? error : new Error(String(error));
          cruxLogger.error({ error: err.message, stack: err.stack, retries: this.retries }, 'CrUX query failed after retries');
          return null;
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 8000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    return null;
  }

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
