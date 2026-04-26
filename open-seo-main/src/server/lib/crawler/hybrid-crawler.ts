/**
 * Hybrid Crawler
 *
 * High-performance crawler with HTTP-first approach and Playwright fallback.
 *
 * Per cpu-only-rag-graph.md Section 1:
 * - 2-minute SLA for 10k pages requires ~83 pages/sec
 * - HTTP-first at concurrency 200 reaches 80-150 pages/sec
 * - Playwright fallback only for 1-2% of pages needing JS
 *
 * Per crawling doc Section 1:
 * - Cookie consent/bot challenge pages return HTTP 200 but block content
 * - Detect these and retry with Playwright
 */

import {
  fetchAllSitemapUrls,
  filterByLastmod,
  type SitemapUrl,
} from "./sitemap-parser";
import { DeltaSyncService, ChangeType } from "./delta-sync";
import { validatePage } from "@/server/lib/lightrag/extraction-pipeline";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "hybrid-crawler" });

export interface CrawlOptions {
  /** Maximum concurrent HTTP requests (default: 50) */
  concurrency?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** User-Agent header (default: TeveroSEO/1.0) */
  userAgent?: string;
  /** Accept-Language header (default: lt-LT,lt;q=0.9,en;q=0.8) */
  acceptLanguage?: string;
  /** Enable delta sync to skip unchanged pages (default: true) */
  enableDeltaSync?: boolean;
  /** Date of last crawl for delta sync filtering */
  lastCrawlDate?: Date;
  /** Enable Playwright fallback for JS-heavy pages (default: true) */
  playwrightFallback?: boolean;
}

export interface CrawlResult {
  /** URL that was crawled */
  url: string;
  /** HTML content of the page */
  html: string;
  /** HTTP status code */
  statusCode: number;
  /** Method used to fetch the page */
  fetchMethod: "http" | "playwright";
  /** Change type detected by delta sync */
  changeType: ChangeType;
  /** Time taken to fetch in milliseconds */
  fetchTimeMs: number;
}

export interface CrawlSummary {
  /** Total URLs found in sitemap */
  totalUrls: number;
  /** URLs successfully crawled */
  crawled: number;
  /** URLs skipped (delta sync) */
  skipped: number;
  /** URLs that failed to crawl */
  failed: number;
  /** Count of HTTP fetches */
  httpFetches: number;
  /** Count of Playwright fetches */
  playwrightFetches: number;
  /** Total time in milliseconds */
  totalTimeMs: number;
  /** Pages crawled per second */
  pagesPerSecond: number;
}

const DEFAULT_OPTIONS: Required<CrawlOptions> = {
  concurrency: 50,
  timeoutMs: 30000,
  userAgent: "TeveroSEO/1.0 (+https://teveroseo.com/bot)",
  acceptLanguage: "lt-LT,lt;q=0.9,en;q=0.8",
  enableDeltaSync: true,
  lastCrawlDate: new Date(0),
  playwrightFallback: true,
};

/**
 * Simple semaphore for concurrency control.
 */
class Semaphore {
  private count: number;
  private queue: Array<() => void> = [];

  constructor(count: number) {
    this.count = count;
  }

  async acquire(): Promise<void> {
    if (this.count > 0) {
      this.count--;
      return;
    }
    await new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.count++;
    }
  }
}

/**
 * Hybrid crawler: HTTP-first with Playwright fallback.
 *
 * Design principles:
 * 1. HTTP-first: Most pages can be fetched with simple HTTP
 * 2. Playwright fallback: Only for JS-heavy or consent-blocked pages
 * 3. Delta sync: Skip unchanged pages using lastmod and hashes
 * 4. Concurrency control: Semaphore limits concurrent requests
 */
export class HybridCrawler {
  private options: Required<CrawlOptions>;
  private _deltaSync: DeltaSyncService; // TODO: Wire up in Phase 43

  constructor(options?: CrawlOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this._deltaSync = new DeltaSyncService();
  }

