/**
 * CacheWarmer - Pre-warming Cache for Performance
 * Phase 95-13: E2E Testing & Migration Rollout
 *
 * Proactively populates cache to improve hit rates:
 * - Batch warming with concurrency control
 * - Audit-specific warming
 * - Competitor domain warming
 * - Progress tracking and cost tracking
 */

import type { ScrapingService } from '../ScrapingService';
import type { CacheManager } from './CacheManager';
import type { ScrapeTier } from '@/db/domain-scrape-learning-schema';
import { cacheLogger } from '../logging';

// =============================================================================
// Types
// =============================================================================

/**
 * Cache warming configuration.
 */
export interface WarmingConfig {
  /** URLs to warm */
  urls: string[];
  /** Priority level for warming requests */
  priority: 'high' | 'normal' | 'low';
  /** Maximum concurrent requests */
  concurrency: number;
  /** Client ID for cost attribution */
  clientId: string;
  /** Optional progress callback */
  onProgress?: (progress: WarmingProgress) => void;
  /** Optional timeout per request in milliseconds */
  timeoutMs?: number;
  /** Skip URLs that fail (continue warming) */
  skipOnError?: boolean;
}

/**
 * Warming progress data.
 */
export interface WarmingProgress {
  total: number;
  warmed: number;
  alreadyCached: number;
  failed: number;
  currentUrl: string;
  elapsedMs: number;
}

/**
 * Cache warming result.
 */
export interface WarmingResult {
  /** Total URLs processed */
  total: number;
  /** URLs successfully warmed (fetched and cached) */
  warmed: number;
  /** URLs already in cache (skipped) */
  alreadyCached: number;
  /** URLs that failed to fetch */
  failed: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Total cost in USD */
  costUsd: number;
  /** Tier distribution of warmed URLs */
  tierDistribution: Record<ScrapeTier, number>;
  /** Failed URLs with error messages */
  failedUrls: Array<{ url: string; error: string }>;
}

// =============================================================================
// CacheWarmer Implementation
// =============================================================================

/**
 * CacheWarmer proactively populates cache for improved performance.
 *
 * @example
 * ```typescript
 * const warmer = new CacheWarmer(scrapingService, cacheManager);
 *
 * // Warm specific URLs
 * const result = await warmer.warmCache({
 *   urls: ['https://example.com', 'https://example.org'],
 *   priority: 'normal',
 *   concurrency: 10,
 *   clientId: 'audit-123',
 * });
 *
 * // Warm for an audit
 * const auditResult = await warmer.warmForAudit('audit-123', 'client-456');
 *
 * // Warm competitor domains
 * const competitorResult = await warmer.warmCompetitorDomains(
 *   ['competitor1.com', 'competitor2.com'],
 *   'client-456'
 * );
 * ```
 */
export class CacheWarmer {
  private service: ScrapingService;
  private cacheManager: CacheManager | null;

  constructor(service: ScrapingService, cacheManager: CacheManager | null = null) {
    this.service = service;
    this.cacheManager = cacheManager;
  }

