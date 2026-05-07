/**
 * TieredFetcher Migration Utilities
 * Phase 95: Unified Scraping Infrastructure - TieredFetcher + Domain Learning
 *
 * Provides backward-compatible adapters for migrating from:
 * - HybridCrawler (src/server/lib/crawler/hybrid-crawler.ts)
 * - UniversalCrawler (src/server/features/platform-oauth/crawler/UniversalCrawler.ts)
 *
 * Migration strategy:
 * 1. Import these adapters as drop-in replacements
 * 2. Gradually migrate to TieredFetcher native API
 * 3. Remove adapters when migration complete
 */

import { tieredFetcher, type FetchOptions, type FetchResult } from "../TieredFetcher";
import type { ScrapeTier } from "@/db/domain-scrape-learning-schema";

// =============================================================================
// HybridCrawler Compatibility Types
// =============================================================================

/**
 * Original HybridCrawler CrawlResult interface.
 * Mapped from TieredFetcher FetchResult.
 */
export interface HybridCrawlResult {
  /** URL that was crawled */
  url: string;
  /** HTML content of the page */
  html: string;
  /** HTTP status code */
  statusCode: number;
  /** Method used to fetch the page */
  fetchMethod: "http" | "playwright" | "tiered";
  /** Change type detected by delta sync */
  changeType: "add" | "modify" | "delete" | "unchanged";
  /** Time taken to fetch in milliseconds */
  fetchTimeMs: number;
}

/**
 * Original HybridCrawler CrawlOptions interface.
 */
export interface HybridCrawlOptions {
  /** Maximum concurrent HTTP requests (default: 50) */
  concurrency?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** User-Agent header */
  userAgent?: string;
  /** Enable delta sync to skip unchanged pages (default: true) */
  enableDeltaSync?: boolean;
  /** Date of last crawl for delta sync filtering */
  lastCrawlDate?: Date;
  /** Enable Playwright fallback for JS-heavy pages (default: true) */
  playwrightFallback?: boolean;
  /** Maximum redirect chain depth (default: 10) */
  maxRedirects?: number;
}

// =============================================================================
// UniversalCrawler Compatibility Types
// =============================================================================

/**
 * Original UniversalCrawler PageData interface.
 */
export interface PageData {
  title: string;
  metaDescription: string | null;
  h1: string[];
  h2: string[];
  canonicalUrl: string | null;
  ogTitle: string | null;
  ogDescription: string | null;
  internalLinks: string[];
}

/**
 * Original UniversalCrawler CrawlResult interface.
 */
export interface UniversalCrawlResult {
  status: "success" | "blocked" | "error" | "requires_upgrade";
  method?: "fetch" | "dataforseo" | "playwright" | "tiered";
  data?: PageData;
  sitemapUrls?: string[];
  reason?: string;
  error?: string;
  guidance?: string;
}

/**
 * Original UniversalCrawler CrawlOptions interface.
 */
export interface UniversalCrawlOptions {
  /** Maximum pages to crawl (default: 100) */
  maxPages?: number;
  /** Respect robots.txt (default: true) */
  respectRobots?: boolean;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** User agent string */
  userAgent?: string;
  /** Crawl provider to use */
  provider?: "auto" | "direct" | "dataforseo" | "playwright" | "tiered";
  /** DataForSEO configuration */
  dataForSeo?: {
    login: string;
    password: string;
    enableBrowserRendering?: boolean;
  };
}

// =============================================================================
// Adapter: HybridCrawler -> TieredFetcher
// =============================================================================

/**
 * Adapter that provides HybridCrawler-compatible interface using TieredFetcher.
 *
 * Usage:
 * ```typescript
 * // Before:
 * import { HybridCrawler } from "@/server/lib/crawler/hybrid-crawler";
 * const crawler = new HybridCrawler(options);
 * const result = await crawler.fetchPage(url);
 *
 * // After:
 * import { TieredCrawlerAdapter } from "@/server/features/scraping/migration";
 * const crawler = new TieredCrawlerAdapter(options);
 * const result = await crawler.fetchPage(url);
 * ```
 */
