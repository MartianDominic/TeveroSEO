/**
 * Camoufox Fetcher (T2.5)
 * Phase 95: Unified Scraping Infrastructure - TieredFetcher + Domain Learning
 *
 * Stealth browser fetching using Camoufox with Geonode proxy integration.
 * Positioned between residential proxy (T2) and DataForSEO (T3).
 *
 * Use cases:
 * - Sites that detect datacenter proxies (Cloudflare)
 * - Sites that require JS but are too expensive for DFS
 * - Sites with complex anti-bot requiring real browser fingerprints
 *
 * Cost: $0.77/GB (same as Geonode, just browser overhead)
 */

import type { FetchResult, BaseFetchOptions, ConnectionTestResult } from "./types";
import { TIER_TO_NUMBER } from "./types";
import type { EscalationReason } from "@/db/domain-scrape-learning-schema";
import {
  CamoufoxPool,
  createGeonodePool,
  type PageHandle,
  type PoolConfig,
} from "../camoufox/pool";

// =============================================================================
// Types
// =============================================================================

export interface CamoufoxFetchOptions extends BaseFetchOptions {
  /** Wait for selector before considering page loaded */
  waitForSelector?: string;

  /** Wait for load state (default: domcontentloaded) */
  waitUntil?: "load" | "domcontentloaded" | "networkidle";

  /** Execute custom JavaScript after page load */
  evaluateScript?: string;

  /** Screenshot on error (for debugging) */
  screenshotOnError?: boolean;

  /** Block images to save bandwidth */
  blockImages?: boolean;

  /** Block web fonts */
  blockFonts?: boolean;
}

// =============================================================================
// Error Classification
// =============================================================================

/**
 * Classify Playwright/Camoufox error for escalation.
 */
function classifyPlaywrightError(error: Error): EscalationReason {
  const message = error.message.toLowerCase();

  // Timeout
  if (
    error.name === "TimeoutError" ||
    message.includes("timeout") ||
    message.includes("waiting for selector")
  ) {
    return "timeout";
  }

  // Navigation failures
  if (
    message.includes("net::err_") ||
    message.includes("navigation failed") ||
    message.includes("failed to navigate")
  ) {
    if (message.includes("connection_refused") || message.includes("connection_reset")) {
      return "connection_reset";
    }
    if (message.includes("name_not_resolved")) {
      return "dns_error";
    }
    if (message.includes("ssl") || message.includes("certificate")) {
      return "ssl_error";
    }
  }

  // Page blocked or requires more advanced handling
  if (message.includes("blocked") || message.includes("access denied")) {
    return "bot_detected";
  }

  return "bot_detected"; // Default for browser failures
}

/**
 * Detect blocking from page content.
 */
function detectPageBlocking(html: string): EscalationReason | undefined {
  const htmlLower = html.toLowerCase();

  // CAPTCHA detection
  if (
    htmlLower.includes("recaptcha") ||
    htmlLower.includes("hcaptcha") ||
    htmlLower.includes("g-recaptcha") ||
    htmlLower.includes("captcha-container") ||
    htmlLower.includes("challenge-running")
  ) {
    return "captcha";
  }

  // Cloudflare challenge (still visible even with Camoufox)
  if (
    htmlLower.includes("checking your browser") ||
    htmlLower.includes("just a moment") ||
    htmlLower.includes("enable javascript and cookies")
  ) {
    return "bot_detected";
  }

  // Generic blocking
  if (
    htmlLower.includes("access denied") ||
    htmlLower.includes("blocked") ||
    htmlLower.includes("forbidden")
  ) {
    return "ip_blocked";
  }

  return undefined;
}

// =============================================================================
// Fetcher Class
// =============================================================================

export class CamoufoxFetcher {
  private pool: CamoufoxPool | null = null;
  private poolConfig: Partial<PoolConfig>;
  private initPromise: Promise<void> | null = null;
  private defaultTimeout: number;
  private maxRetries: number;

  constructor(
    options: {
      timeoutMs?: number;
      maxRetries?: number;
      poolConfig?: Partial<PoolConfig>;
    } = {}
  ) {
    this.defaultTimeout = options.timeoutMs ?? 30000;
    this.maxRetries = options.maxRetries ?? 1;
    this.poolConfig = options.poolConfig ?? {};
  }

  /**
   * Ensure pool is initialized.
   */
  private async ensurePool(): Promise<CamoufoxPool> {
    if (this.pool) {
      return this.pool;
    }

    // Avoid multiple simultaneous initializations
    if (!this.initPromise) {
      this.initPromise = this.initializePool();
    }

    await this.initPromise;
    return this.pool!;
  }

  /**
   * Initialize the browser pool.
   */
  private async initializePool(): Promise<void> {
    this.pool = createGeonodePool({
      // Scale down for fetcher use (vs. full pool for crawling)
      minInstances: 2,
      maxInstances: 10,
      maxPagesPerInstance: 3,
      ...this.poolConfig,
    });

    await this.pool.initialize();
  }