  /**
   * Warm cache with the given URLs.
   */
  async warmCache(config: WarmingConfig): Promise<WarmingResult> {
    const { urls, priority, concurrency, clientId, onProgress, timeoutMs, skipOnError = true } = config;
    const startTime = Date.now();

    let warmed = 0;
    let alreadyCached = 0;
    let failed = 0;
    let totalCost = 0;
    const failedUrls: Array<{ url: string; error: string }> = [];
    const tierDistribution: Record<ScrapeTier, number> = {
      direct: 0,
      webshare: 0,
      geonode: 0,
      camoufox: 0,
      dfs_basic: 0,
      dfs_js: 0,
      dfs_browser: 0,
    };

    // Process in batches
    for (let i = 0; i < urls.length; i += concurrency) {
      const batch = urls.slice(i, i + concurrency);

      const results = await Promise.allSettled(
        batch.map(async (url): Promise<{
          status: 'cached' | 'warmed' | 'failed';
          cost?: number;
          tier?: ScrapeTier;
          error?: string;
        }> => {
          try {
            // Check if already cached
            if (this.cacheManager) {
              const cached = await this.cacheManager.get(url);
              if (cached.hit) {
                return { status: 'cached' };
              }
            }

            // Fetch and cache
            const result = await this.service.scrape(url, {
              clientId,
              feature: 'siteAudits',
              timeoutMs,
            });

            if (result.success) {
              return {
                status: 'warmed',
                cost: result.estimatedCostUsd,
                tier: result.tierUsed,
              };
            } else {
              return {
                status: 'failed',
                error: result.error ?? 'Unknown error',
              };
            }
          } catch (error) {
            return {
              status: 'failed',
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      // Process batch results
      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const url = batch[j];

        if (result.status === 'fulfilled') {
          const value = result.value;
          if (value.status === 'cached') {
            alreadyCached++;
          } else if (value.status === 'warmed') {
            warmed++;
            totalCost += value.cost || 0;
            if (value.tier) {
              tierDistribution[value.tier]++;
            }
          } else {
            failed++;
            failedUrls.push({ url, error: value.error ?? 'Unknown error' });
            if (!skipOnError) {
              throw new Error(`Failed to warm ${url}: ${value.error}`);
            }
          }
        } else {
          failed++;
          failedUrls.push({ url, error: result.reason?.message ?? 'Promise rejected' });
          if (!skipOnError) {
            throw result.reason;
          }
        }
      }

      // Report progress
      onProgress?.({
        total: urls.length,
        warmed,
        alreadyCached,
        failed,
        currentUrl: batch[batch.length - 1],
        elapsedMs: Date.now() - startTime,
      });

      // Rate limit between batches
      if (i + concurrency < urls.length) {
        await this.sleep(this.getDelayForPriority(priority));
      }
    }

    return {
      total: urls.length,
      warmed,
      alreadyCached,
      failed,
      durationMs: Date.now() - startTime,
      costUsd: totalCost,
      tierDistribution,
      failedUrls,
    };
  }

  /**
   * Warm cache for an audit job.
   * Fetches URLs from the audit job configuration.
   */
  async warmForAudit(auditId: string, clientId: string): Promise<WarmingResult> {
    // Get URLs from audit job
    const urls = await this.getAuditUrls(auditId);

    if (urls.length === 0) {
      return {
        total: 0,
        warmed: 0,
        alreadyCached: 0,
        failed: 0,
        durationMs: 0,
        costUsd: 0,
        tierDistribution: {
          direct: 0,
          webshare: 0,
          geonode: 0,
          camoufox: 0,
          dfs_basic: 0,
          dfs_js: 0,
          dfs_browser: 0,
        },
        failedUrls: [],
      };
    }

    return this.warmCache({
      urls,
      priority: 'normal',
      concurrency: 10,
      clientId,
    });
  }

  /**
   * Warm cache for competitor domains.
   * Generates common page paths for each domain.
   */
  async warmCompetitorDomains(
    domains: string[],
    clientId: string
  ): Promise<WarmingResult> {
    // Generate common page paths for each domain
    const commonPaths = [
      '',
      '/about',
      '/about-us',
      '/contact',
      '/contact-us',
      '/services',
      '/products',
      '/pricing',
      '/features',
      '/blog',
    ];

    const urls = domains.flatMap((domain) =>
      commonPaths.map((path) => `https://${domain}${path}`)
    );

    return this.warmCache({
      urls,
      priority: 'low',
      concurrency: 5,
      clientId,
    });
  }

  /**
   * Warm cache for a sitemap.
   * Fetches and parses the sitemap, then warms all URLs.
   */
  async warmFromSitemap(
    sitemapUrl: string,
    clientId: string,
    options: {
      maxUrls?: number;
      priority?: 'high' | 'normal' | 'low';
    } = {}
  ): Promise<WarmingResult> {
    const { maxUrls = 1000, priority = 'low' } = options;

    // Fetch sitemap
    const urls = await this.parseSitemap(sitemapUrl, maxUrls);

    if (urls.length === 0) {
      return {
        total: 0,
        warmed: 0,
        alreadyCached: 0,
        failed: 0,
        durationMs: 0,
        costUsd: 0,
        tierDistribution: {
          direct: 0,
          webshare: 0,
          geonode: 0,
          camoufox: 0,
          dfs_basic: 0,
          dfs_js: 0,
          dfs_browser: 0,
        },
        failedUrls: [],
      };
    }

    return this.warmCache({
      urls,
      priority,
      concurrency: priority === 'high' ? 20 : priority === 'normal' ? 10 : 5,
      clientId,
    });
  }

  /**
   * Warm cache with intelligent prioritization.
   * High-traffic pages first, then content pages.
   */
  async warmIntelligent(
    domain: string,
    clientId: string,
    analytics?: {
      topPages?: string[];
      recentlyUpdated?: string[];
    }
  ): Promise<WarmingResult> {
    const urls: string[] = [];

    // 1. Add top pages from analytics (highest priority)
    if (analytics?.topPages) {
      urls.push(...analytics.topPages.slice(0, 50));
    }

    // 2. Add recently updated pages
    if (analytics?.recentlyUpdated) {
      const newUrls = analytics.recentlyUpdated.filter((u) => !urls.includes(u));
      urls.push(...newUrls.slice(0, 50));
    }

    // 3. Add homepage and common pages
    const commonPages = [
      `https://${domain}`,
      `https://${domain}/`,
      `https://${domain}/about`,
      `https://${domain}/contact`,
      `https://${domain}/products`,
      `https://${domain}/services`,
      `https://${domain}/blog`,
    ];

    for (const page of commonPages) {
      if (!urls.includes(page)) {
        urls.push(page);
      }
    }

    return this.warmCache({
      urls: urls.slice(0, 200), // Cap at 200 URLs
      priority: 'normal',
      concurrency: 10,
      clientId,
    });
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Get URLs from an audit job.
   */
  private async getAuditUrls(auditId: string): Promise<string[]> {
    // This would query the audit job from the database
    // For now, return empty array (caller can override)
    cacheLogger.info({ auditId }, 'Getting URLs for audit');

    // TODO: Implement actual audit URL retrieval
    // const job = await db.query.auditJobs.findFirst({
    //   where: eq(auditJobs.id, auditId),
    // });
    // return job?.targetUrls || [];

    return [];
  }

  /**
   * Parse sitemap and extract URLs.
   */
  private async parseSitemap(sitemapUrl: string, maxUrls: number): Promise<string[]> {
    try {
      // Fetch sitemap
      const result = await this.service.scrape(sitemapUrl, {
        clientId: 'cache-warmer',
        feature: 'siteAudits',
      });

      if (!result.success || !result.html) {
        cacheLogger.warn({ sitemapUrl }, 'Failed to fetch sitemap');
        return [];
      }

      // Parse XML sitemap
      const urls: string[] = [];
      const locRegex = /<loc>([^<]+)<\/loc>/gi;
      let match;

      while ((match = locRegex.exec(result.html)) !== null && urls.length < maxUrls) {
        const url = match[1].trim();
        if (url.startsWith('http')) {
          urls.push(url);
        }
      }

      return urls;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      cacheLogger.error({ sitemapUrl, error: err.message, stack: err.stack }, 'Error parsing sitemap');
      return [];
    }
  }

  /**
   * Get delay between batches based on priority.
   */
  private getDelayForPriority(priority: 'high' | 'normal' | 'low'): number {
    switch (priority) {
      case 'high':
        return 50; // 50ms between batches
      case 'normal':
        return 100; // 100ms between batches
      case 'low':
        return 200; // 200ms between batches
    }
  }

  /**
   * Sleep utility.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Singleton & Factory
// =============================================================================

let warmerInstance: CacheWarmer | null = null;

/**
 * Get the singleton CacheWarmer instance.
 * Must be initialized with setWarmerDependencies first.
 */
export function getCacheWarmer(): CacheWarmer {
  if (!warmerInstance) {
    throw new Error('CacheWarmer not initialized. Call setWarmerDependencies first.');
  }
  return warmerInstance;
}

/**
 * Initialize the CacheWarmer singleton.
 */
export function setWarmerDependencies(
  service: ScrapingService,
  cacheManager: CacheManager | null = null
): void {
  warmerInstance = new CacheWarmer(service, cacheManager);
}

/**
 * Create a new CacheWarmer instance.
 */
export function createCacheWarmer(
  service: ScrapingService,
  cacheManager: CacheManager | null = null
): CacheWarmer {
  return new CacheWarmer(service, cacheManager);
}
