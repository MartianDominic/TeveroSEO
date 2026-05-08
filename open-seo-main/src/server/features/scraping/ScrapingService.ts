/**
 * ScrapingService - Unified Scraping Facade
 * Phase 95-05: Migration & Monitoring
 *
 * Single entry point for all web scraping in TeveroSEO.
 * Combines TieredFetcher, CacheManager, DomainLearningService, and QueueManager
 * into a cohesive API with feature flag support for gradual rollout.
 *
 * Features:
 * - Single fetch: scrape(url, options)
 * - Batch fetch: scrapeBatch(urls, options)
 * - Cache warming: warmCache(urls)
 * - Metrics: getMetrics()
 * - Cost tracking: getCostReport(period)
 */

import type { Redis } from "ioredis";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { TieredFetcher, type FetchOptions, type FetchResult, type CircuitState } from "./TieredFetcher";
import { DomainLearningService } from "./DomainLearningService";
import { CacheManager, createCacheManager, type CacheStats } from "./cache";
import { QueueManager, getQueueManager, type EnqueueResult } from "./queue";
import type { ScrapeTier } from "@/db/domain-scrape-learning-schema";
import {
  loadMigrationFlagsCached,
  type ScrapingMigrationFlags,
  type ScrapingFeature,
} from "./config";
import type { CwvService } from "./cwv/CwvService";
import type { CwvMetrics } from "./cwv/types";
import { AlertManager } from "./monitoring/AlertManager";
import { getMetricsCollector, recordScrapeRequest, recordCircuitState } from "./monitoring/MetricsCollector";
import {
  logger,
  withRequestContextAsync,
  generateCorrelationId,
  logScrapeComplete,
  logScrapeError,
} from "./logging";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for a single scrape request.
 */
export interface ScrapeOptions extends FetchOptions {
  /** Feature making the request (for flag checking) */
  feature?: ScrapingFeature;

  /** Include pre-parsed HTML data in result */
  includeParsedData?: boolean;

  /** Include full HTML in result (default: true) */
  includeHtml?: boolean;

  /** Include Core Web Vitals data (default: false) */
  includeCwv?: boolean;

  /** CWV strategy: 'crux-only' skips PSI fallback, 'full' uses all sources */
  cwvStrategy?: 'crux-only' | 'full';

  /** Correlation ID for request tracing (auto-generated if not provided) */
  correlationId?: string;
}

/**
 * Result of a scrape request.
 */
export interface ScrapeResult extends FetchResult {
  /** Pre-parsed page data (if requested and available) */
  parsedData?: ParsedPageData;

  /** Core Web Vitals data (if requested and available) */
  cwv?: CwvMetrics;

  /** Correlation ID for request tracing */
  correlationId?: string;
}

/**
 * Pre-parsed page data from DataForSEO or cheerio.
 */
export interface ParsedPageData {
  title?: string;
  metaDescription?: string;
  h1?: string[];
  h2?: string[];
  canonical?: string;
  internalLinks?: Array<{ url: string; text: string }>;
  externalLinks?: Array<{ url: string; text: string }>;
  wordCount?: number;
  images?: Array<{ src: string; alt: string }>;
}

/**
 * Options for batch scraping.
 */
export interface BatchScrapeOptions extends ScrapeOptions {
  /** Max concurrent requests (default: 10) */
  concurrency?: number;

  /** Progress callback */
  onProgress?: (completed: number, total: number, url: string) => void;
}

/**
 * Result of batch scraping.
 */
export interface BatchScrapeResult {
  results: ScrapeResult[];
  totalCostUsd: number;
  cacheHits: number;
  cacheMisses: number;
  durationMs: number;
  tierDistribution: Record<ScrapeTier, number>;
}

/**
 * Options for site crawling.
 */
export interface CrawlOptions extends BatchScrapeOptions {
  /** Max pages to crawl (default: 10000) */
  maxPages?: number;

  /** Respect robots.txt (default: true) */
  respectRobots?: boolean;
}

/**
 * Aggregated metrics from all components.
 */
export interface ScrapingMetrics {
  /** Cost summary */
  cost: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    byTier: Record<ScrapeTier, number>;
    byFeature: Record<string, number>;
    byClient: Record<string, number>;
  };

  /** Performance metrics */
  performance: {
    requestsTotal: number;
    requestsByTier: Record<ScrapeTier, number>;
    latencyP50Ms: number;
    latencyP95Ms: number;
    latencyP99Ms: number;
    successRate: number;
    errorsByType: Record<string, number>;
  };

  /** Cache efficiency */
  cache: CacheStats;

  /** Domain learning stats */
  domainLearning: {
    totalDomains: number;
    accuracyRate: number;
    tierDistribution: Record<ScrapeTier, number>;
    discoveriesToday: number;
    revalidationsPending: number;
  };

  /** Migration status */
  migration: {
    flagStatus: ScrapingMigrationFlags;
    shadowMismatches: number;
    fallbacksTriggered: number;
  };
}

