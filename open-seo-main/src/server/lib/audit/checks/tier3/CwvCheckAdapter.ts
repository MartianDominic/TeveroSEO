/**
 * CwvCheckAdapter - Adapter for Tier 3 CWV Checks
 * Phase 95-12: CWV Consolidation
 *
 * Provides a unified interface for Tier 3 checks to access CwvService.
 * Enables:
 * - PSI fallback for all checks
 * - Shared cache across audit checks
 * - Score calculation (0-100)
 * - Rating determination (good/needs-improvement/poor)
 */

import { CwvService } from '@/server/features/scraping/cwv/CwvService';
import { CruxClient } from '@/server/features/scraping/cwv/CruxClient';
import { PsiClient } from '@/server/features/scraping/cwv/PsiClient';
import {
  CWV_THRESHOLDS,
  type CwvMetrics,
  type CwvMetricName,
  type CwvRating,
} from '@/server/features/scraping/cwv/types';

// =============================================================================
// In-Memory Cache for Audit Sessions
// =============================================================================

/**
 * Simple in-memory cache that implements the CwvCache interface.
 * Used for audit sessions where Redis is not required.
 */
class InMemoryCwvCache {
  private cache = new Map<string, { data: CwvMetrics; expiry: number }>();
  private readonly ttlMs: number;

  constructor(ttlSeconds: number = 3600) {
    this.ttlMs = ttlSeconds * 1000;
  }

  async get(url: string): Promise<CwvMetrics | null> {
    const origin = this.extractOrigin(url);
    const entry = this.cache.get(origin) ?? this.cache.get(url);

    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.cache.delete(origin);
      this.cache.delete(url);
      return null;
    }

    return entry.data;
  }

  async set(url: string, metrics: CwvMetrics): Promise<void> {
    const key = metrics.source === 'crux' ? this.extractOrigin(url) : url;
    this.cache.set(key, {
      data: metrics,
      expiry: Date.now() + this.ttlMs,
    });
  }

  async mget(urls: string[]): Promise<Map<string, CwvMetrics>> {
    const result = new Map<string, CwvMetrics>();
    for (const url of urls) {
      const data = await this.get(url);
      if (data) result.set(url, data);
    }
    return result;
  }

  async invalidate(url: string): Promise<void> {
    const origin = this.extractOrigin(url);
    this.cache.delete(origin);
    this.cache.delete(url);
  }

  private extractOrigin(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.origin;
    } catch {
      return url;
    }
  }
}

// =============================================================================
// Types
// =============================================================================

export interface CwvCheckResult {
  /** Whether the check passed (good or needs-improvement) */
  pass: boolean;
  /** Score 0-100 (100 = good threshold, 0 = poor threshold) */
  score: number;
  /** Metric being evaluated */
  metric: CwvMetricName;
  /** P75 value */
  value: number;
  /** Thresholds used for evaluation */
  threshold: { good: number; poor: number };
  /** Rating based on Google's thresholds */
  rating: CwvRating;
  /** Data source */
  source: 'crux' | 'psi' | 'cache' | 'cwv_service';
  /** Detailed metrics */
  details: {
    p75: number;
    goodPercent: number;
    needsImprovementPercent: number;
    poorPercent: number;
  };
}

export interface CwvCheckAdapterConfig {
  /** Google API key for CrUX/PSI */
  apiKey?: string;
  /** Enable PSI fallback (default: true) */
  enablePsiFallback?: boolean;
  /** PSI daily budget (default: 1000) */
  psiDailyBudget?: number;
}

// =============================================================================
// CwvCheckAdapter
// =============================================================================

export class CwvCheckAdapter {
  private cwvService: CwvService | null = null;
  private readonly config: CwvCheckAdapterConfig;

  constructor(config?: CwvCheckAdapterConfig) {
    this.config = config ?? {};
  }

  /**
   * Get or create the CwvService instance.
   * Lazy initialization to avoid issues if API key is not set at startup.
   */
  private getService(): CwvService | null {
    if (this.cwvService) {
      return this.cwvService;
    }

    const apiKey = this.config.apiKey ?? process.env.GOOGLE_CWV_API_KEY;
    if (!apiKey) {
      return null;
    }

    // Create in-memory cache for audit session
    const cache = new InMemoryCwvCache(3600); // 1 hour TTL

    // Create CrUX and PSI clients
    const cruxClient = new CruxClient({ apiKey });
    const psiClient = new PsiClient({ apiKey });

    // Create CwvService with in-memory cache
    this.cwvService = new CwvService({
      cruxClient,
      psiClient,
      cache: cache as any, // InMemoryCwvCache implements same interface
      enablePsiFallback: this.config.enablePsiFallback ?? true,
      psiDailyBudget: this.config.psiDailyBudget ?? 1000,
    });

    return this.cwvService;
  }

