/**
 * TieredFetcher - Cost-Optimized Web Scraping Orchestrator
 * Phase 95: Unified Scraping Infrastructure - TieredFetcher + Domain Learning
 *
 * Main entry point for all web scraping in TeveroSEO.
 * Automatically discovers and remembers the cheapest working tier for each domain.
 *
 * Tier escalation order (by cost):
 * - T0: Direct ($0) - Native fetch with rate limiting
 * - T1: Webshare ($0) - Free DC proxies
 * - T2: Geonode ($0.77/GB) - Residential proxies
 * - T2.5: Camoufox ($0.77/GB) - Stealth browser
 * - T3: DFS Basic ($0.000125/pg) - DataForSEO no JS
 * - T4: DFS JS ($0.00125/pg) - DataForSEO with JS
 * - T5: DFS Browser ($0.00425/pg) - DataForSEO full browser
 *
 * Target: 60%+ requests served by T0-T2, 90%+ cost reduction vs all-DFS
 */

import type { ScrapeTier, EscalationReason } from "@/db/domain-scrape-learning-schema";
import { TIER_COSTS, TIER_INDEX } from "@/db/domain-scrape-learning-schema";
import { domainLearningService, normalizeDomain } from "./DomainLearningService";
import { contentQualityAssessor } from "./ContentQualityAssessor";
import type {
  TieredFetchRequest,
  TieredFetchResult,
  ContentValidation,
} from "./types";
import type { CacheManager, CacheLevel, CachedPage, ContentType } from "./cache";
import { getContentHash, detectContentType } from "./cache";

// =============================================================================
// Types
// =============================================================================

export interface FetchOptions {
  /** Force a specific tier (skip learning) */
  forceTier?: ScrapeTier;

  /** Skip cache lookup */
  skipCache?: boolean;

  /** Skip domain learning (always use forceTier or startTier) */
  skipLearning?: boolean;

  /** Starting tier for discovery (default: direct) */
  startTier?: ScrapeTier;

  /** Maximum tier to try (default: dfs_browser) */
  maxTier?: ScrapeTier;

  /** Request timeout in milliseconds */
  timeoutMs?: number;

  /** Custom headers */
  headers?: Record<string, string>;

  /** Geo-targeting */
  geo?: { country?: string; region?: string };

  /** Client ID for cost attribution */
  clientId?: string;

  /** Job ID for correlation */
  jobId?: string;
}

export interface FetchResult {
  /** Request URL */
  url: string;

  /** Whether fetch was successful */
  success: boolean;

  /** HTML content (if successful) */
  html?: string;

  /** HTTP status code */
  statusCode: number;

  /** Tier that was used */
  tierUsed: ScrapeTier;

  /** Whether result came from cache */
  fromCache: boolean;

  /** Cache level if from cache */
  cacheLevel?: CacheLevel;

  /** Response time in milliseconds */
  responseTimeMs: number;

  /** Response size in bytes */
  responseSizeBytes: number;

  /** Estimated cost in USD */
  estimatedCostUsd: number;

  /** Content quality metrics */
  quality?: {
    score: number;
    acceptable: boolean;
    wordCount: number;
    textRatio: number;
  };

  /** Error message if failed */
  error?: string;

  /** Discovery info (if new domain) */
  discovery?: {
    isNewDomain: boolean;
    tiersAttempted: ScrapeTier[];
    escalationPath: Array<{ tier: ScrapeTier; reason: EscalationReason }>;
  };
}

// =============================================================================
// TieredFetcher
// =============================================================================

export class TieredFetcher {
  private cacheManager: CacheManager | null = null;

  /**
   * Set the cache manager for this fetcher.
   * Call this during initialization with your Redis and DB instances.
   */
  setCacheManager(cacheManager: CacheManager): void {
    this.cacheManager = cacheManager;
  }

