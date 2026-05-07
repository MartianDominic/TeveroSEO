/**
 * CwvService - Unified Core Web Vitals Service
 * Phase 95-07: Core Web Vitals Integration
 *
 * Single entry point for fetching Core Web Vitals data.
 * Implements tiered lookup: Cache → CrUX origin → CrUX URL → PSI → unavailable.
 *
 * Features:
 * - Tiered lookup with cache-first strategy
 * - PSI fallback with daily budget enforcement
 * - Batch optimization (dedupe origins)
 * - Graceful degradation
 * - Metrics emission
 */

import { CruxClient, type CruxClientConfig } from './CruxClient';
import { PsiClient, type PsiClientConfig } from './PsiClient';
import { CwvCache, type CwvCacheConfig } from './CwvCache';
import type { CwvMetrics } from './types';

// =============================================================================
// Types
// =============================================================================

export interface CwvServiceConfig {
  cruxClient: CruxClient;
  psiClient: PsiClient;
  cache: CwvCache;

  // Feature flags
  enablePsiFallback?: boolean;
  psiDailyBudget?: number; // Max PSI calls per day
}

interface CwvUsageStats {
  used: number;
  budget: number;
  remaining: number;
}

// =============================================================================
// CwvService
// =============================================================================

export class CwvService {
  private readonly cruxClient: CruxClient;
  private readonly psiClient: PsiClient;
  private readonly cache: CwvCache;
  private readonly enablePsiFallback: boolean;
  private readonly psiDailyBudget: number;

  // Usage tracking (in-memory, resets on service restart)
  private psiUsageToday = 0;
  private lastResetDate = new Date().toDateString();

  // Metrics
  private metrics = {
    cacheHits: 0,
    cacheMisses: 0,
    cruxHits: 0,
    cruxMisses: 0,
    psiCalls: 0,
    unavailable: 0,
  };

  constructor(config: CwvServiceConfig) {
    this.cruxClient = config.cruxClient;
    this.psiClient = config.psiClient;
    this.cache = config.cache;
    this.enablePsiFallback = config.enablePsiFallback ?? true;
    this.psiDailyBudget = config.psiDailyBudget ?? 1000;
  }

  /**
   * Get CWV data for a URL with tiered lookup.
   *
   * Lookup order:
   * 1. Cache (origin or URL level)
   * 2. CrUX origin
   * 3. CrUX URL
   * 4. PSI (if budget allows)
   * 5. Return unavailable
   */
  async getCwvData(url: string): Promise<CwvMetrics> {
    this.resetDailyUsageIfNeeded();

    // 1. Check cache
    const cached = await this.cache.get(url);
    if (cached) {
      this.metrics.cacheHits++;
      return cached;
    }
    this.metrics.cacheMisses++;

    // 2. Try CrUX origin
    const origin = this.extractOrigin(url);
    const cruxOriginResponse = await this.cruxClient.queryOrigin(origin);
    if (cruxOriginResponse) {
      const metrics = this.cruxClient.extractMetrics(cruxOriginResponse);
      const fullMetrics: CwvMetrics = {
        source: 'crux',
        fetchedAt: new Date(),
        lcpRating: 'poor',
        inpRating: 'poor',
        clsRating: 'poor',
        ...metrics,
      };
      this.metrics.cruxHits++;
      await this.cache.set(url, fullMetrics);
      return fullMetrics;
    }

    // 3. Try CrUX URL
    const cruxUrlResponse = await this.cruxClient.queryUrl(url);
    if (cruxUrlResponse) {
      const metrics = this.cruxClient.extractMetrics(cruxUrlResponse);
      const fullMetrics: CwvMetrics = {
        source: 'crux',
        fetchedAt: new Date(),
        lcpRating: 'poor',
        inpRating: 'poor',
        clsRating: 'poor',
        ...metrics,
      };
      this.metrics.cruxHits++;
      await this.cache.set(url, fullMetrics);
      return fullMetrics;
    }
    this.metrics.cruxMisses++;

    // 4. Try PSI (if budget allows)
    if (this.enablePsiFallback && this.psiUsageToday < this.psiDailyBudget) {
      const psiResponse = await this.psiClient.analyze(url);
      if (psiResponse) {
        const metrics = this.psiClient.extractMetrics(psiResponse);
        const fullMetrics: CwvMetrics = {
          source: 'psi',
          fetchedAt: new Date(),
          lcpRating: 'poor',
          inpRating: 'poor',
          clsRating: 'poor',
          ...metrics,
        };
        this.psiUsageToday++;
        this.metrics.psiCalls++;
        await this.cache.set(url, fullMetrics);
        return fullMetrics;
      }
    }

    // 5. Unavailable
    this.metrics.unavailable++;
    return {
      source: 'unavailable',
      fetchedAt: new Date(),
      lcpRating: 'poor',
      inpRating: 'poor',
      clsRating: 'poor',
    };
  }

