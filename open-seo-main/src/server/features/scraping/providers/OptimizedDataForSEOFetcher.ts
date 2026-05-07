/**
 * Optimized DataForSEO Fetcher
 * Phase 95: Unified Scraping Infrastructure - DataForSEO Optimization
 *
 * Enhanced DataForSEO fetcher with:
 * - Standard Queue support (70% cheaper for non-urgent requests)
 * - Pre-parsed data extraction (60% of checks without HTML parsing)
 * - Batch request optimization
 * - Cost tracking integration
 * - Circuit breaker protection
 * - Intelligent tier selection
 *
 * Wraps the existing DataForSEOFetcher with optimization layer.
 */

import { z } from "zod";
import type { FetchResult } from "../fetchers/types";
import { TIER_TO_NUMBER } from "../fetchers/types";
import type {
  DfsFetchOptions,
  DfsFetchResult,
  DfsMode,
  DfsUrgency,
  DataForSEOParsedData,
  DfsTierContext,
  DfsTierSelection,
  DfsUsageStats,
  DfsBudgetStatus,
} from "./DataForSEOFetcher.types";
import { DFS_STANDARD_COSTS, DFS_LIVE_COSTS } from "@/db/dfs-cost-tracking-schema";
import { DataForSEOBatcher, getDataForSEOBatcher } from "./DataForSEOBatcher";
import { mapDfsResultToParsedData, canUsePreparsedOnly } from "./DfsDataMapper";
import {
  classifyDfsError,
  escalateTier,
  withRetry,
  getDfsCircuitBreaker,
  buildDfsError,
  isRetryableError,
  shouldEscalateTier,
} from "./DfsErrorHandler";
import { dataForSeoRateLimiter } from "@/server/lib/dataforseo";

// =============================================================================
// Constants
// =============================================================================

const API_BASE = "https://api.dataforseo.com";

// =============================================================================
// Zod Schemas for API Response Validation
// =============================================================================

const taskResultSchema = z.object({
  status_code: z.number(),
  status_message: z.string().optional(),
  cost: z.number().optional(),
  result_count: z.number().optional(),
  result: z.array(z.unknown()).optional(),
});

const apiResponseSchema = z.object({
  version: z.string().optional(),
  status_code: z.number(),
  status_message: z.string().optional(),
  tasks: z.array(taskResultSchema).optional(),
});

// =============================================================================
// SSRF Protection
// =============================================================================

/**
 * Validate URL is safe to scrape (no internal/private addresses).
 */
function validateScrapableUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL format: ${url}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Invalid URL scheme: ${parsed.protocol}`);
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  ) {
    throw new Error("Cannot scrape localhost addresses");
  }

  const ipv4Match = hostname.match(
    /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  );
  if (ipv4Match) {
    const octets = ipv4Match.slice(1).map(Number);
    const [a, b] = octets;

    if (a === 10) throw new Error("Cannot scrape private IPs (10.x.x.x)");
    if (a === 172 && b >= 16 && b <= 31)
      throw new Error("Cannot scrape private IPs (172.16-31.x.x)");
    if (a === 192 && b === 168)
      throw new Error("Cannot scrape private IPs (192.168.x.x)");
    if (a === 127) throw new Error("Cannot scrape loopback (127.x.x.x)");
    if (a === 169 && b === 254)
      throw new Error("Cannot scrape link-local/metadata (169.254.x.x)");
  }
}

// =============================================================================
// OptimizedDataForSEOFetcher Class
// =============================================================================

/**
 * Optimized DataForSEO fetcher with cost optimization features.
 *
 * Usage:
 * ```typescript
 * const fetcher = new OptimizedDataForSEOFetcher();
 *
 * // Immediate fetch (Live API)
 * const result = await fetcher.fetchLive('https://example.com');
 *
 * // Background fetch (Standard Queue, 70% cheaper)
 * const result = await fetcher.queueForBatch('https://example.com');
 *
 * // Auto-select based on urgency
 * const result = await fetcher.fetch('https://example.com', { urgency: 'bulk' });
 * ```
 */
export class OptimizedDataForSEOFetcher {
  private readonly apiKey: string;
  private readonly batcher: DataForSEOBatcher;
  private readonly circuitBreaker = getDfsCircuitBreaker();
  private readonly defaultTimeout: number;
  private readonly costRecords: CostRecord[] = [];

  constructor(options: {
    apiKey?: string;
    timeoutMs?: number;
    batchSize?: number;
    flushTimeoutMs?: number;
    webhookBaseUrl?: string;
  } = {}) {
    this.apiKey = options.apiKey ?? process.env.DATAFORSEO_API_KEY ?? "";
    this.defaultTimeout = options.timeoutMs ?? 60000;

    if (!this.apiKey) {
      throw new Error(
        "DATAFORSEO_API_KEY not configured. Set in environment or pass to constructor."
      );
    }

    this.batcher = getDataForSEOBatcher({
      batchSize: options.batchSize,
      flushTimeoutMs: options.flushTimeoutMs,
      webhookBaseUrl: options.webhookBaseUrl,
    });
  }

  /**
   * Fetch a URL with automatic queue/tier selection based on context.
   *
   * @param url - URL to fetch
   * @param options - Fetch options including urgency
   * @returns Fetch result with pre-parsed data
   */
  async fetch(url: string, options: DfsFetchOptions = {}): Promise<DfsFetchResult> {
    const urgency = options.urgency ?? "immediate";

    // Select optimal queue based on urgency
    if (urgency === "bulk" && !options.useStandardQueue) {
      options.useStandardQueue = true;
    }

    if (options.useStandardQueue) {
      return this.queueForBatch(url, options);
    }

    return this.fetchLive(url, options);
  }

  /**
   * Fetch a URL immediately using Live API.
   * More expensive but returns results in seconds.
   *
   * @param url - URL to fetch
   * @param options - Fetch options
   * @returns Fetch result with pre-parsed data
   */
  async fetchLive(url: string, options: DfsFetchOptions = {}): Promise<DfsFetchResult> {
    const startTime = Date.now();
    const mode = options.mode ?? "basic";

    // Validate URL
    try {
      validateScrapableUrl(url);
    } catch (error) {
      return this.createFailureResult(url, mode, error, startTime);
    }

    // Execute through circuit breaker
    return this.circuitBreaker.execute(async () => {
      // Acquire rate limit token
      await dataForSeoRateLimiter.acquire();

      // Try with retries
      return withRetry(
        () => this.executeliveFetch(url, mode, options, startTime),
        undefined,
        (attempt, error, delay) => {
          console.warn(
            `[DataForSEO] Retry ${attempt} for ${url}: ${error.message}. Waiting ${delay}ms`
          );
        }
      );
    });
  }

  /**
   * Queue a URL for batch processing via Standard Queue.
   * 70% cheaper but results delivered in 1-15 minutes.
   *
   * @param url - URL to fetch
   * @param options - Fetch options
   * @returns Promise resolving when batch completes
   */
  async queueForBatch(
    url: string,
    options: DfsFetchOptions = {}
  ): Promise<DfsFetchResult> {
    // Validate URL
    try {
      validateScrapableUrl(url);
    } catch (error) {
      const mode = options.mode ?? "basic";
      return this.createFailureResult(url, mode, error, Date.now());
    }

    // Queue for batch processing
    return this.batcher.queueUrl(url, {
      ...options,
      includeRawHtml: options.includeRawHtml ?? true,
    });
  }

  /**
   * Fetch multiple URLs in a batch.
   * Automatically uses Standard Queue for optimal cost.
   *
   * @param urls - URLs to fetch
   * @param options - Shared fetch options
   * @returns Array of fetch results
   */
  async fetchBatch(
    urls: string[],
    options: DfsFetchOptions = {}
  ): Promise<DfsFetchResult[]> {
    // Validate all URLs first
    const validUrls: string[] = [];
    const invalidResults: Map<string, DfsFetchResult> = new Map();

    for (const url of urls) {
      try {
        validateScrapableUrl(url);
        validUrls.push(url);
      } catch (error) {
        invalidResults.set(
          url,
          this.createFailureResult(url, options.mode ?? "basic", error, Date.now())
        );
      }
    }

    // Queue valid URLs
    const promises = validUrls.map((url) =>
      this.queueForBatch(url, options).then((result) => [url, result] as const)
    );

    const results = await Promise.all(promises);

    // Merge results maintaining original order
    return urls.map((url) => {
      const invalidResult = invalidResults.get(url);
      if (invalidResult) return invalidResult;

      const validResult = results.find(([u]) => u === url);
      return validResult?.[1] ?? this.createFailureResult(
        url,
        options.mode ?? "basic",
        new Error("URL not in results"),
        Date.now()
      );
    });
  }

  /**
   * Select the optimal tier based on context.
   *
   * @param context - Tier selection context
   * @returns Tier selection with estimated cost
   */
  selectTier(context: DfsTierContext): DfsTierSelection {
    const { urgency, batchSize, requiresJs, hasAntiBot, previousTier } = context;

    // Start with mode based on requirements
    let mode: DfsMode = "basic";
    if (hasAntiBot) {
      mode = "browser";
    } else if (requiresJs) {
      mode = "js";
    } else if (previousTier) {
      // Escalate from previous tier
      const escalated = escalateTier(previousTier);
      mode = escalated.mode;
    }

    // Determine queue type
    const useStandardQueue = urgency !== "immediate" || batchSize >= 10;

    // Calculate cost
    const estimatedCost = useStandardQueue
      ? DFS_STANDARD_COSTS[mode]
      : DFS_LIVE_COSTS[mode];

    return {
      endpoint: useStandardQueue ? "/v3/on_page/task_post" : "/v3/on_page/instant_pages",
      mode,
      useStandardQueue,
      enableJavascript: mode !== "basic",
      browserScreen: mode === "browser",
      estimatedCost,
      deliveryTime: useStandardQueue ? "1-15 minutes" : "1-30 seconds",
    };
  }

  /**
   * Get estimated cost for a request configuration.
   *
   * @param options - Fetch options
   * @returns Estimated cost in USD
   */
  estimateCost(options: DfsFetchOptions): number {
    const mode = options.mode ?? "basic";
    const useStandardQueue = options.useStandardQueue ?? false;

    let baseCost = useStandardQueue ? DFS_STANDARD_COSTS[mode] : DFS_LIVE_COSTS[mode];

    // Add resource loading cost (3x multiplier)
    if (options.loadResources) {
      baseCost *= 3;
    }

    return baseCost;
  }

  /**
   * Get current usage statistics.
   */
  async getUsageStats(): Promise<DfsUsageStats> {
    // This would normally query the database
    // For now, return from in-memory records
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayRecords = this.costRecords.filter((r) => r.timestamp >= todayStart);
    const monthRecords = this.costRecords.filter((r) => r.timestamp >= monthStart);

    const tierDistribution = {
      basic: { cost: 0, count: 0 },
      js: { cost: 0, count: 0 },
      browser: { cost: 0, count: 0 },
    };

    const queueDistribution = {
      standard: { cost: 0, count: 0 },
      live: { cost: 0, count: 0 },
    };

    for (const record of monthRecords) {
      tierDistribution[record.mode].cost += record.cost;
      tierDistribution[record.mode].count += 1;

      if (record.usedStandardQueue) {
        queueDistribution.standard.cost += record.cost;
        queueDistribution.standard.count += 1;
      } else {
        queueDistribution.live.cost += record.cost;
        queueDistribution.live.count += 1;
      }
    }

    const todaySpend = todayRecords.reduce((sum, r) => sum + r.cost, 0);
    const monthSpend = monthRecords.reduce((sum, r) => sum + r.cost, 0);

    // Calculate savings from Standard Queue
    let savingsFromStandardQueue = 0;
    for (const record of monthRecords) {
      if (record.usedStandardQueue) {
        const liveEquivalent = DFS_LIVE_COSTS[record.mode];
        savingsFromStandardQueue += liveEquivalent - record.cost;
      }
    }

    return {
      todaySpend,
      monthSpend,
      requestsToday: todayRecords.length,
      requestsMonth: monthRecords.length,
      averageCostPerRequest: monthRecords.length > 0 ? monthSpend / monthRecords.length : 0,
      tierDistribution,
      queueDistribution,
      savingsFromStandardQueue,
    };
  }

  /**
   * Flush any pending batches immediately.
   */
  async flushPendingBatches(): Promise<void> {
    await this.batcher.flushAll();
  }

  /**
   * Get pending batch statistics.
   */
  getPendingBatchStats(): {
    pendingBatches: number;
    pendingUrls: number;
    estimatedCost: number;
  } {
    return this.batcher.getStats();
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Execute a Live API fetch.
   */
  private async executeliveFetch(
    url: string,
    mode: DfsMode,
    options: DfsFetchOptions,
    startTime: number
  ): Promise<DfsFetchResult> {
    const endpoint =
      mode === "basic"
        ? "/v3/on_page/instant_pages"
        : "/v3/on_page/content_parsing/live";

    const payload = this.buildPayload(url, mode, options);
    const response = await this.postApi(endpoint, [payload]);

    // Parse response
    const parsed = apiResponseSchema.safeParse(response);
    if (!parsed.success) {
      throw buildDfsError("Invalid API response", { url, mode });
    }

    const data = parsed.data;
    if (data.status_code !== 20000) {
      throw buildDfsError(data.status_message ?? "API error", {
        url,
        mode,
        errorCode: data.status_code,
      });
    }

    const task = data.tasks?.[0];
    if (!task) {
      throw buildDfsError("No task in response", { url, mode });
    }

    if (task.status_code !== 20000) {
      throw buildDfsError(task.status_message ?? "Task error", {
        url,
        mode,
        errorCode: task.status_code,
      });
    }

    // Extract result
    const result = task.result?.[0] as {
      raw_html?: string;
      status_code?: number;
      meta?: Record<string, unknown>;
      links?: Record<string, unknown>;
      resources?: Record<string, unknown>;
      page_timing?: Record<string, unknown>;
    };

    if (!result) {
      throw buildDfsError("No result in task", { url, mode });
    }

    const html = result.raw_html ?? "";
    const latencyMs = Date.now() - startTime;
    const cost = task.cost ?? DFS_LIVE_COSTS[mode];

    // Map pre-parsed data if available
    let parsedData: DataForSEOParsedData | undefined;
    if (result.meta) {
      parsedData = mapDfsResultToParsedData(result as import("./DataForSEOFetcher.types").DfsOnPageResultItem);
    }

    // Record cost
    this.recordCost({
      url,
      mode,
      cost,
      usedStandardQueue: false,
      timestamp: new Date(),
    });

    return {
      success: true,
      tier: TIER_TO_NUMBER[`dfs_${mode}` as "dfs_basic" | "dfs_js" | "dfs_browser"],
      html: html || undefined,
      statusCode: result.status_code,
      latencyMs,
      bytesTransferred: Buffer.byteLength(html, "utf8"),
      proxyUsed: `dataforseo:${mode}:live`,
      estimatedCost: DFS_LIVE_COSTS[mode],
      actualCost: cost,
      modeUsed: mode,
      usedStandardQueue: false,
      parsedData,
    };
  }

  /**
   * Build payload for DFS API.
   */
  private buildPayload(url: string, mode: DfsMode, options: DfsFetchOptions): unknown {
    return {
      url,
      enable_javascript: mode !== "basic",
      enable_browser_rendering: mode === "browser",
      store_raw_html: options.includeRawHtml ?? true,
      load_resources: options.loadResources ?? false,
      browser_preset: options.device === "mobile" ? "mobile" : "desktop",
      custom_js: options.customJs,
    };
  }

  /**
   * Create a failure result.
   */
  private createFailureResult(
    url: string,
    mode: DfsMode,
    error: unknown,
    startTime: number
  ): DfsFetchResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = classifyDfsError(undefined, undefined, errorMessage);

    return {
      success: false,
      tier: TIER_TO_NUMBER[`dfs_${mode}` as "dfs_basic" | "dfs_js" | "dfs_browser"],
      error: errorMessage,
      errorType,
      latencyMs: Date.now() - startTime,
      bytesTransferred: 0,
      estimatedCost: DFS_LIVE_COSTS[mode],
      modeUsed: mode,
      usedStandardQueue: false,
    };
  }

  /**
   * Record a cost entry.
   */
  private recordCost(record: CostRecord): void {
    this.costRecords.push(record);

    // Keep only last 10000 records in memory
    if (this.costRecords.length > 10000) {
      this.costRecords.splice(0, this.costRecords.length - 10000);
    }
  }

  /**
   * POST to DataForSEO API.
   */
  private async postApi(path: string, payload: unknown): Promise<unknown> {
    const authHeader = `Basic ${Buffer.from(this.apiKey).toString("base64")}`;

    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`DataForSEO HTTP ${response.status}: ${text.slice(0, 500)}`);
    }

    return JSON.parse(text);
  }
}

// =============================================================================
// Cost Record Type
// =============================================================================

interface CostRecord {
  url: string;
  mode: DfsMode;
  cost: number;
  usedStandardQueue: boolean;
  timestamp: Date;
}

// =============================================================================
// Singleton Factory
// =============================================================================

let _optimizedFetcher: OptimizedDataForSEOFetcher | null = null;

/**
 * Get or create the optimized DataForSEO fetcher singleton.
 */
export function getOptimizedDataForSEOFetcher(options?: {
  timeoutMs?: number;
  batchSize?: number;
  flushTimeoutMs?: number;
  webhookBaseUrl?: string;
}): OptimizedDataForSEOFetcher {
  if (!_optimizedFetcher) {
    _optimizedFetcher = new OptimizedDataForSEOFetcher(options);
  }
  return _optimizedFetcher;
}

/**
 * Reset the singleton (for testing).
 */
export function resetOptimizedDataForSEOFetcher(): void {
  if (_optimizedFetcher) {
    _optimizedFetcher.flushPendingBatches().catch(() => {});
  }
  _optimizedFetcher = null;
}
