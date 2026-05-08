/**
 * DataForSEO Batch Processor
 * Phase 95: Unified Scraping Infrastructure - DataForSEO Optimization
 *
 * Batches multiple URL requests for Standard Queue processing.
 * Cost savings: 70-99% cheaper than Live API for non-urgent requests.
 *
 * Features:
 * - Automatic batching up to 100 URLs per request
 * - Configurable flush timeout (default 5s)
 * - Webhook or polling for result delivery
 * - Promise-based API for individual URL resolution
 */

import { nanoid } from "nanoid";
import type {
  DfsFetchOptions,
  DfsFetchResult,
  DfsBatch,
  BatchedUrl,
  BatchStatus,
  DfsMode,
  DfsTaskPostResponse,
  DfsTasksReadyResponse,
} from "./DataForSEOFetcher.types";
import { mapDfsResultToParsedData } from "./DfsDataMapper";
import { DFS_STANDARD_COSTS } from "@/db/dfs-cost-tracking-schema";
import { db } from "@/db";
import { getDfsCostTracker, extractDomainFromUrl } from "./DfsCostTracker";
import { costLogger } from "../logging/Logger";
import { getDataForSEOAuthHeader } from "@/server/lib/dataforseo-auth";

// =============================================================================
// Constants
// =============================================================================

const API_BASE = "https://api.dataforseo.com";
const MAX_BATCH_SIZE = 100;
const DEFAULT_FLUSH_TIMEOUT_MS = 5000;
const DEFAULT_POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150; // 5 minutes at 2s interval

// =============================================================================
// Batcher Class
// =============================================================================

/**
 * Batches DataForSEO requests for Standard Queue processing.
 *
 * Usage:
 * ```typescript
 * const batcher = new DataForSEOBatcher({ apiKey: '...' });
 * const result = await batcher.queueUrl('https://example.com', { mode: 'basic' });
 * ```
 */
export class DataForSEOBatcher {
  private pendingBatches: Map<string, DfsBatch> = new Map();
  private batchCallbacks: Map<string, Map<string, (result: DfsFetchResult) => void>> =
    new Map();
  private flushTimers: Map<string, NodeJS.Timeout> = new Map();
  private readonly apiKey: string;
  private readonly batchSize: number;
  private readonly flushTimeoutMs: number;
  private readonly webhookBaseUrl?: string;

  constructor(options: {
    apiKey?: string;
    batchSize?: number;
    flushTimeoutMs?: number;
    webhookBaseUrl?: string;
  }) {
    this.apiKey = options.apiKey ?? process.env.DATAFORSEO_API_KEY ?? "";
    this.batchSize = Math.min(options.batchSize ?? MAX_BATCH_SIZE, MAX_BATCH_SIZE);
    this.flushTimeoutMs = options.flushTimeoutMs ?? DEFAULT_FLUSH_TIMEOUT_MS;
    this.webhookBaseUrl = options.webhookBaseUrl;

    if (!this.apiKey) {
      throw new Error(
        "DATAFORSEO_API_KEY not configured. Set in environment or pass to constructor."
      );
    }
  }

  /**
   * Queue a URL for batch processing.
   * Returns a promise that resolves when the URL is processed.
   *
   * @param url - URL to fetch
   * @param options - Fetch options
   * @returns Promise resolving to fetch result
   */
  async queueUrl(url: string, options: DfsFetchOptions = {}): Promise<DfsFetchResult> {
    return new Promise((resolve) => {
      const batchKey = this.getBatchKey(options);

      // Get or create batch
      let batch = this.pendingBatches.get(batchKey);
      if (!batch) {
        batch = this.createBatch(batchKey, options);
        this.pendingBatches.set(batchKey, batch);
        this.scheduleBatchFlush(batchKey);
      }

      // Get or create callback map for this batch
      let callbacks = this.batchCallbacks.get(batch.id);
      if (!callbacks) {
        callbacks = new Map();
        this.batchCallbacks.set(batch.id, callbacks);
      }

      // Add URL to batch
      const batchedUrl: BatchedUrl = {
        url,
        options,
        status: "pending",
        addedAt: new Date(),
      };
      batch.urls.push(batchedUrl);
      callbacks.set(url, resolve);

      // Update estimated cost
      const mode = options.mode ?? "basic";
      batch.estimatedCost += DFS_STANDARD_COSTS[mode];

      // Flush immediately if batch is full
      if (batch.urls.length >= this.batchSize) {
        this.flushBatch(batchKey);
      }
    });
  }