export class TieredCrawlerAdapter {
  private options: HybridCrawlOptions;

  constructor(options?: HybridCrawlOptions) {
    this.options = {
      concurrency: 50,
      timeoutMs: 30000,
      enableDeltaSync: true,
      playwrightFallback: true,
      maxRedirects: 10,
      ...options,
    };
  }

  /**
   * Fetch a single page using TieredFetcher.
   * Returns HybridCrawler-compatible result.
   */
  async fetchPage(url: string): Promise<HybridCrawlResult> {
    const fetchOptions: FetchOptions = {
      timeoutMs: this.options.timeoutMs,
      headers: this.options.userAgent
        ? { "User-Agent": this.options.userAgent }
        : undefined,
    };

    const result = await tieredFetcher.fetch(url, fetchOptions);

    return this.convertToHybridResult(result);
  }

  /**
   * Batch fetch multiple URLs.
   * Returns Map of URL -> HybridCrawlResult.
   */
  async fetchBatch(
    urls: string[],
    onProgress?: (progress: { crawled: number; total: number; currentUrl: string }) => void
  ): Promise<Map<string, HybridCrawlResult>> {
    const results = await tieredFetcher.fetchBatch(urls, {
      concurrency: this.options.concurrency,
      timeoutMs: this.options.timeoutMs,
    });

    const converted = new Map<string, HybridCrawlResult>();
    let crawled = 0;

    for (const [url, result] of results) {
      converted.set(url, this.convertToHybridResult(result));
      crawled++;
      onProgress?.({ crawled, total: urls.length, currentUrl: url });
    }

    return converted;
  }

  /**
   * Convert TieredFetcher result to HybridCrawler format.
   */
  private convertToHybridResult(result: FetchResult): HybridCrawlResult {
    return {
      url: result.url,
      html: result.html ?? "",
      statusCode: result.statusCode,
      fetchMethod: this.mapTierToMethod(result.tierUsed),
      changeType: "add", // Delta sync not yet integrated
      fetchTimeMs: result.responseTimeMs,
    };
  }

  /**
   * Map tier to fetch method for backward compatibility.
   */
  private mapTierToMethod(tier: ScrapeTier): "http" | "playwright" | "tiered" {
    switch (tier) {
      case "direct":
      case "webshare":
      case "geonode":
        return "http";
      case "camoufox":
      case "dfs_browser":
        return "playwright";
      default:
        return "tiered";
    }
  }
}

// =============================================================================
// Adapter: UniversalCrawler -> TieredFetcher
// =============================================================================

/**
 * Adapter that provides UniversalCrawler-compatible interface using TieredFetcher.
 *
 * Usage:
 * ```typescript
 * // Before:
 * import { UniversalCrawler } from "@/server/features/platform-oauth/crawler";
 * const crawler = new UniversalCrawler(options);
 * const result = await crawler.crawl(url);
 *
 * // After:
 * import { UniversalCrawlerAdapter } from "@/server/features/scraping/migration";
 * const crawler = new UniversalCrawlerAdapter(options);
 * const result = await crawler.crawl(url);
 * ```
 */
export class UniversalCrawlerAdapter {
  private options: UniversalCrawlOptions;

  constructor(options?: UniversalCrawlOptions) {
    this.options = {
      maxPages: 100,
      respectRobots: true,
      timeout: 30000,
      userAgent: "TeveroSEO-Bot/1.0 (+https://tevero.io/bot)",
      provider: "auto",
      ...options,
    };
  }