  /**
   * Fetch a URL using the optimal tier for its domain.
   * Checks cache first (unless skipCache is set).
   */
  async fetch(url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const startTime = Date.now();
    const domain = normalizeDomain(url);

    // Check cache first (unless skipped)
    if (!options.skipCache && this.cacheManager) {
      try {
        const cacheResult = await this.cacheManager.get(url);
        if (cacheResult.hit && cacheResult.data) {
          // Return cached result
          return this.createCacheHitResult(url, cacheResult.data, cacheResult.level!, startTime);
        }
      } catch (error) {
        // Log but continue to network fetch on cache error
        console.error("[TieredFetcher] Cache lookup failed:", error);
      }
    }

    // Force tier mode - skip all learning
    if (options.forceTier) {
      const result = await this.fetchWithTier(url, options.forceTier, options, startTime);
      await this.storeToCacheIfSuccessful(url, result);
      return result;
    }

    // Check if we know the optimal tier
    if (!options.skipLearning) {
      const config = await domainLearningService.getConfig(domain);
      if (config && config.isValidated) {
        // Use known optimal tier
        const result = await this.fetchWithTier(
          url,
          config.optimalTier,
          options,
          startTime
        );

        // If it fails, trigger re-discovery
        if (!result.success && !options.skipLearning) {
          const discoveryResult = await this.discoverAndFetch(url, options, startTime);
          await this.storeToCacheIfSuccessful(url, discoveryResult);
          return discoveryResult;
        }

        await this.storeToCacheIfSuccessful(url, result);
        return result;
      }
    }

    // New domain or skip learning - run discovery
    const result = await this.discoverAndFetch(url, options, startTime);
    await this.storeToCacheIfSuccessful(url, result);
    return result;
  }

  /**
   * Create a FetchResult from a cache hit.
   */
  private createCacheHitResult(
    url: string,
    cached: CachedPage,
    level: CacheLevel,
    startTime: number
  ): FetchResult {
    // Assess quality from cached HTML
    let quality: FetchResult["quality"] | undefined;
    if (cached.html) {
      const assessment = contentQualityAssessor.assess(cached.html);
      quality = {
        score: assessment.score,
        acceptable: assessment.acceptable,
        wordCount: assessment.metrics.wordCount,
        textRatio: assessment.metrics.textRatio,
      };
    }

    return {
      url,
      success: true,
      html: cached.html,
      statusCode: cached.statusCode,
      tierUsed: cached.tierUsed,
      fromCache: true,
      cacheLevel: level,
      responseTimeMs: Date.now() - startTime,
      responseSizeBytes: cached.pageSizeBytes,
      estimatedCostUsd: 0, // No cost for cache hits!
      quality,
    };
  }

  /**
   * Store successful fetch result to cache.
   */
  private async storeToCacheIfSuccessful(url: string, result: FetchResult): Promise<void> {
    if (!this.cacheManager || !result.success || !result.html) {
      return;
    }

    try {
      const contentType = detectContentType(url, result.html);
      const cachedPage: CachedPage = {
        html: result.html,
        contentHash: getContentHash(result.html),
        fetchedAt: new Date(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Will be adjusted by TTL strategy
        tierUsed: result.tierUsed,
        statusCode: result.statusCode,
        pageSizeBytes: result.responseSizeBytes,
        contentType,
      };

      await this.cacheManager.set(url, cachedPage, { contentType });
    } catch (error) {
      // Log but don't fail the request
      console.error("[TieredFetcher] Failed to cache result:", error);
    }
  }

  /**
   * Fetch using the domain learning service (full discovery support).
   */
  private async discoverAndFetch(
    url: string,
    options: FetchOptions,
    startTime: number
  ): Promise<FetchResult> {
    const request: TieredFetchRequest = {
      url,
      startTier: options.startTier,
      maxTier: options.maxTier,
      timeoutMs: options.timeoutMs,
      headers: options.headers,
      geo: options.geo,
      clientId: options.clientId,
      jobId: options.jobId,
      skipCache: options.skipCache ?? false,
    };

    const result = await domainLearningService.fetch(request);

    return this.convertResult(url, result, startTime);
  }

  /**
   * Fetch directly with a specific tier.
   */
  private async fetchWithTier(
    url: string,
    tier: ScrapeTier,
    options: FetchOptions,
    startTime: number
  ): Promise<FetchResult> {
    const request: TieredFetchRequest = {
      url,
      startTier: tier,
      maxTier: tier, // Don't escalate when tier is specified
      timeoutMs: options.timeoutMs,
      headers: options.headers,
      geo: options.geo,
      clientId: options.clientId,
      jobId: options.jobId,
      skipCache: options.skipCache ?? false,
    };

    const result = await domainLearningService.fetch(request);

    return this.convertResult(url, result, startTime);
  }

  /**
   * Convert internal result format to public FetchResult.
   */
  private convertResult(
    url: string,
    result: TieredFetchResult,
    startTime: number
  ): FetchResult {
    // Assess content quality if we have HTML
    let quality: FetchResult["quality"] | undefined;
    if (result.html) {
      const assessment = contentQualityAssessor.assess(result.html);
      quality = {
        score: assessment.score,
        acceptable: assessment.acceptable,
        wordCount: assessment.metrics.wordCount,
        textRatio: assessment.metrics.textRatio,
      };
    }

    return {
      url,
      success: result.success,
      html: result.html,
      statusCode: result.statusCode,
      tierUsed: result.tier,
      fromCache: false, // Cache integration TODO
      responseTimeMs: result.responseTimeMs,
      responseSizeBytes: result.responseSizeBytes,
      estimatedCostUsd: result.costUsd,
      quality,
      error: result.error?.message,
      discovery: result.discovery,
    };
  }

  /**
   * Batch fetch multiple URLs efficiently.
   */
  async fetchBatch(
    urls: string[],
    options: FetchOptions & { concurrency?: number } = {}
  ): Promise<Map<string, FetchResult>> {
    const concurrency = options.concurrency ?? 10;
    const results = new Map<string, FetchResult>();
    const queue = [...urls];

    // Process in batches
    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const batchResults = await Promise.all(
        batch.map((url) => this.fetch(url, options).catch((error) => ({
          url,
          success: false,
          statusCode: 0,
          tierUsed: "direct" as ScrapeTier,
          fromCache: false,
          responseTimeMs: 0,
          responseSizeBytes: 0,
          estimatedCostUsd: 0,
          error: error instanceof Error ? error.message : String(error),
        })))
      );

      for (let i = 0; i < batch.length; i++) {
        results.set(batch[i], batchResults[i]);
      }
    }

    return results;
  }