  /**
   * Manually flush a batch (don't wait for timeout).
   *
   * @param batchKey - Batch key to flush
   */
  async flushBatch(batchKey: string): Promise<void> {
    const batch = this.pendingBatches.get(batchKey);
    if (!batch || batch.urls.length === 0) return;

    // Clear flush timer
    const timer = this.flushTimers.get(batchKey);
    if (timer) {
      clearTimeout(timer);
      this.flushTimers.delete(batchKey);
    }

    // Remove from pending
    this.pendingBatches.delete(batchKey);

    // Update batch status
    batch.status = "submitted";
    batch.submittedAt = new Date();

    try {
      // Submit batch to Standard Queue
      const taskIds = await this.submitToStandardQueue(batch);
      batch.taskIds = taskIds;

      // Poll for results
      batch.status = "polling";
      const results = await this.pollForResults(taskIds);

      // Resolve individual promises
      batch.status = "completed";
      batch.completedAt = new Date();
      this.resolveResults(batch, results);
    } catch (error) {
      // Reject all promises in batch
      batch.status = "failed";
      batch.completedAt = new Date();
      this.rejectBatch(batch, error);
    }
  }

  /**
   * Flush all pending batches.
   */
  async flushAll(): Promise<void> {
    const keys = Array.from(this.pendingBatches.keys());
    await Promise.all(keys.map((key) => this.flushBatch(key)));
  }

  /**
   * Get current batch statistics.
   */
  getStats(): {
    pendingBatches: number;
    pendingUrls: number;
    estimatedCost: number;
  } {
    let pendingUrls = 0;
    let estimatedCost = 0;

    for (const batch of this.pendingBatches.values()) {
      pendingUrls += batch.urls.length;
      estimatedCost += batch.estimatedCost;
    }

    return {
      pendingBatches: this.pendingBatches.size,
      pendingUrls,
      estimatedCost,
    };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Generate a batch key from options.
   * URLs with same options are batched together.
   */
  private getBatchKey(options: DfsFetchOptions): string {
    const mode = options.mode ?? "basic";
    const device = options.device ?? "desktop";
    const loadResources = options.loadResources ?? false;

    return `${mode}:${device}:${loadResources}`;
  }

  /**
   * Create a new batch.
   */
  private createBatch(batchKey: string, options: DfsFetchOptions): DfsBatch {
    return {
      id: nanoid(),
      urls: [],
      options,
      status: "pending",
      createdAt: new Date(),
      taskIds: [],
      estimatedCost: 0,
    };
  }

  /**
   * Schedule automatic batch flush after timeout.
   */
  private scheduleBatchFlush(batchKey: string): void {
    const timer = setTimeout(() => {
      this.flushBatch(batchKey);
    }, this.flushTimeoutMs);

    this.flushTimers.set(batchKey, timer);
  }

  /**
   * Submit batch to DataForSEO Standard Queue (task_post endpoint).
   */
  private async submitToStandardQueue(batch: DfsBatch): Promise<string[]> {
    const mode = batch.options.mode ?? "basic";

    // Build task payload for each URL
    const tasks = batch.urls.map((urlItem) => ({
      url: urlItem.url,
      enable_javascript: mode !== "basic",
      enable_browser_rendering: mode === "browser",
      store_raw_html: batch.options.includeRawHtml ?? true,
      load_resources: batch.options.loadResources ?? false,
      browser_preset: batch.options.device === "mobile" ? "mobile" : "desktop",
      // Webhook URL if configured
      pingback_url: this.webhookBaseUrl
        ? `${this.webhookBaseUrl}/dataforseo/onpage/${batch.id}`
        : undefined,
    }));

    const response = await this.postApi("/v3/on_page/task_post", tasks);

    // Parse response
    const parsed = response as DfsTaskPostResponse;
    if (parsed.status_code !== 20000) {
      throw new Error(parsed.status_message || "Failed to submit batch");
    }

    // Extract task IDs
    const taskIds: string[] = [];
    for (const task of parsed.tasks ?? []) {
      if (task.id) {
        taskIds.push(task.id);
      }
    }

    return taskIds;
  }

  /**
   * Poll for task results until all complete.
   */
  private async pollForResults(
    taskIds: string[]
  ): Promise<Map<string, DfsFetchResult>> {
    const results = new Map<string, DfsFetchResult>();
    const pendingTasks = new Set(taskIds);

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
      if (pendingTasks.size === 0) break;

      // Wait before polling (except first attempt)
      if (attempt > 0) {
        await this.sleep(DEFAULT_POLL_INTERVAL_MS);
      }

      // Check which tasks are ready
      const readyResponse = await this.getApi("/v3/on_page/tasks_ready");
      const ready = readyResponse as DfsTasksReadyResponse;

      if (ready.status_code !== 20000) continue;

      // Process ready tasks
      for (const task of ready.tasks ?? []) {
        if (!pendingTasks.has(task.id)) continue;

        // Get task results
        if (task.result && task.result.length > 0) {
          for (const item of task.result) {
            const fetchResult = this.mapTaskResultToFetchResult(
              item,
              "basic", // Mode is determined by task options
              true
            );
            results.set(item.url, fetchResult);
          }
          pendingTasks.delete(task.id);
        }
      }
    }

    // Mark remaining tasks as failed
    for (const taskId of pendingTasks) {
      // We don't know the URL for failed tasks, so this is handled in resolveResults
    }

    return results;
  }