  /**
   * Fetch a URL using Camoufox stealth browser.
   */
  async fetch(options: CamoufoxFetchOptions): Promise<FetchResult> {
    const startTime = Date.now();
    const timeoutMs = options.timeoutMs ?? this.defaultTimeout;
    const maxRetries = options.maxRetries ?? this.maxRetries;

    let pageHandle: PageHandle | null = null;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Ensure pool is ready
        const pool = await this.ensurePool();

        // Acquire page from pool
        pageHandle = await pool.acquirePage(timeoutMs);
        const { page } = pageHandle;

        // Configure page
        if (options.blockImages) {
          await page.route("**/*.{png,jpg,jpeg,gif,webp,svg}", (route: { abort: () => void }) =>
            route.abort()
          );
        }
        if (options.blockFonts) {
          await page.route("**/*.{woff,woff2,ttf,otf}", (route: { abort: () => void }) =>
            route.abort()
          );
        }

        // Set custom headers
        if (options.headers) {
          await page.setExtraHTTPHeaders(options.headers);
        }

        // Navigate
        const response = await page.goto(options.url, {
          timeout: timeoutMs,
          waitUntil: options.waitUntil ?? "domcontentloaded",
        });

        // Wait for optional selector
        if (options.waitForSelector) {
          await page.waitForSelector(options.waitForSelector, {
            timeout: Math.min(timeoutMs / 2, 10000),
          });
        }

        // Execute custom script if provided
        if (options.evaluateScript) {
          await page.evaluate(options.evaluateScript);
        }

        // Get HTML content
        const html = await page.content();
        const latencyMs = Date.now() - startTime;
        const statusCode = response?.status() ?? 200;

        // Release page (success)
        await pool.releasePage(pageHandle, true);
        pageHandle = null;

        // Check for blocking in content
        const blockingReason = detectPageBlocking(html);
        if (blockingReason) {
          return {
            success: false,
            tier: TIER_TO_NUMBER.camoufox,
            html: undefined,
            statusCode,
            error: `Page blocked: ${blockingReason}`,
            errorType: blockingReason,
            latencyMs,
            bytesTransferred: Buffer.byteLength(html, "utf8"),
            proxyUsed: "camoufox:geonode",
          };
        }

        // Check for empty response
        if (html.length < 200) {
          return {
            success: false,
            tier: TIER_TO_NUMBER.camoufox,
            html: undefined,
            statusCode,
            error: "Response too small",
            errorType: "empty_response",
            latencyMs,
            bytesTransferred: Buffer.byteLength(html, "utf8"),
            proxyUsed: "camoufox:geonode",
          };
        }

        // Check status code
        if (statusCode >= 400) {
          return {
            success: false,
            tier: TIER_TO_NUMBER.camoufox,
            html: undefined,
            statusCode,
            error: `HTTP ${statusCode}`,
            errorType:
              statusCode === 403
                ? "ip_blocked"
                : statusCode === 429
                  ? "rate_limited"
                  : undefined,
            latencyMs,
            bytesTransferred: Buffer.byteLength(html, "utf8"),
            proxyUsed: "camoufox:geonode",
          };
        }

        return {
          success: true,
          tier: TIER_TO_NUMBER.camoufox,
          html,
          statusCode,
          latencyMs,
          bytesTransferred: Buffer.byteLength(html, "utf8"),
          proxyUsed: "camoufox:geonode",
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Release page on failure
        if (pageHandle && this.pool) {
          try {
            await this.pool.releasePage(pageHandle, false);
          } catch {
            // Ignore release errors
          }
          pageHandle = null;
        }

        // Don't retry on timeout
        if (
          lastError.name === "TimeoutError" ||
          lastError.message.includes("timeout")
        ) {
          break;
        }

        // Exponential backoff
        if (attempt < maxRetries) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000)
          );
        }
      }
    }

    return {
      success: false,
      tier: TIER_TO_NUMBER.camoufox,
      error: lastError?.message ?? "Unknown error",
      errorType: lastError ? classifyPlaywrightError(lastError) : undefined,
      latencyMs: Date.now() - startTime,
      bytesTransferred: 0,
      proxyUsed: "camoufox:geonode",
    };
  }

  /**
   * Test Camoufox connectivity.
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      const result = await this.fetch({
        url: "https://httpbin.org/ip",
        timeoutMs: 15000,
        maxRetries: 0,
      });

      if (!result.success || !result.html) {
        return {
          success: false,
          latencyMs: Date.now() - startTime,
          error: result.error,
        };
      }

      // Extract IP from page content (httpbin returns JSON in a <pre> tag)
      const ipMatch = result.html.match(/"origin"\s*:\s*"([^"]+)"/);
      const ip = ipMatch ? ipMatch[1] : undefined;

      return {
        success: true,
        latencyMs: Date.now() - startTime,
        ip,
      };
    } catch (error) {
      return {
        success: false,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get pool metrics.
   */
  getPoolMetrics() {
    return this.pool?.getMetrics() ?? null;
  }

  /**
   * Shutdown the browser pool.
   */
  async shutdown(timeoutMs = 30000): Promise<void> {
    if (this.pool) {
      await this.pool.shutdown(timeoutMs);
      this.pool = null;
      this.initPromise = null;
    }
  }
}

// =============================================================================
// Singleton Factory
// =============================================================================

let _camoufoxFetcher: CamoufoxFetcher | null = null;

/**
 * Get or create the Camoufox fetcher singleton.
 * NOTE: This lazily initializes the browser pool on first fetch.
 */
export function getCamoufoxFetcher(): CamoufoxFetcher {
  if (!_camoufoxFetcher) {
    _camoufoxFetcher = new CamoufoxFetcher();
  }
  return _camoufoxFetcher;
}

/**
 * Create a new Camoufox fetcher (for testing).
 */
export function createCamoufoxFetcher(
  options?: {
    timeoutMs?: number;
    maxRetries?: number;
    poolConfig?: Partial<PoolConfig>;
  }
): CamoufoxFetcher {
  return new CamoufoxFetcher(options);
}

/**
 * Reset the singleton (for testing).
 */
export async function resetCamoufoxFetcher(): Promise<void> {
  if (_camoufoxFetcher) {
    await _camoufoxFetcher.shutdown();
    _camoufoxFetcher = null;
  }
}