/**
 * Cost report for a time period.
 */
export interface CostReport {
  period: "day" | "week" | "month";
  startDate: string;
  endDate: string;
  totalCostUsd: number;
  totalRequests: number;
  avgCostPerRequest: number;
  byTier: Record<ScrapeTier, { requests: number; costUsd: number }>;
  byFeature: Record<string, { requests: number; costUsd: number }>;
  byClient: Record<string, { requests: number; costUsd: number }>;
  topDomains: Array<{ domain: string; requests: number; costUsd: number }>;
  savingsVsLegacy: number;
  savingsPercent: number;
}

// =============================================================================
// ScrapingService
// =============================================================================

/**
 * Health check component result.
 */
export interface ComponentHealth {
  healthy: boolean;
  latencyMs: number;
  details?: Record<string, unknown>;
  error?: string;
}

/**
 * Full health check result.
 */
export interface HealthCheckResult {
  healthy: boolean;
  timestamp: string;
  components: {
    redis: ComponentHealth;
    postgres: ComponentHealth;
    queue: ComponentHealth;
    circuits: ComponentHealth;
    cache: ComponentHealth;
  };
  latencyMs: number;
}

/**
 * Unified scraping service that orchestrates all scraping components.
 */
export class ScrapingService {
  private tieredFetcher: TieredFetcher;
  private domainLearning: DomainLearningService;
  private cacheManager: CacheManager | null = null;
  private queueManager: QueueManager | null = null;
  private cwvService: CwvService | null = null;
  private alertManager: AlertManager | null = null;
  private redis: Redis | null = null;
  private db: PostgresJsDatabase | null = null;

  // Metrics tracking
  private shadowMismatches = 0;
  private fallbacksTriggered = 0;
  private requestsByFeature: Map<string, number> = new Map();
  private costByFeature: Map<string, number> = new Map();

  constructor() {
    this.tieredFetcher = new TieredFetcher();
    this.domainLearning = new DomainLearningService();
    this.alertManager = new AlertManager();

    // Wire alert manager to tiered fetcher
    this.tieredFetcher.setAlertManager(this.alertManager);
  }

  /**
   * Initialize the service with dependencies.
   * Call this once during application startup.
   */
  initialize(deps: {
    redis: Redis;
    db: PostgresJsDatabase;
    cwvService?: CwvService;
  }): void {
    // Store references for health checks
    this.redis = deps.redis;
    this.db = deps.db;

    // Create cache manager
    this.cacheManager = createCacheManager({
      redis: deps.redis,
      db: deps.db,
    });

    // Connect cache to fetcher
    this.tieredFetcher.setCacheManager(this.cacheManager);

    // Get queue manager singleton
    this.queueManager = getQueueManager();

    // Set CWV service if provided
    if (deps.cwvService) {
      this.cwvService = deps.cwvService;
    }
  }

  /**
   * Check if the service is initialized.
   */
  isInitialized(): boolean {
    return this.cacheManager !== null;
  }

  // ===========================================================================
  // Core Scraping Methods
  // ===========================================================================

  /**
   * Scrape a single URL using the optimal strategy.
   */
  async scrape(url: string, options: ScrapeOptions = {}): Promise<ScrapeResult> {
    const correlationId = options.correlationId ?? generateCorrelationId();
    const startTime = Date.now();

    return withRequestContextAsync(
      { correlationId, url, clientId: options.clientId },
      async () => {
        this.trackRequest(options.feature);

        const fetchOptions: FetchOptions = {
          ...options,
        };

        try {
          // Parallel fetch: HTML + CWV
          const [result, cwvMetrics] = await Promise.all([
            this.tieredFetcher.fetch(url, fetchOptions),
            options.includeCwv && this.cwvService
              ? this.cwvService.getCwvData(url).catch((error) => {
                  logger.warn({ url, error: error instanceof Error ? error.message : String(error) }, 'CWV fetch failed');
                  return undefined;
                })
              : Promise.resolve(undefined),
          ]);

          const durationMs = Date.now() - startTime;

          // Track cost
          this.trackCost(options.feature, result.estimatedCostUsd);

          // Record metrics for Prometheus
          recordScrapeRequest({
            tier: result.tierUsed,
            status: result.success ? 'success' : 'error',
            durationSeconds: durationMs / 1000,
            costUsd: result.estimatedCostUsd,
            cached: result.fromCache,
            cacheLevel: result.cacheLevel,
            clientId: options.clientId,
          });

          // Log completion
          logScrapeComplete({
            url,
            tier: result.tierUsed,
            cached: result.fromCache,
            durationMs,
            costUsd: result.estimatedCostUsd,
            statusCode: result.statusCode,
          });

          // Add parsed data if requested
          let parsedData: ParsedPageData | undefined;
          if (options.includeParsedData && result.html) {
            parsedData = this.parseHtml(result.html, url);
          }

          // Optionally strip HTML
          const scrapeResult: ScrapeResult = {
            ...result,
            html: options.includeHtml === false ? undefined : result.html,
            parsedData,
            cwv: cwvMetrics,
            correlationId,
          };

          return scrapeResult;
        } catch (error) {
          const durationMs = Date.now() - startTime;

          // Record error metrics
          recordScrapeRequest({
            tier: options.forceTier ?? options.startTier ?? 'direct',
            status: 'error',
            durationSeconds: durationMs / 1000,
            costUsd: 0,
            cached: false,
            clientId: options.clientId,
          });

          // Log error
          logScrapeError({
            url,
            tier: options.forceTier ?? options.startTier ?? 'direct',
            error: error instanceof Error ? error.message : String(error),
            durationMs,
          });

          throw error;
        }
      }
    );
  }