  /**
   * Map DFS task result item to FetchResult.
   */
  private mapTaskResultToFetchResult(
    item: unknown,
    mode: DfsMode,
    usedStandardQueue: boolean
  ): DfsFetchResult {
    const typedItem = item as {
      url?: string;
      status_code?: number;
      raw_html?: string;
      fetch_html?: string;
      meta?: Record<string, unknown>;
      links?: Record<string, unknown>;
      resources?: Record<string, unknown>;
      page_timing?: Record<string, unknown>;
    };

    const html = typedItem.raw_html ?? typedItem.fetch_html ?? "";
    const success = (typedItem.status_code ?? 0) >= 200 && (typedItem.status_code ?? 0) < 400;

    // Map pre-parsed data if available
    let parsedData;
    if (typedItem.meta || typedItem.links) {
      parsedData = mapDfsResultToParsedData(typedItem as import("./DataForSEOFetcher.types").DfsOnPageResultItem);
    }

    return {
      success,
      tier: mode === "basic" ? 3 : mode === "js" ? 4 : 5,
      html: html || undefined,
      statusCode: typedItem.status_code,
      latencyMs: 0, // Not available for queue results
      bytesTransferred: Buffer.byteLength(html, "utf8"),
      proxyUsed: `dataforseo:${mode}:queue`,
      estimatedCost: DFS_STANDARD_COSTS[mode],
      actualCost: undefined, // Actual cost comes from billing
      modeUsed: mode,
      usedStandardQueue,
      parsedData,
      deliveredAt: new Date(),
    };
  }

  /**
   * Resolve results for a completed batch.
   * Tracks costs for Standard Queue usage (70% cheaper than Live API).
   */
  private resolveResults(
    batch: DfsBatch,
    results: Map<string, DfsFetchResult>
  ): void {
    const callbacks = this.batchCallbacks.get(batch.id);
    if (!callbacks) return;

    const mode = batch.options.mode ?? "basic";
    const costRecords: Array<{
      url: string;
      domain: string;
      mode: DfsMode;
      usedStandardQueue: boolean;
      estimatedCost: number;
      success: boolean;
      statusCode?: number;
      responseSizeBytes?: number;
      clientId?: string;
      workspaceId?: string;
      jobId?: string;
      taskId?: string;
    }> = [];

    for (const urlItem of batch.urls) {
      const callback = callbacks.get(urlItem.url);
      if (!callback) continue;

      const result = results.get(urlItem.url);
      if (result) {
        urlItem.status = "completed";
        urlItem.result = result;
        callback(result);

        // Collect cost record for successful fetch
        costRecords.push({
          url: urlItem.url,
          domain: extractDomainFromUrl(urlItem.url),
          mode,
          usedStandardQueue: true,
          estimatedCost: DFS_STANDARD_COSTS[mode],
          success: result.success,
          statusCode: result.statusCode,
          responseSizeBytes: result.bytesTransferred,
          clientId: batch.options.clientId,
          workspaceId: batch.options.workspaceId,
          jobId: batch.options.jobId,
          taskId: urlItem.taskId,
        });
      } else {
        // URL not found in results - return failure
        urlItem.status = "failed";
        const failResult: DfsFetchResult = {
          success: false,
          tier: 3,
          error: "URL not in batch results (timeout or task failure)",
          latencyMs: 0,
          bytesTransferred: 0,
          estimatedCost: DFS_STANDARD_COSTS[mode],
          modeUsed: mode,
          usedStandardQueue: true,
        };
        urlItem.result = failResult;
        callback(failResult);

        // Track failed URLs too (we still pay for the attempt)
        costRecords.push({
          url: urlItem.url,
          domain: extractDomainFromUrl(urlItem.url),
          mode,
          usedStandardQueue: true,
          estimatedCost: DFS_STANDARD_COSTS[mode],
          success: false,
          clientId: batch.options.clientId,
          workspaceId: batch.options.workspaceId,
          jobId: batch.options.jobId,
        });
      }
    }

    // Cleanup callbacks
    this.batchCallbacks.delete(batch.id);

    // Fire-and-forget cost tracking for Standard Queue savings visibility
    if (costRecords.length > 0) {
      const costTracker = getDfsCostTracker(db);
      costTracker.recordCostBatch(costRecords).catch((err) => {
        // Log but don't fail - cost tracking is non-critical
        costLogger.warn(
          {
            batchId: batch.id,
            urlCount: costRecords.length,
            error: err instanceof Error ? err.message : String(err),
          },
          'Failed to track batch costs'
        );
      });
    }
  }