  /**
   * Get CWV data for a URL.
   * Returns null if no data available or API key not configured.
   */
  async getCwvForCheck(url: string, _clientId?: string): Promise<CwvMetrics | null> {
    const service = this.getService();
    if (!service) {
      return null;
    }

    try {
      const result = await service.getCwvData(url);

      // Check if data is actually available
      if (result.source === 'unavailable') {
        return null;
      }

      return result;
    } catch (error) {
      // Log but don't fail the check
      console.warn(`CWV fetch failed for ${url}:`, error);
      return null;
    }
  }

  /**
   * Evaluate a single CWV metric.
   * Returns null if metric data is not available.
   */
  evaluateMetric(
    metrics: CwvMetrics | null,
    metricName: CwvMetricName
  ): CwvCheckResult | null {
    if (!metrics) return null;

    // Get the P75 value for this metric
    const value = this.getMetricValue(metrics, metricName);
    if (value === undefined || value === null) return null;

    const threshold = CWV_THRESHOLDS[metricName];

    // Determine rating based on thresholds
    let rating: CwvRating;
    if (value <= threshold.good) {
      rating = 'good';
    } else if (value <= threshold.poor) {
      rating = 'needs-improvement';
    } else {
      rating = 'poor';
    }

    // Calculate score (0-100)
    // Good = 100, Poor threshold = 0, linear interpolation in between
    let score: number;
    if (value <= threshold.good) {
      score = 100;
    } else if (value >= threshold.poor) {
      score = 0;
    } else {
      const range = threshold.poor - threshold.good;
      const delta = value - threshold.good;
      score = Math.round(100 * (1 - delta / range));
    }

    // Get distribution percentages from detailed metrics if available
    const distribution = this.getDistribution(metrics, metricName);

    return {
      pass: rating === 'good' || rating === 'needs-improvement',
      score,
      metric: metricName,
      value,
      threshold,
      rating,
      source: 'cwv_service',
      details: {
        p75: value,
        goodPercent: distribution.good,
        needsImprovementPercent: distribution.needsImprovement,
        poorPercent: distribution.poor,
      },
    };
  }

  /**
   * Convenience method: run a CWV check for a URL and metric.
   */
  async runCwvCheck(
    url: string,
    metricName: CwvMetricName,
    clientId?: string
  ): Promise<CwvCheckResult | null> {
    const cwvResult = await this.getCwvForCheck(url, clientId);
    if (!cwvResult) return null;
    return this.evaluateMetric(cwvResult, metricName);
  }

  /**
   * Get current service metrics (for monitoring).
   */
  getServiceMetrics() {
    const service = this.getService();
    return service?.getMetrics() ?? null;
  }

  /**
   * Get PSI usage stats.
   */
  getPsiUsage() {
    const service = this.getService();
    return service?.getPsiUsageToday() ?? null;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private getMetricValue(metrics: CwvMetrics, metricName: CwvMetricName): number | undefined {
    switch (metricName) {
      case 'lcp':
        return metrics.lcp;
      case 'fid':
        return metrics.fid;
      case 'cls':
        return metrics.cls;
      case 'inp':
        return metrics.inp;
      case 'ttfb':
        return metrics.ttfb;
      default:
        return undefined;
    }
  }

  private getDistribution(
    metrics: CwvMetrics,
    metricName: CwvMetricName
  ): { good: number; needsImprovement: number; poor: number } {
    // Default distribution when detailed metrics not available
    const defaultDist = { good: 0, needsImprovement: 0, poor: 0 };

    // Check for detailed metrics
    const detailedMetric = this.getDetailedMetric(metrics, metricName);
    if (detailedMetric) {
      return {
        good: detailedMetric.good,
        needsImprovement: detailedMetric.needsImprovement,
        poor: detailedMetric.poor,
      };
    }

    // Estimate distribution from rating if detailed not available
    const value = this.getMetricValue(metrics, metricName);
    if (value === undefined) return defaultDist;

    const threshold = CWV_THRESHOLDS[metricName];
    if (value <= threshold.good) {
      return { good: 100, needsImprovement: 0, poor: 0 };
    } else if (value <= threshold.poor) {
      return { good: 30, needsImprovement: 50, poor: 20 };
    } else {
      return { good: 10, needsImprovement: 20, poor: 70 };
    }
  }

  private getDetailedMetric(metrics: CwvMetrics, metricName: CwvMetricName) {
    switch (metricName) {
      case 'lcp':
        return metrics.lcpMetric;
      case 'fid':
        return metrics.fidMetric;
      case 'cls':
        return metrics.clsMetric;
      case 'inp':
        return metrics.inpMetric;
      case 'ttfb':
        return metrics.ttfbMetric;
      default:
        return undefined;
    }
  }
}

// =============================================================================
// Singleton
// =============================================================================

let adapterInstance: CwvCheckAdapter | null = null;

/**
 * Get the singleton CwvCheckAdapter instance.
 */
export function getCwvCheckAdapter(config?: CwvCheckAdapterConfig): CwvCheckAdapter {
  if (!adapterInstance) {
    adapterInstance = new CwvCheckAdapter(config);
  }
  return adapterInstance;
}

/**
 * Reset the adapter (for testing).
 */
export function resetCwvCheckAdapter(): void {
  adapterInstance = null;
}