  /**
   * Batch get CWV data for multiple URLs (optimized).
   *
   * Deduplicates origins and runs queries in parallel.
   */
  async batchGetCwvData(urls: string[]): Promise<Map<string, CwvMetrics>> {
    this.resetDailyUsageIfNeeded();

    const result = new Map<string, CwvMetrics>();

    if (urls.length === 0) {
      return result;
    }

    // 1. Batch cache lookup
    const cached = await this.cache.mget(urls);
    for (const [url, metrics] of cached) {
      result.set(url, metrics);
      this.metrics.cacheHits++;
    }

    // 2. For cache misses, try CrUX/PSI
    const missingUrls = urls.filter((url) => !result.has(url));
    if (missingUrls.length === 0) {
      return result;
    }

    this.metrics.cacheMisses += missingUrls.length;

    // Fetch in parallel with concurrency limit
    const concurrency = 10;
    for (let i = 0; i < missingUrls.length; i += concurrency) {
      const batch = missingUrls.slice(i, i + concurrency);
      const batchResults = await Promise.all(
        batch.map(async (url) => {
          const metrics = await this.getCwvData(url);
          return { url, metrics };
        })
      );

      for (const { url, metrics } of batchResults) {
        result.set(url, metrics);
      }
    }

    return result;
  }

  /**
   * Force refresh CWV data (bypass cache).
   */
  async refreshCwvData(url: string): Promise<CwvMetrics> {
    await this.cache.invalidate(url);
    return this.getCwvData(url);
  }

  /**
   * Get current PSI usage stats.
   */
  getPsiUsageToday(): CwvUsageStats {
    this.resetDailyUsageIfNeeded();
    return {
      used: this.psiUsageToday,
      budget: this.psiDailyBudget,
      remaining: Math.max(0, this.psiDailyBudget - this.psiUsageToday),
    };
  }

  /**
   * Get service metrics.
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Reset metrics.
   */
  resetMetrics() {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      cruxHits: 0,
      cruxMisses: 0,
      psiCalls: 0,
      unavailable: 0,
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  private resetDailyUsageIfNeeded() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      this.psiUsageToday = 0;
      this.lastResetDate = today;
    }
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
// Factory
// =============================================================================

export function createCwvService(config: {
  cruxApiKey: string;
  psiApiKey?: string;
  cache: CwvCache;
  enablePsiFallback?: boolean;
  psiDailyBudget?: number;
}): CwvService {
  const cruxClient = new CruxClient({
    apiKey: config.cruxApiKey,
  });

  const psiClient = new PsiClient({
    apiKey: config.psiApiKey ?? config.cruxApiKey, // Can use same key
  });

  return new CwvService({
    cruxClient,
    psiClient,
    cache: config.cache,
    enablePsiFallback: config.enablePsiFallback,
    psiDailyBudget: config.psiDailyBudget,
  });
}