  /**
   * Reject all URLs in a failed batch.
   */
  private rejectBatch(batch: DfsBatch, error: unknown): void {
    const callbacks = this.batchCallbacks.get(batch.id);
    if (!callbacks) return;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const mode = batch.options.mode ?? "basic";

    for (const urlItem of batch.urls) {
      const callback = callbacks.get(urlItem.url);
      if (!callback) continue;

      urlItem.status = "failed";
      const failResult: DfsFetchResult = {
        success: false,
        tier: 3,
        error: `Batch failed: ${errorMessage}`,
        latencyMs: 0,
        bytesTransferred: 0,
        estimatedCost: DFS_STANDARD_COSTS[mode],
        modeUsed: mode,
        usedStandardQueue: true,
      };
      urlItem.result = failResult;
      callback(failResult);
    }

    // Cleanup callbacks
    this.batchCallbacks.delete(batch.id);
  }

  // ===========================================================================
  // HTTP Helpers
  // ===========================================================================

  /**
   * Get the auth header - uses canonical module or instance override for testing.
   */
  private getAuthHeader(): string {
    // If custom apiKey was provided (for testing), use it directly
    if (this.apiKey && this.apiKey !== process.env.DATAFORSEO_API_KEY) {
      return `Basic ${this.apiKey}`;
    }
    // Otherwise use canonical auth module
    return getDataForSEOAuthHeader();
  }

  /**
   * POST to DataForSEO API.
   * Uses canonical auth from @/server/lib/dataforseo-auth.
   */
  private async postApi(path: string, payload: unknown): Promise<unknown> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: this.getAuthHeader(),
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

  /**
   * GET from DataForSEO API.
   * Uses canonical auth from @/server/lib/dataforseo-auth.
   */
  private async getApi(path: string): Promise<unknown> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: "GET",
      headers: {
        Authorization: this.getAuthHeader(),
      },
    });

    const text = await response.text();

    if (!response.ok) {
      throw new Error(`DataForSEO HTTP ${response.status}: ${text.slice(0, 500)}`);
    }

    return JSON.parse(text);
  }

  /**
   * Sleep helper.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let _batcherInstance: DataForSEOBatcher | null = null;

/**
 * Get or create the DataForSEO batcher singleton.
 */
export function getDataForSEOBatcher(options?: {
  batchSize?: number;
  flushTimeoutMs?: number;
  webhookBaseUrl?: string;
}): DataForSEOBatcher {
  if (!_batcherInstance) {
    _batcherInstance = new DataForSEOBatcher(options ?? {});
  }
  return _batcherInstance;
}

/**
 * Reset the batcher singleton (for testing).
 */
export function resetDataForSEOBatcher(): void {
  if (_batcherInstance) {
    // Flush any pending batches before reset
    _batcherInstance.flushAll().catch(() => {});
  }
  _batcherInstance = null;
}