  /**
   * Pre-discover optimal tier for a domain without fetching content.
   * Useful for warming up the tier cache before crawls.
   */
  async discoverDomain(domain: string): Promise<{
    domain: string;
    optimalTier: ScrapeTier;
    technologies: string[];
  }> {
    const discovery = await domainLearningService.discover({ domain });

    return {
      domain: discovery.domain,
      optimalTier: discovery.optimalTier,
      technologies: discovery.technologies,
    };
  }

  /**
   * Get cost estimate for fetching a URL.
   */
  async estimateCost(url: string): Promise<{
    domain: string;
    knownTier: ScrapeTier | null;
    estimatedCostUsd: number;
    estimatedTimeMs: number;
  }> {
    const domain = normalizeDomain(url);
    const config = await domainLearningService.getConfig(domain);

    const tier = config?.optimalTier ?? "dfs_basic"; // Conservative estimate
    const cost = TIER_COSTS[tier];
    const timeMs = this.getEstimatedTime(tier);

    return {
      domain,
      knownTier: config?.optimalTier ?? null,
      estimatedCostUsd: cost,
      estimatedTimeMs: timeMs,
    };
  }

  /**
   * Get estimated time for a tier.
   */
  private getEstimatedTime(tier: ScrapeTier): number {
    const times: Record<ScrapeTier, number> = {
      direct: 2000,
      webshare: 4000,
      geonode: 6000,
      camoufox: 15000,
      dfs_basic: 10000,
      dfs_js: 15000,
      dfs_browser: 20000,
    };
    return times[tier];
  }

  /**
   * Get statistics for domain learning.
   */
  async getDomainStats(domain: string): Promise<{
    domain: string;
    optimalTier: ScrapeTier | null;
    successRate: number;
    avgResponseTimeMs: number | null;
    totalRequests: number;
    technologies: string[];
  } | null> {
    const config = await domainLearningService.getConfig(domain);
    if (!config) {
      return null;
    }

    return {
      domain: config.domain,
      optimalTier: config.optimalTier,
      successRate: config.successRate,
      avgResponseTimeMs: config.avgResponseTimeMs,
      totalRequests: 0, // Would need to aggregate from history
      technologies: config.detectedTechnologies,
    };
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const tieredFetcher = new TieredFetcher();

/**
 * Create a new TieredFetcher instance (for testing or isolated use).
 */
export function createTieredFetcher(): TieredFetcher {
  return new TieredFetcher();
}