  /**
   * Crawl a URL using TieredFetcher.
   * Returns UniversalCrawler-compatible result.
   */
  async crawl(url: string): Promise<UniversalCrawlResult> {
    const fetchOptions: FetchOptions = {
      timeoutMs: this.options.timeout,
      headers: this.options.userAgent
        ? { "User-Agent": this.options.userAgent }
        : undefined,
      forceTier: this.mapProviderToTier(this.options.provider),
    };

    try {
      const result = await tieredFetcher.fetch(url, fetchOptions);

      if (!result.success) {
        return {
          status: this.mapErrorToStatus(result),
          error: result.error,
          reason: result.error,
        };
      }

      // Extract page data from HTML
      const data = result.html ? this.extractPageData(result.html, url) : undefined;

      return {
        status: "success",
        method: this.mapTierToMethod(result.tierUsed),
        data,
      };
    } catch (error) {
      return {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Map provider option to tier for forced tier selection.
   */
  private mapProviderToTier(provider?: string): ScrapeTier | undefined {
    switch (provider) {
      case "direct":
        return "direct";
      case "dataforseo":
        return "dfs_basic";
      case "playwright":
        return "camoufox"; // Use Camoufox instead of raw Playwright
      default:
        return undefined; // Let TieredFetcher decide
    }
  }

  /**
   * Map tier to method for backward compatibility.
   */
  private mapTierToMethod(tier: ScrapeTier): "fetch" | "dataforseo" | "playwright" | "tiered" {
    switch (tier) {
      case "direct":
      case "webshare":
      case "geonode":
        return "fetch";
      case "dfs_basic":
      case "dfs_js":
      case "dfs_browser":
        return "dataforseo";
      case "camoufox":
        return "playwright";
      default:
        return "tiered";
    }
  }

  /**
   * Map error result to status.
   */
  private mapErrorToStatus(result: FetchResult): "blocked" | "error" | "requires_upgrade" {
    if (result.statusCode === 403 || result.statusCode === 429) {
      return "blocked";
    }
    if (result.quality && !result.quality.acceptable) {
      return "requires_upgrade";
    }
    return "error";
  }

  /**
   * Extract page data from HTML.
   * Simplified version of UniversalCrawler.extractPageData.
   */
  private extractPageData(html: string, url: string): PageData {
    const getMatch = (regex: RegExp): string | null => {
      const match = html.match(regex);
      return match?.[1]?.trim() ?? null;
    };

    const getAllMatches = (regex: RegExp): string[] => {
      const matches: string[] = [];
      let match;
      const clonedRegex = new RegExp(regex.source, regex.flags);
      while ((match = clonedRegex.exec(html)) !== null) {
        if (match[1]) {
          matches.push(match[1].trim());
        }
      }
      return matches;
    };

    const origin = new URL(url).origin;
    const linkRegex = /href=["']([^"']+)["']/gi;
    const internalLinks: string[] = [];
    let linkMatch;
    while ((linkMatch = linkRegex.exec(html)) !== null) {
      const href = linkMatch[1];
      if (href.startsWith("/") || href.startsWith(origin)) {
        internalLinks.push(href);
      }
    }

    return {
      title: getMatch(/<title[^>]*>([^<]+)<\/title>/i) ?? "",
      metaDescription:
        getMatch(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ??
        getMatch(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i),
      h1: getAllMatches(/<h1[^>]*>([^<]+)<\/h1>/gi),
      h2: getAllMatches(/<h2[^>]*>([^<]+)<\/h2>/gi),
      canonicalUrl:
        getMatch(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ??
        getMatch(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i),
      ogTitle:
        getMatch(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ??
        getMatch(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i),
      ogDescription:
        getMatch(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ??
        getMatch(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i),
      internalLinks,
    };
  }

  /**
   * Close method for compatibility (no-op for TieredFetcher).
   */
  async close(): Promise<void> {
    // TieredFetcher manages its own resources
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Drop-in replacement for HybridCrawler.fetchPage.
 */
export async function fetchPageWithTiered(
  url: string,
  options?: HybridCrawlOptions
): Promise<HybridCrawlResult> {
  const adapter = new TieredCrawlerAdapter(options);
  return adapter.fetchPage(url);
}

/**
 * Drop-in replacement for UniversalCrawler.crawl.
 */
export async function crawlUrlWithTiered(
  url: string,
  options?: UniversalCrawlOptions
): Promise<UniversalCrawlResult> {
  const adapter = new UniversalCrawlerAdapter(options);
  return adapter.crawl(url);
}