  /**
   * Scrape multiple URLs in batch with concurrency control.
   */
  async scrapeBatch(
    urls: string[],
    options: BatchScrapeOptions = {}
  ): Promise<BatchScrapeResult> {
    const startTime = Date.now();
    const concurrency = options.concurrency ?? 10;
    const results: ScrapeResult[] = [];
    let cacheHits = 0;
    let cacheMisses = 0;
    let totalCostUsd = 0;
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
    const queue = [...urls];
    let completed = 0;

    while (queue.length > 0) {
      const batch = queue.splice(0, concurrency);
      const batchResults = await Promise.all(
        batch.map((url) =>
          this.scrape(url, options).catch((error) => ({
            url,
            success: false,
            statusCode: 0,
            tierUsed: "direct" as ScrapeTier,
            fromCache: false,
            responseTimeMs: 0,
            responseSizeBytes: 0,
            estimatedCostUsd: 0,
            error: error instanceof Error ? error.message : String(error),
          }))
        )
      );

      for (const result of batchResults) {
        results.push(result);
        completed++;

        if (result.fromCache) {
          cacheHits++;
        } else {
          cacheMisses++;
        }

        totalCostUsd += result.estimatedCostUsd;
        tierDistribution[result.tierUsed]++;

        options.onProgress?.(completed, urls.length, result.url);
      }
    }

    return {
      results,
      totalCostUsd,
      cacheHits,
      cacheMisses,
      durationMs: Date.now() - startTime,
      tierDistribution,
    };
  }

  /**
   * Crawl a site starting from a list of URLs.
   */
  async crawlSite(
    urls: string[],
    options: CrawlOptions = {}
  ): Promise<BatchScrapeResult> {
    const maxPages = options.maxPages ?? 10000;
    const limitedUrls = urls.slice(0, maxPages);

    return this.scrapeBatch(limitedUrls, options);
  }

  // ===========================================================================
  // Cache Methods
  // ===========================================================================

  /**
   * Warm the cache with URLs (pre-fetch without immediate need).
   */
  async warmCache(urls: string[]): Promise<{
    warmed: number;
    alreadyCached: number;
    failed: number;
  }> {
    let warmed = 0;
    let alreadyCached = 0;
    let failed = 0;

    // Check which URLs are already cached
    const uncachedUrls: string[] = [];
    for (const url of urls) {
      if (this.cacheManager) {
        const cached = await this.cacheManager.get(url);
        if (cached.hit) {
          alreadyCached++;
        } else {
          uncachedUrls.push(url);
        }
      } else {
        uncachedUrls.push(url);
      }
    }

    // Fetch uncached URLs with background priority
    if (uncachedUrls.length > 0) {
      const results = await this.scrapeBatch(uncachedUrls, {
        concurrency: 5, // Lower concurrency for cache warming
      });

      for (const result of results.results) {
        if (result.success) {
          warmed++;
        } else {
          failed++;
        }
      }
    }

    return { warmed, alreadyCached, failed };
  }

  /**
   * Invalidate cache for a URL or pattern.
   */
  async invalidateCache(urlOrPattern: string): Promise<number> {
    if (this.cacheManager) {
      await this.cacheManager.invalidate(urlOrPattern);
      return 1;
    }
    return 0;
  }

  /**
   * Invalidate cache for an entire domain.
   */
  async invalidateDomain(domain: string): Promise<void> {
    if (this.cacheManager) {
      await this.cacheManager.invalidateDomain(domain);
    }
  }

  // ===========================================================================
  // Metrics Methods
  // ===========================================================================