  /**
   * Crawl a site starting from sitemap URL.
   *
   * @param tenantId - Tenant identifier for delta sync
   * @param sitemapUrl - URL of the sitemap to crawl
   * @param onProgress - Optional progress callback
   */
  async crawlSite(
    _tenantId: string, // TODO: Use for delta sync in Phase 43
    sitemapUrl: string,
    onProgress?: (progress: {
      crawled: number;
      total: number;
      currentUrl: string;
    }) => void
  ): Promise<{ results: CrawlResult[]; summary: CrawlSummary }> {
    const startTime = Date.now();
    const results: CrawlResult[] = [];
    let httpFetches = 0;
    let playwrightFetches = 0;
    let skipped = 0;
    let failed = 0;

    // Fetch sitemap URLs
    log.info(`Fetching sitemap: ${sitemapUrl}`);
    const allUrls = await fetchAllSitemapUrls(sitemapUrl);
    log.info(`Found ${allUrls.length} URLs in sitemap`);

    // Apply delta sync L0: filter by lastmod
    let urlsToFetch: SitemapUrl[];
    if (this.options.enableDeltaSync && this.options.lastCrawlDate) {
      const { unchanged, changed, unknown } = filterByLastmod(
        allUrls,
        this.options.lastCrawlDate
      );
      skipped = unchanged.length;
      urlsToFetch = [...changed, ...unknown];
      log.info(
        `Delta sync L0: ${unchanged.length} skipped, ${urlsToFetch.length} to check`
      );
    } else {
      urlsToFetch = allUrls;
    }

    // Process URLs with concurrency control
    const semaphore = new Semaphore(this.options.concurrency);
    const fetchPromises = urlsToFetch.map(async (sitemapUrl) => {
      await semaphore.acquire();
      try {
        const result = await this.fetchPage(sitemapUrl.loc);
        results.push(result);

        if (result.fetchMethod === "http") {
          httpFetches++;
        } else {
          playwrightFetches++;
        }

        onProgress?.({
          crawled: results.length,
          total: urlsToFetch.length,
          currentUrl: sitemapUrl.loc,
        });
      } catch (error) {
        failed++;
        log.warn(
          `Failed to fetch: ${sitemapUrl.loc}`,
          error instanceof Error ? { error: error.message } : { error: String(error) }
        );
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(fetchPromises);

    const totalTimeMs = Date.now() - startTime;
    const summary: CrawlSummary = {
      totalUrls: allUrls.length,
      crawled: results.length,
      skipped,
      failed,
      httpFetches,
      playwrightFetches,
      totalTimeMs,
      pagesPerSecond: results.length / (totalTimeMs / 1000),
    };

    log.info(
      `Crawl complete: ${summary.crawled} pages in ${summary.totalTimeMs}ms (${summary.pagesPerSecond.toFixed(1)} pages/sec)`
    );

    return { results, summary };
  }

  /**
   * Fetch a single page, with Playwright fallback if needed.
   */
  async fetchPage(url: string): Promise<CrawlResult> {
    const fetchStart = Date.now();

    // Try HTTP first
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": this.options.userAgent,
          "Accept-Language": this.options.acceptLanguage,
          Accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(this.options.timeoutMs),
      });

      const html = await response.text();
      const validation = validatePage(html);

      // Check if we got a consent/challenge page
      if (!validation.valid && this.options.playwrightFallback) {
        log.debug(`HTTP returned blocked page, retrying with Playwright: ${url}`);
        return this.fetchWithPlaywright(url, fetchStart);
      }

      // Check if page is suspiciously small (likely needs JS)
      if (html.length < 2000 && this.options.playwrightFallback) {
        log.debug(`Page too small, retrying with Playwright: ${url}`);
        return this.fetchWithPlaywright(url, fetchStart);
      }

      return {
        url,
        html,
        statusCode: response.status,
        fetchMethod: "http",
        changeType: ChangeType.ADD, // Will be refined by delta sync
        fetchTimeMs: Date.now() - fetchStart,
      };
    } catch (error) {
      if (this.options.playwrightFallback) {
        log.debug(
          `HTTP failed, retrying with Playwright: ${url}`,
          error instanceof Error ? { error: error.message } : { error: String(error) }
        );
        return this.fetchWithPlaywright(url, fetchStart);
      }
      throw error;
    }
  }

  /**
   * Fetch with Playwright for JS-heavy pages.
   * Note: Playwright import is dynamic to avoid loading when not needed.
   *
   * @throws Error if Playwright is not installed
   */
  private async fetchWithPlaywright(
    url: string,
    fetchStart: number
  ): Promise<CrawlResult> {
    // Playwright types for dynamic import
    interface PlaywrightModule {
      chromium: {
        launch(options: { headless: boolean }): Promise<PlaywrightBrowser>;
      };
    }
    interface PlaywrightBrowser {
      newPage(): Promise<PlaywrightPage>;
      close(): Promise<void>;
    }
    interface PlaywrightPage {
      setExtraHTTPHeaders(headers: Record<string, string>): Promise<void>;
      goto(
        url: string,
        options: { waitUntil: string; timeout: number }
      ): Promise<PlaywrightResponse | null>;
      content(): Promise<string>;
    }
    interface PlaywrightResponse {
      status(): number;
    }

    try {
      // Dynamic import to avoid loading Playwright unless needed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const playwright = require("playwright") as PlaywrightModule;
      const { chromium } = playwright;

      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage();
        await page.setExtraHTTPHeaders({
          "Accept-Language": this.options.acceptLanguage,
        });

        const response = await page.goto(url, {
          waitUntil: "networkidle",
          timeout: this.options.timeoutMs,
        });

        const html = await page.content();

        return {
          url,
          html,
          statusCode: response?.status() ?? 200,
          fetchMethod: "playwright",
          changeType: ChangeType.ADD,
          fetchTimeMs: Date.now() - fetchStart,
        };
      } finally {
        await browser.close();
      }
    } catch (error) {
      // Playwright not installed or failed
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes("Cannot find module") &&
        message.includes("playwright")
      ) {
        throw new Error(
          `Playwright not installed. Install with: pnpm add -D playwright`
        );
      }
      throw error;
    }
  }
}

/**
 * Convenience function for one-shot site crawl.
 *
 * @param tenantId - Tenant identifier for delta sync
 * @param sitemapUrl - URL of the sitemap to crawl
 * @param options - Crawl options
 */
export async function crawlSite(
  tenantId: string,
  sitemapUrl: string,
  options?: CrawlOptions
): Promise<{ results: CrawlResult[]; summary: CrawlSummary }> {
  const crawler = new HybridCrawler(options);
  return crawler.crawlSite(tenantId, sitemapUrl);
}
