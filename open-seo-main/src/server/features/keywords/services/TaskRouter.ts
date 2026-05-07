/**
 * TaskRouter - Intelligent Task Routing for Keyword Intelligence
 * Phase 95-10: Consumer Integration Completion
 *
 * Routes 60-70% of tasks to APIs instead of crawling, achieving 10x cost reduction.
 * Based on the insight that only client site audits (5-10%) require actual crawling.
 *
 * CRAWL tasks now route through MigrationRouter for unified scraping infrastructure.
 *
 * @see IMPLEMENTATION-FIXES.md Fix 6: Task Decomposition
 * @see crawling-10-5000-tasks-day.md
 * @see MULTI-TENANT-COST-OPTIMIZATION.md
 */

import {
  DataSource,
  KeywordTask,
  TaskResult,
  TaskType,
  CostAccumulator,
  createCostAccumulator,
  accumulateCost,
  generateCacheKey,
  isValidTask,
} from '../types/tasks';

import {
  ROUTING_TABLE,
  COST_PER_SOURCE,
  CACHE_TTL_PER_SOURCE,
  LITHUANIAN_MARKET,
  DATAFORSEO_PRICING,
  RoutingTable,
  CostTable,
  CacheTTLTable,
} from '../config/routing';

import {
  routeBatchRequest,
  loadMigrationFlagsCached,
  shouldUseUnified,
  type ScrapeResult,
} from '@/server/features/scraping';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Cache interface for the TaskRouter.
 * Implement this to provide Redis or other caching.
 */
export interface TaskCache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

/**
 * DataForSEO client interface.
 * Implement this to provide actual API calls.
 */
export interface DataForSEOClient {
  /** Get keywords for a domain */
  keywordsForDomain(params: {
    domain: string;
    locationCode: number;
    languageCode: string;
    limit?: number;
  }): Promise<KeywordsForDomainResult>;

  /** Get SERP results for keywords */
  serpResults(params: {
    keywords: string[];
    locationCode: number;
    languageCode: string;
    depth?: number;
  }): Promise<SerpResult[]>;

  /** Get backlinks for a domain */
  backlinks(params: {
    domain: string;
    limit?: number;
  }): Promise<BacklinksResult>;
}

/**
 * Crawler interface for client site audits.
 */
export interface Crawler {
  crawl(params: { domain: string; maxPages?: number }): Promise<CrawlResult>;
}

// ============================================================================
// Result Types
// ============================================================================

export interface KeywordsForDomainResult {
  keywords: Array<{
    keyword: string;
    searchVolume: number;
    competition: number;
    cpc: number;
  }>;
  totalCount: number;
}

export interface SerpResult {
  keyword: string;
  position: number;
  url: string;
  title: string;
  snippet: string;
}

export interface BacklinksResult {
  backlinks: Array<{
    sourceUrl: string;
    targetUrl: string;
    anchorText: string;
    domainRank: number;
  }>;
  totalCount: number;
}

/**
 * A single crawled page result.
 */
export interface CrawlPage {
  url: string;
  title: string;
  content: string;
  statusCode: number;
}

export interface CrawlResult {
  pages: CrawlPage[];
  totalPages: number;
}

// ============================================================================
// TaskRouter Configuration
// ============================================================================

export interface TaskRouterConfig {
  routingTable?: RoutingTable;
  costTable?: CostTable;
  cacheTTLTable?: CacheTTLTable;
  defaultLocationCode?: number;
  defaultLanguageCode?: string;
  /** Enable cost tracking */
  trackCosts?: boolean;
  /** Enable metrics collection */
  enableMetrics?: boolean;
}

// ============================================================================
// TaskRouter Implementation
// ============================================================================

/**
 * TaskRouter - Routes keyword intelligence tasks to optimal data sources.
 *
 * Key behaviors:
 * 1. Cache-first: Always check cache before routing
 * 2. Smart routing: Use APIs for 60-70% of tasks (competitor data, SERP, backlinks)
 * 3. Crawl only when necessary: Client site audits (5-10%)
 * 4. Cost tracking: Track costs per source for analytics
 *
 * Example:
 * ```typescript
 * const router = new TaskRouter(cache, dataforseo, crawler);
 *
 * // This routes to DATAFORSEO_LABS (10x cheaper than crawling)
 * const result = await router.execute({
 *   taskId: 'task-1',
 *   keywords: ['šampūnas'],
 *   taskType: 'competitor_gap',
 *   domain: 'competitor.lt',
 *   clientId: 'client-1',
 * });
 * ```
 */