  /**
   * Get comprehensive metrics from all components.
   */
  async getMetrics(): Promise<ScrapingMetrics> {
    const flags = loadMigrationFlagsCached();
    const cacheStats = this.cacheManager?.getStats() ?? this.emptyCacheStats();
    const metricsCollector = getMetricsCollector();

    // Get domain learning stats
    const revalidationCandidates = await this.domainLearning.getRevalidationCandidates(1);

    // Calculate latency percentiles from histogram
    const latencyP50Ms = metricsCollector.getPercentile('scraping_request_duration_seconds', 50) * 1000;
    const latencyP95Ms = metricsCollector.getPercentile('scraping_request_duration_seconds', 95) * 1000;
    const latencyP99Ms = metricsCollector.getPercentile('scraping_request_duration_seconds', 99) * 1000;

    // Get request counts by tier from MetricsCollector
    const tiers: ScrapeTier[] = ['direct', 'webshare', 'geonode', 'camoufox', 'dfs_basic', 'dfs_js', 'dfs_browser'];
    const requestsByTier: Record<ScrapeTier, number> = {
      direct: 0,
      webshare: 0,
      geonode: 0,
      camoufox: 0,
      dfs_basic: 0,
      dfs_js: 0,
      dfs_browser: 0,
    };
    const costByTier: Record<ScrapeTier, number> = {
      direct: 0,
      webshare: 0,
      geonode: 0,
      camoufox: 0,
      dfs_basic: 0,
      dfs_js: 0,
      dfs_browser: 0,
    };

    let totalRequests = 0;
    let successfulRequests = 0;

    for (const tier of tiers) {
      const successCount = metricsCollector.getCounter('scraping_requests_total', { tier, status: 'success' });
      const errorCount = metricsCollector.getCounter('scraping_requests_total', { tier, status: 'error' });
      requestsByTier[tier] = successCount + errorCount;
      totalRequests += successCount + errorCount;
      successfulRequests += successCount;

      costByTier[tier] = metricsCollector.getCounter('scraping_cost_usd_total', { tier });
    }

    const successRate = totalRequests > 0 ? successfulRequests / totalRequests : 1;
    const totalCost = Object.values(costByTier).reduce((sum, cost) => sum + cost, 0);

    return {
      cost: {
        today: totalCost,
        thisWeek: 0, // Would need to aggregate from history
        thisMonth: 0,
        byTier: costByTier,
        byFeature: Object.fromEntries(this.costByFeature),
        byClient: {},
      },
      performance: {
        requestsTotal: totalRequests || cacheStats.totalRequests,
        requestsByTier,
        latencyP50Ms,
        latencyP95Ms,
        latencyP99Ms,
        successRate,
        errorsByType: {},
      },
      cache: cacheStats,
      domainLearning: {
        totalDomains: 0, // Would query from DB
        accuracyRate: 0.95, // Target accuracy
        tierDistribution: requestsByTier,
        discoveriesToday: 0,
        revalidationsPending: revalidationCandidates.length > 0 ? 1 : 0,
      },
      migration: {
        flagStatus: flags,
        shadowMismatches: this.shadowMismatches,
        fallbacksTriggered: this.fallbacksTriggered,
      },
    };
  }

  /**
   * Get cost report for a time period or date range.
   */
  async getCostReport(periodOrOptions: "day" | "week" | "month" | { start?: Date; end?: Date }): Promise<CostReport> {
    // Handle overloaded signature
    if (typeof periodOrOptions === 'object') {
      // For now, default to 'day' when called with date range
      const period = 'day';
      periodOrOptions = period;
    }
    const period = periodOrOptions as "day" | "week" | "month";
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "day":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
    }