export class TaskRouter {
  private cache: TaskCache;
  private dataforseo: DataForSEOClient;
  private crawler: Crawler;
  private config: Required<TaskRouterConfig>;
  private costAccumulator: CostAccumulator;

  constructor(
    cache: TaskCache,
    dataforseo: DataForSEOClient,
    crawler: Crawler,
    config: TaskRouterConfig = {}
  ) {
    this.cache = cache;
    this.dataforseo = dataforseo;
    this.crawler = crawler;
    this.config = {
      routingTable: config.routingTable ?? ROUTING_TABLE,
      costTable: config.costTable ?? COST_PER_SOURCE,
      cacheTTLTable: config.cacheTTLTable ?? CACHE_TTL_PER_SOURCE,
      defaultLocationCode: config.defaultLocationCode ?? LITHUANIAN_MARKET.locationCode,
      defaultLanguageCode: config.defaultLanguageCode ?? LITHUANIAN_MARKET.languageCode,
      trackCosts: config.trackCosts ?? true,
      enableMetrics: config.enableMetrics ?? true,
    };
    this.costAccumulator = createCostAccumulator();
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Determines the optimal data source for a task.
   * Checks cache first, then applies routing rules.
   */
  async route(task: KeywordTask): Promise<DataSource> {
    // Validate task
    if (!isValidTask(task)) {
      throw new Error('Invalid task: missing required fields');
    }

    // Check cache first (shared across tenants)
    const cacheKey = generateCacheKey(task);
    const cached = await this.cache.exists(cacheKey);
    if (cached) {
      return DataSource.CACHE;
    }

    // Route based on task type
    const defaultSource = this.config.routingTable[task.taskType];

    // Override: Client site ALWAYS requires crawl
    if (task.taskType === 'client_audit') {
      return DataSource.CRAWL;
    }

    return defaultSource ?? DataSource.CRAWL;
  }

  /**
   * Executes a task via the optimal data source.
   * Returns the result with cost tracking.
   */
  async execute<T = unknown>(task: KeywordTask): Promise<TaskResult<T>> {
    const startTime = Date.now();
    const source = await this.route(task);

    let result: TaskResult<T>;

    switch (source) {
      case DataSource.CACHE:
        result = await this.fromCache<T>(task, startTime);
        break;
      case DataSource.CRAWL:
        result = await this.crawlAndExtract<T>(task, startTime);
        break;
      case DataSource.DATAFORSEO_LABS:
        result = await this.dataforSEOLabs<T>(task, startTime);
        break;
      case DataSource.DATAFORSEO_SERP:
        result = await this.dataforSEOSerp<T>(task, startTime);
        break;
      case DataSource.DATAFORSEO_BACKLINKS:
        result = await this.dataforSEOBacklinks<T>(task, startTime);
        break;
      default:
        throw new Error(`Unknown data source: ${source}`);
    }

    // Track costs
    if (this.config.trackCosts) {
      this.costAccumulator = accumulateCost(this.costAccumulator, result);
    }

    return result;
  }

  /**
   * Executes multiple tasks in parallel.
   * Groups tasks by source for efficient batching.
   */
  async executeBatch<T = unknown>(
    tasks: KeywordTask[]
  ): Promise<Map<string, TaskResult<T>>> {
    const results = new Map<string, TaskResult<T>>();

    // Execute all tasks in parallel
    const promises = tasks.map(async (task) => {
      const result = await this.execute<T>(task);
      return { taskId: task.taskId, result };
    });

    const settled = await Promise.allSettled(promises);

    for (const outcome of settled) {
      if (outcome.status === 'fulfilled') {
        results.set(outcome.value.taskId, outcome.value.result);
      }
    }

    return results;
  }

  /**
   * Returns accumulated cost statistics.
   */
  getCostStats(): CostAccumulator {
    return { ...this.costAccumulator };
  }

  /**
   * Resets cost accumulator.
   */
  resetCostStats(): void {
    this.costAccumulator = createCostAccumulator();
  }

  /**
   * Returns routing distribution statistics.
   */
  getRoutingDistribution(): {
    bySource: Record<DataSource, number>;
    crawlPercentage: number;
    apiPercentage: number;
    cacheHitRate: number;
  } {
    const stats = this.costAccumulator;
    const total = stats.totalTasks || 1; // Avoid division by zero

    const crawlCount = stats.taskCount[DataSource.CRAWL];
    const cacheCount = stats.taskCount[DataSource.CACHE];
    const apiCount =
      stats.taskCount[DataSource.DATAFORSEO_LABS] +
      stats.taskCount[DataSource.DATAFORSEO_SERP] +
      stats.taskCount[DataSource.DATAFORSEO_BACKLINKS];

    return {
      bySource: { ...stats.taskCount },
      crawlPercentage: (crawlCount / total) * 100,
      apiPercentage: (apiCount / total) * 100,
      cacheHitRate: (cacheCount / total) * 100,
    };
  }

  // --------------------------------------------------------------------------
  // Private Methods - Data Source Handlers
  // --------------------------------------------------------------------------

  /**
   * Retrieves cached result.
   */
  private async fromCache<T>(
    task: KeywordTask,
    startTime: number
  ): Promise<TaskResult<T>> {
    const cacheKey = generateCacheKey(task);
    const data = await this.cache.get<T>(cacheKey);

    if (data === null) {
      throw new Error(`Cache miss for key: ${cacheKey}`);
    }

    return {
      taskId: task.taskId,
      source: DataSource.CACHE,
      data,
      cost: 0,
      cached: true,
      durationMs: Date.now() - startTime,
      executedAt: new Date(),
    };
  }

  /**
   * Crawls client site and extracts data.
   * Used for client_audit tasks only.
   *
   * Phase 95-10: Routes through MigrationRouter for unified scraping.
   * Benefits from domain learning and multi-level caching.
   */
  private async crawlAndExtract<T>(
    task: KeywordTask,
    startTime: number
  ): Promise<TaskResult<T>> {
    // Check if we should use the unified scraping infrastructure
    const flags = loadMigrationFlagsCached();
    const useUnified = shouldUseUnified(flags.siteAudits);

    let crawlResult: CrawlResult;
    let cost: number;

    if (useUnified) {
      // New path: Route through MigrationRouter batch request
      // This benefits from domain learning and tiered fetching
      const urls = await this.getUrlsToCrawl(task.domain, 500);

      const resultsMap = await routeBatchRequest<CrawlPage>({
        feature: "siteAudits",
        urls,
        legacyBatchFn: async (urlsToFetch) => {
          // Fallback to legacy crawler
          const legacyResult = await this.crawler.crawl({
            domain: task.domain,
            maxPages: urlsToFetch.length,
          });
          const resultMap = new Map<string, CrawlPage>();
          for (const page of legacyResult.pages) {
            resultMap.set(page.url, page);
          }
          return resultMap;
        },
        scrapeOptions: {
          feature: "siteAudits",
          includeHtml: true,
          includeParsedData: true,
          clientId: task.clientId,
        },
        transformer: {
          legacyToNew: (page: CrawlPage): ScrapeResult => ({
            url: page.url,
            success: page.statusCode >= 200 && page.statusCode < 400,
            statusCode: page.statusCode,
            html: page.content,
            tierUsed: "direct",
            fromCache: false,
            responseTimeMs: 0,
            responseSizeBytes: page.content?.length ?? 0,
            estimatedCostUsd: 0,
          }),
          newToLegacy: (result: ScrapeResult): CrawlPage => ({
            url: result.url,
            title: result.parsedData?.title ?? "",
            content: result.html ?? "",
            statusCode: result.statusCode,
          }),
        },
        concurrency: 25, // Match CRAWL_CONCURRENCY from siteAuditWorkflowCrawl
      });

      // Convert Map results to CrawlResult format
      const pages: CrawlPage[] = Array.from(resultsMap.values());
      crawlResult = {
        pages,
        totalPages: pages.length,
      };

      // Cost is tracked by ScrapingService, use estimate for result
      cost = pages.length * 0.0002; // Estimated cost per page with unified scraping
    } else {
      // Legacy path: Direct crawler
      crawlResult = await this.crawler.crawl({
        domain: task.domain,
        maxPages: 500, // Reasonable limit for client audit
      });
      cost = this.config.costTable[DataSource.CRAWL];
    }

    // Cache the result
    const cacheKey = generateCacheKey(task);
    const ttl = this.config.cacheTTLTable[DataSource.CRAWL];
    await this.cache.set(cacheKey, crawlResult, ttl);

    return {
      taskId: task.taskId,
      source: DataSource.CRAWL,
      data: crawlResult as T,
      cost,
      cached: false,
      durationMs: Date.now() - startTime,
      executedAt: new Date(),
    };
  }

  /**
   * Get URLs to crawl for a domain.
   * In production, this would discover URLs via sitemap or homepage crawl.
   */
  private async getUrlsToCrawl(domain: string, maxPages: number): Promise<string[]> {
    // Start with the homepage
    const urls = [`https://${domain}/`];

    // In a full implementation, this would:
    // 1. Fetch and parse robots.txt for sitemap URLs
    // 2. Parse sitemap(s) for page URLs
    // 3. Crawl homepage and extract internal links
    // For now, return just the homepage to be expanded by the crawler

    return urls.slice(0, maxPages);
  }

  /**
   * Fetches competitor keyword data from DataForSEO Labs.
   * 10x cheaper than crawling: $0.01-0.05 vs $0.30-0.75
   */
  private async dataforSEOLabs<T>(
    task: KeywordTask,
    startTime: number
  ): Promise<TaskResult<T>> {
    const result = await this.dataforseo.keywordsForDomain({
      domain: task.domain,
      locationCode: task.locationCode ?? this.config.defaultLocationCode,
      languageCode: task.languageCode ?? this.config.defaultLanguageCode,
      limit: task.keywords.length || 1000,
    });

    // Calculate actual cost based on DataForSEO pricing
    const cost =
      DATAFORSEO_PRICING.labs_base +
      result.keywords.length * DATAFORSEO_PRICING.labs_per_item;

    // Cache the result
    const cacheKey = generateCacheKey(task);
    const ttl = this.config.cacheTTLTable[DataSource.DATAFORSEO_LABS];
    await this.cache.set(cacheKey, result, ttl);

    return {
      taskId: task.taskId,
      source: DataSource.DATAFORSEO_LABS,
      data: result as T,
      cost,
      cached: false,
      durationMs: Date.now() - startTime,
      executedAt: new Date(),
    };
  }

  /**
   * Fetches SERP data from DataForSEO SERP API.
   * 33x cheaper than crawling for SERP analysis.
   */
  private async dataforSEOSerp<T>(
    task: KeywordTask,
    startTime: number
  ): Promise<TaskResult<T>> {
    const result = await this.dataforseo.serpResults({
      keywords: task.keywords,
      locationCode: task.locationCode ?? this.config.defaultLocationCode,
      languageCode: task.languageCode ?? this.config.defaultLanguageCode,
      depth: 10, // First page only to minimize cost
    });

    // Calculate cost: $0.0006 per SERP
    const cost = task.keywords.length * DATAFORSEO_PRICING.serp_per_result;

    // Cache the result
    const cacheKey = generateCacheKey(task);
    const ttl = this.config.cacheTTLTable[DataSource.DATAFORSEO_SERP];
    await this.cache.set(cacheKey, result, ttl);

    return {
      taskId: task.taskId,
      source: DataSource.DATAFORSEO_SERP,
      data: result as T,
      cost,
      cached: false,
      durationMs: Date.now() - startTime,
      executedAt: new Date(),
    };
  }

  /**
   * Fetches backlink data from DataForSEO Backlinks API.
   */
  private async dataforSEOBacklinks<T>(
    task: KeywordTask,
    startTime: number
  ): Promise<TaskResult<T>> {
    const result = await this.dataforseo.backlinks({
      domain: task.domain,
      limit: 1000, // Reasonable default
    });

    // Calculate cost: base + per-row
    const cost =
      DATAFORSEO_PRICING.backlinks_base +
      result.backlinks.length * DATAFORSEO_PRICING.backlinks_per_row;

    // Cache the result
    const cacheKey = generateCacheKey(task);
    const ttl = this.config.cacheTTLTable[DataSource.DATAFORSEO_BACKLINKS];
    await this.cache.set(cacheKey, result, ttl);

    return {
      taskId: task.taskId,
      source: DataSource.DATAFORSEO_BACKLINKS,
      data: result as T,
      cost,
      cached: false,
      durationMs: Date.now() - startTime,
      executedAt: new Date(),
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Creates a TaskRouter with default configuration.
 */
export function createTaskRouter(
  cache: TaskCache,
  dataforseo: DataForSEOClient,
  crawler: Crawler,
  config?: TaskRouterConfig
): TaskRouter {
  return new TaskRouter(cache, dataforseo, crawler, config);
}