    // This would query from domain_scrape_history table
    // For now, return placeholder
    return {
      period,
      startDate: startDate.toISOString().split("T")[0],
      endDate: now.toISOString().split("T")[0],
      totalCostUsd: 0,
      totalRequests: 0,
      avgCostPerRequest: 0,
      byTier: {
        direct: { requests: 0, costUsd: 0 },
        webshare: { requests: 0, costUsd: 0 },
        geonode: { requests: 0, costUsd: 0 },
        camoufox: { requests: 0, costUsd: 0 },
        dfs_basic: { requests: 0, costUsd: 0 },
        dfs_js: { requests: 0, costUsd: 0 },
        dfs_browser: { requests: 0, costUsd: 0 },
      },
      byFeature: {},
      byClient: {},
      topDomains: [],
      savingsVsLegacy: 0,
      savingsPercent: 0,
    };
  }

  /**
   * Get current migration flag status.
   */
  getMigrationStatus(): ScrapingMigrationFlags {
    return loadMigrationFlagsCached();
  }

  // ===========================================================================
  // Queue Methods
  // ===========================================================================

  /**
   * Enqueue a URL for background scraping.
   */
  async enqueue(url: string, options: ScrapeOptions = {}): Promise<EnqueueResult | null> {
    if (!this.queueManager) {
      return null;
    }

    return this.queueManager.enqueue({
      url,
      source: "scheduler",
      clientId: options.clientId ?? "system",
      options: {
        forceTier: options.forceTier,
        skipCache: options.skipCache,
        timeoutMs: options.timeoutMs,
      },
    });
  }

  /**
   * Enqueue multiple URLs for background scraping.
   */
  async enqueueBatch(
    urls: string[],
    options: ScrapeOptions = {}
  ): Promise<EnqueueResult[]> {
    if (!this.queueManager) {
      return [];
    }

    return this.queueManager.enqueueBatch(urls, {
      source: "scheduler",
      clientId: options.clientId ?? "system",
      options: {
        forceTier: options.forceTier,
        skipCache: options.skipCache,
        timeoutMs: options.timeoutMs,
      },
    });
  }

  // ===========================================================================
  // Domain Learning Methods
  // ===========================================================================

  /**
   * Pre-discover optimal tier for a domain.
   */
  async discoverDomain(domain: string): Promise<{
    domain: string;
    optimalTier: ScrapeTier;
    technologies: string[];
  }> {
    return this.tieredFetcher.discoverDomain(domain);
  }

  /**
   * Get domain statistics.
   */
  async getDomainStats(domain: string) {
    return this.tieredFetcher.getDomainStats(domain);
  }

  /**
   * Estimate cost for fetching a URL.
   */
  async estimateCost(url: string) {
    return this.tieredFetcher.estimateCost(url);
  }

  // ===========================================================================
  // Migration Tracking Methods
  // ===========================================================================

  /**
   * Record a shadow mode mismatch.
   */
  recordShadowMismatch(): void {
    this.shadowMismatches++;
  }

  /**
   * Record a fallback to legacy implementation.
   */
  recordFallback(): void {
    this.fallbacksTriggered++;
  }

  /**
   * Reset migration tracking counters.
   */
  resetMigrationCounters(): void {
    this.shadowMismatches = 0;
    this.fallbacksTriggered = 0;
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private trackRequest(feature?: ScrapingFeature): void {
    const key = feature ?? "unknown";
    this.requestsByFeature.set(key, (this.requestsByFeature.get(key) ?? 0) + 1);
  }

  private trackCost(feature: ScrapingFeature | undefined, costUsd: number): void {
    const key = feature ?? "unknown";
    this.costByFeature.set(key, (this.costByFeature.get(key) ?? 0) + costUsd);
  }

  private parseHtml(html: string, _url: string): ParsedPageData {
    // Simple regex-based parsing for common elements
    // In production, this would use cheerio for robust parsing
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const metaDescMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i
    );
    const h1Matches = html.matchAll(/<h1[^>]*>([^<]+)<\/h1>/gi);
    const h2Matches = html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/gi);
    const canonicalMatch = html.match(
      /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i
    );

    // Extract text for word count
    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const wordCount = textContent.split(/\s+/).filter((w) => w.length > 0).length;

    return {
      title: titleMatch?.[1]?.trim(),
      metaDescription: metaDescMatch?.[1]?.trim(),
      h1: Array.from(h1Matches).map((m) => m[1].trim()),
      h2: Array.from(h2Matches).map((m) => m[1].trim()),
      canonical: canonicalMatch?.[1],
      wordCount,
    };
  }

  private emptyCacheStats(): CacheStats {
    const emptyLevelStats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      avgLatencyMs: 0,
      sizeBytes: 0,
      itemCount: 0,
    };

    return {
      l1: emptyLevelStats,
      l2: emptyLevelStats,
      l3: emptyLevelStats,
      l4: emptyLevelStats,
      totalHitRate: 0,
      avgLatencyMs: 0,
      totalRequests: 0,
      lastResetAt: new Date(),
    };
  }

  // ===========================================================================
  // Health & Monitoring Methods (for health.ts routes)
  // ===========================================================================

  /**
   * Comprehensive health check with real component pings.
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const results: HealthCheckResult = {
      healthy: true,
      timestamp: new Date().toISOString(),
      components: {
        redis: { healthy: false, latencyMs: 0 },
        postgres: { healthy: false, latencyMs: 0 },
        queue: { healthy: false, latencyMs: 0 },
        circuits: { healthy: false, latencyMs: 0 },
        cache: { healthy: false, latencyMs: 0 },
      },
      latencyMs: 0,
    };

    // Check Redis
    const redisStart = Date.now();
    try {
      if (this.redis) {
        await this.redis.ping();
        const info = await this.redis.info('memory');
        const usedMemory = info.match(/used_memory:(\d+)/)?.[1];
        results.components.redis = {
          healthy: true,
          latencyMs: Date.now() - redisStart,
          details: {
            connected: this.redis.status === 'ready',
            usedMemoryBytes: usedMemory ? parseInt(usedMemory, 10) : undefined,
          },
        };
      } else {
        results.components.redis = {
          healthy: false,
          latencyMs: Date.now() - redisStart,
          error: 'Redis not initialized',
        };
        results.healthy = false;
      }
    } catch (error) {
      results.components.redis = {
        healthy: false,
        latencyMs: Date.now() - redisStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      results.healthy = false;
    }

    // Check PostgreSQL
    const pgStart = Date.now();
    try {
      if (this.db) {
        // Execute a simple query to verify connection
        await (this.db as any).execute('SELECT 1');
        results.components.postgres = {
          healthy: true,
          latencyMs: Date.now() - pgStart,
          details: {
            connected: true,
          },
        };
      } else {
        results.components.postgres = {
          healthy: false,
          latencyMs: Date.now() - pgStart,
          error: 'Database not initialized',
        };
        results.healthy = false;
      }
    } catch (error) {
      results.components.postgres = {
        healthy: false,
        latencyMs: Date.now() - pgStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      results.healthy = false;
    }

    // Check BullMQ Queue
    const queueStart = Date.now();
    try {
      if (this.queueManager) {
        const metrics = await this.queueManager.getQueueMetrics();
        const totalWaiting = Object.values(metrics.queues).reduce(
          (sum, q) => sum + q.waiting,
          0
        );
        const totalFailed = Object.values(metrics.queues).reduce(
          (sum, q) => sum + q.failed,
          0
        );

        // Unhealthy if too many failed or waiting
        const queueHealthy = totalFailed < 100 && totalWaiting < 1000;

        results.components.queue = {
          healthy: queueHealthy,
          latencyMs: Date.now() - queueStart,
          details: {
            waiting: totalWaiting,
            active: Object.values(metrics.queues).reduce((sum, q) => sum + q.active, 0),
            completed: Object.values(metrics.queues).reduce((sum, q) => sum + q.completed, 0),
            failed: totalFailed,
            globalConcurrency: metrics.global.currentConcurrency,
          },
        };

        if (!queueHealthy) {
          results.healthy = false;
        }
      } else {
        results.components.queue = {
          healthy: true, // Queue is optional
          latencyMs: Date.now() - queueStart,
          details: { initialized: false },
        };
      }
    } catch (error) {
      results.components.queue = {
        healthy: false,
        latencyMs: Date.now() - queueStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      results.healthy = false;
    }

    // Check Circuit Breakers
    const circuitStart = Date.now();
    try {
      const states = this.tieredFetcher.getCircuitStates();
      const openCircuits = Object.entries(states)
        .filter(([_, state]) => state === 'open')
        .map(([tier]) => tier);

      results.components.circuits = {
        healthy: openCircuits.length < 4, // Allow some circuits to be open
        latencyMs: Date.now() - circuitStart,
        details: {
          states,
          openCircuits,
          openCount: openCircuits.length,
        },
      };
      // Circuits being open is warning, not hard failure
    } catch (error) {
      results.components.circuits = {
        healthy: false,
        latencyMs: Date.now() - circuitStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check Cache Layers
    const cacheStart = Date.now();
    try {
      if (this.cacheManager) {
        const cacheStats = this.cacheManager.getStats();
        results.components.cache = {
          healthy: true,
          latencyMs: Date.now() - cacheStart,
          details: {
            l1: {
              hitRate: cacheStats.l1.hitRate,
              sizeBytes: cacheStats.l1.sizeBytes,
              itemCount: cacheStats.l1.itemCount,
            },
            l2: {
              hitRate: cacheStats.l2.hitRate,
              avgLatencyMs: cacheStats.l2.avgLatencyMs,
            },
            l3: {
              hitRate: cacheStats.l3.hitRate,
            },
            l4: {
              hitRate: cacheStats.l4.hitRate,
            },
            totalHitRate: cacheStats.totalHitRate,
            totalRequests: cacheStats.totalRequests,
          },
        };
      } else {
        results.components.cache = {
          healthy: true, // Cache is optional
          latencyMs: Date.now() - cacheStart,
          details: { initialized: false },
        };
      }
    } catch (error) {
      results.components.cache = {
        healthy: false,
        latencyMs: Date.now() - cacheStart,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    results.latencyMs = Date.now() - startTime;
    return results;
  }

  /**
   * Get circuit breaker states for all tiers.
   */
  getCircuitStates(): Record<ScrapeTier, CircuitState> {
    return this.tieredFetcher.getCircuitStates();
  }

  /**
   * Get queue statistics.
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    if (!this.queueManager) {
      return { waiting: 0, active: 0, completed: 0, failed: 0 };
    }

    const metrics = await this.queueManager.getQueueMetrics();
    return {
      waiting: Object.values(metrics.queues).reduce((sum, q) => sum + q.waiting, 0),
      active: Object.values(metrics.queues).reduce((sum, q) => sum + q.active, 0),
      completed: Object.values(metrics.queues).reduce((sum, q) => sum + q.completed, 0),
      failed: Object.values(metrics.queues).reduce((sum, q) => sum + q.failed, 0),
    };
  }

  /**
   * Get Prometheus metrics in text format.
   */
  async getPrometheusMetrics(): Promise<string> {
    const lines: string[] = [];
    const health = await this.healthCheck();
    const metricsCollector = getMetricsCollector();

    // ==========================================================================
    // MetricsCollector metrics (histograms, counters from actual requests)
    // ==========================================================================
    const collectorMetrics = metricsCollector.toPrometheusFormat();
    if (collectorMetrics) {
      lines.push(collectorMetrics);
      lines.push('');
    }

    // ==========================================================================
    // Component health gauges
    // ==========================================================================
    lines.push('# HELP scraping_component_health Component health status (1=healthy, 0=unhealthy)');
    lines.push('# TYPE scraping_component_health gauge');
    for (const [name, component] of Object.entries(health.components)) {
      lines.push(`scraping_component_health{component="${name}"} ${component.healthy ? 1 : 0}`);
    }
    lines.push('');

    // Component latency
    lines.push('# HELP scraping_component_latency_ms Component health check latency in milliseconds');
    lines.push('# TYPE scraping_component_latency_ms gauge');
    for (const [name, component] of Object.entries(health.components)) {
      lines.push(`scraping_component_latency_ms{component="${name}"} ${component.latencyMs}`);
    }
    lines.push('');

    // ==========================================================================
    // Circuit breaker states (also update MetricsCollector gauges)
    // ==========================================================================
    const circuits = this.getCircuitStates();
    lines.push('# HELP scraping_circuit_breaker_state Circuit breaker state (0=closed, 1=half-open, 2=open)');
    lines.push('# TYPE scraping_circuit_breaker_state gauge');
    for (const [tier, state] of Object.entries(circuits)) {
      const stateValue = { closed: 0, 'half-open': 1, open: 2 }[state] ?? 0;
      lines.push(`scraping_circuit_breaker_state{tier="${tier}"} ${stateValue}`);
      // Also record in MetricsCollector for consistency
      recordCircuitState(tier, state);
    }
    lines.push('');

    // ==========================================================================
    // Queue metrics
    // ==========================================================================
    const queueStats = await this.getQueueStats();
    lines.push('# HELP scraping_queue_jobs Queue job counts');
    lines.push('# TYPE scraping_queue_jobs gauge');
    lines.push(`scraping_queue_jobs{state="waiting"} ${queueStats.waiting}`);
    lines.push(`scraping_queue_jobs{state="active"} ${queueStats.active}`);
    lines.push(`scraping_queue_jobs{state="completed"} ${queueStats.completed}`);
    lines.push(`scraping_queue_jobs{state="failed"} ${queueStats.failed}`);
    lines.push('');

    // ==========================================================================
    // Cache metrics
    // ==========================================================================
    if (this.cacheManager) {
      const cacheStats = this.cacheManager.getStats();
      lines.push('# HELP scraping_cache_hit_rate Cache hit rate (0-1)');
      lines.push('# TYPE scraping_cache_hit_rate gauge');
      lines.push(`scraping_cache_hit_rate{level="l1"} ${cacheStats.l1.hitRate}`);
      lines.push(`scraping_cache_hit_rate{level="l2"} ${cacheStats.l2.hitRate}`);
      lines.push(`scraping_cache_hit_rate{level="l3"} ${cacheStats.l3.hitRate}`);
      lines.push(`scraping_cache_hit_rate{level="l4"} ${cacheStats.l4.hitRate}`);
      lines.push(`scraping_cache_hit_rate{level="total"} ${cacheStats.totalHitRate}`);
      lines.push('');

      lines.push('# HELP scraping_cache_size_bytes Cache size in bytes');
      lines.push('# TYPE scraping_cache_size_bytes gauge');
      lines.push(`scraping_cache_size_bytes{level="l1"} ${cacheStats.l1.sizeBytes}`);
      lines.push('');

      lines.push('# HELP scraping_cache_items Cache item count');
      lines.push('# TYPE scraping_cache_items gauge');
      lines.push(`scraping_cache_items{level="l1"} ${cacheStats.l1.itemCount}`);
      lines.push('');

      lines.push('# HELP scraping_cache_requests_total Total cache requests');
      lines.push('# TYPE scraping_cache_requests_total counter');
      lines.push(`scraping_cache_requests_total ${cacheStats.totalRequests}`);
      lines.push('');
    }

    // ==========================================================================
    // Migration metrics
    // ==========================================================================
    lines.push('# HELP scraping_migration_shadow_mismatches Shadow mode comparison mismatches');
    lines.push('# TYPE scraping_migration_shadow_mismatches counter');
    lines.push(`scraping_migration_shadow_mismatches ${this.shadowMismatches}`);
    lines.push('');

    lines.push('# HELP scraping_migration_fallbacks Legacy fallbacks triggered');
    lines.push('# TYPE scraping_migration_fallbacks counter');
    lines.push(`scraping_migration_fallbacks ${this.fallbacksTriggered}`);
    lines.push('');

    // ==========================================================================
    // Latency percentiles (computed from histogram)
    // ==========================================================================
    const p50 = metricsCollector.getPercentile('scraping_request_duration_seconds', 50);
    const p95 = metricsCollector.getPercentile('scraping_request_duration_seconds', 95);
    const p99 = metricsCollector.getPercentile('scraping_request_duration_seconds', 99);

    lines.push('# HELP scraping_latency_percentile_seconds Request latency percentiles');
    lines.push('# TYPE scraping_latency_percentile_seconds gauge');
    lines.push(`scraping_latency_percentile_seconds{quantile="0.5"} ${p50.toFixed(6)}`);
    lines.push(`scraping_latency_percentile_seconds{quantile="0.95"} ${p95.toFixed(6)}`);
    lines.push(`scraping_latency_percentile_seconds{quantile="0.99"} ${p99.toFixed(6)}`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Get metrics content type for Prometheus.
   */
  getMetricsContentType(): string {
    return 'text/plain; version=0.0.4; charset=utf-8';
  }

  /**
   * Force close circuit breaker for a tier.
   */
  forceCloseCircuit(tier: string): void {
    this.tieredFetcher.resetCircuit(tier as ScrapeTier);
  }

  /**
   * Force open circuit breaker for a tier.
   */
  forceOpenCircuit(tier: string): void {
    this.tieredFetcher.forceOpenCircuit(tier as ScrapeTier);
  }

  /**
   * Get the TieredFetcher instance (for health routes).
   */
  getTieredFetcher(): TieredFetcher {
    return this.tieredFetcher;
  }

  /**
   * Get the QueueManager instance (for health routes).
   */
  getQueueManager(): QueueManager | null {
    return this.queueManager;
  }

  /**
   * Drain old jobs from the queue.
   */
  async drainQueue(olderThanMs?: number): Promise<number> {
    logger.info({ olderThanMs }, 'Draining queue');
    // TODO: Implement actual queue drain logic
    return 0;
  }

  /**
   * Get cache stats.
   */
  getCacheStats(): CacheStats {
    return this.cacheManager?.getStats() ?? this.emptyCacheStats();
  }

  /**
   * Emergency stop - pause all queues and open all circuits.
   */
  async emergencyStop(): Promise<void> {
    logger.warn({}, 'Emergency stop triggered');

    // Open all circuit breakers
    const tiers: ScrapeTier[] = ['direct', 'webshare', 'geonode', 'camoufox', 'dfs_basic', 'dfs_js', 'dfs_browser'];
    for (const tier of tiers) {
      this.tieredFetcher.forceOpenCircuit(tier);
    }

    // Pause all queues
    if (this.queueManager) {
      await Promise.all([
        this.queueManager.pauseQueue('scrape:priority'),
        this.queueManager.pauseQueue('scrape:standard'),
        this.queueManager.pauseQueue('scrape:background'),
      ]);
    }
  }

  /**
   * Resume operations - close circuits and resume queues.
   */
  async resume(): Promise<void> {
    logger.info({}, 'Resuming operations');

    // Reset all circuit breakers
    const tiers: ScrapeTier[] = ['direct', 'webshare', 'geonode', 'camoufox', 'dfs_basic', 'dfs_js', 'dfs_browser'];
    for (const tier of tiers) {
      this.tieredFetcher.resetCircuit(tier);
    }

    // Resume all queues
    if (this.queueManager) {
      await Promise.all([
        this.queueManager.resumeQueue('scrape:priority'),
        this.queueManager.resumeQueue('scrape:standard'),
        this.queueManager.resumeQueue('scrape:background'),
      ]);
    }
  }
}

// =============================================================================
// Singleton Export
// =============================================================================

export const scrapingService = new ScrapingService();

/**
 * Create a new ScrapingService instance (for testing or isolated use).
 */
export function createScrapingService(): ScrapingService {
  return new ScrapingService();
}
