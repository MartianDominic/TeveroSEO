/**
 * UniversalCrawler
 *
 * World-class tiered crawl strategy - NOT Playwright auto-fallback.
 * Per infra research (docs/infra-research/crawling-10-5000-tasks-day.md):
 * - Priority 1: OAuth connection (handled elsewhere)
 * - Priority 2: DataForSEO OnPage API ($0.001/page with browser rendering)
 * - Priority 3: Direct fetch (aiohttp+selectolax pattern, unprotected sites only)
 * - Priority 4: Error with guidance (NOT silent Playwright burn)
 *
 * Playwright is OPT-IN only via explicit flag, never automatic.
 * This ensures scalability to thousands of users.
 *
 * MIG-2: Integrated with MigrationRouter for gradual migration to unified scraping.
 */

import { RobotsTxtParser } from "./RobotsTxtParser";
import { SitemapParser } from "@/server/lib/sitemap";
import { SPADetector } from "./SPADetector";
import {
  loadMigrationFlagsCached,
  shouldUseUnified,
} from "@/server/features/scraping/config";
import { routeRequest } from "@/server/features/scraping/migration/adapters";
import type { ScrapeResult, ScrapeOptions } from "@/server/features/scraping/ScrapingService";
import { db } from "@/db";
import { getDfsCostTracker, extractDomainFromUrl } from "@/server/features/scraping/providers/DfsCostTracker";
import { DFS_LIVE_COSTS } from "@/server/features/scraping/cost";
import { costLogger } from "@/server/features/scraping/logging/Logger";

export interface CrawlOptions {
  /** Maximum pages to crawl (default: 100) */
  maxPages?: number;
  /** Respect robots.txt (default: true) */
  respectRobots?: boolean;
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** User agent string */
  userAgent?: string;
  /**
   * Crawl provider to use:
   * - 'auto': Direct fetch for static, DataForSEO for JS-heavy (default)
   * - 'direct': Force direct fetch (fails on SPAs)
   * - 'dataforseo': Force DataForSEO OnPage API
   * - 'playwright': Explicit opt-in for local Playwright (NOT recommended at scale)
   */
  provider?: "auto" | "direct" | "dataforseo" | "playwright";
  /**
   * DataForSEO configuration (required if provider includes dataforseo)
   */
  dataForSeo?: {
    login: string;
    password: string;
    enableBrowserRendering?: boolean;
  };
  /** MIG-2: Client ID for cost attribution */
  clientId?: string;
  /** MIG-2: Job ID for cost attribution */
  jobId?: string;
  /** MIG-2: Force legacy path (skip MigrationRouter) */
  forceLegacy?: boolean;
}

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

export interface CrawlResult {
  status: "success" | "blocked" | "error" | "requires_upgrade";
  method?: "fetch" | "dataforseo" | "playwright";
  data?: PageData;
  sitemapUrls?: string[];
  reason?: string;
  error?: string;
  /** Guidance when requires_upgrade */
  guidance?: string;
}

const DEFAULT_OPTIONS = {
  maxPages: 100,
  respectRobots: true,
  timeout: 30000,
  userAgent: "TeveroSEO-Bot/1.0 (+https://tevero.io/bot)",
  provider: "auto" as const,
  dataForSeo: undefined as CrawlOptions["dataForSeo"],
};

/**
 * Error thrown when crawl requires JS rendering but no provider is available.
 * This is intentional - we error instead of burning resources.
 */
export class CrawlRequiresUpgradeError extends Error {
  constructor(
    public readonly url: string,
    public readonly reason: string
  ) {
    super(
      `Crawl requires JS rendering: ${reason}. Connect via OAuth for best results, ` +
        `or configure DataForSEO OnPage API for premium crawling.`
    );
    this.name = "CrawlRequiresUpgradeError";
  }
}

export class UniversalCrawler {
  private options: {
    maxPages: number;
    respectRobots: boolean;
    timeout: number;
    userAgent: string;
    provider: "auto" | "direct" | "dataforseo" | "playwright";
    dataForSeo?: CrawlOptions["dataForSeo"];
  };
  private browser: unknown = null; // Only used if playwright explicitly requested

  constructor(options?: CrawlOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Crawl a URL with tiered provider selection.
   *
   * Strategy:
   * 1. MIG-2: Check feature flag and route through MigrationRouter if enabled
   * 2. Check robots.txt
   * 3. Detect if JS rendering needed
   * 4. Route to appropriate provider (NOT auto-Playwright)
   */
  async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
    const opts = { ...this.options, ...options };

    // MIG-2: Check if we should route through unified scraping
    if (!opts.forceLegacy) {
      const flags = loadMigrationFlagsCached();
      const crawlWorkflowState = flags.crawlWorkflow;

      if (shouldUseUnified(crawlWorkflowState)) {
        return this.crawlViaUnified(url, opts);
      }
    }

    // Legacy path
    return this.crawlLegacy(url, opts);
  }

  /**
   * MIG-2: Route crawl through unified ScrapingService via MigrationRouter.
   */
  private async crawlViaUnified(
    url: string,
    opts: typeof this.options & CrawlOptions
  ): Promise<CrawlResult> {
    const headers: Record<string, string> = {};
    if (opts.userAgent) {
      headers["User-Agent"] = opts.userAgent;
    }

    const scrapeOptions: ScrapeOptions = {
      timeoutMs: opts.timeout ?? 30000,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      clientId: opts.clientId,
      jobId: opts.jobId,
      feature: "crawlWorkflow",
      includeHtml: true,
      includeParsedData: true,
    };

    try {
      const result = await routeRequest<CrawlResult>({
        feature: "crawlWorkflow",
        url,
        legacyFn: () => this.crawlLegacy(url, opts),
        scrapeOptions,
        transformer: {
          legacyToNew: (legacy: CrawlResult): ScrapeResult => this.crawlResultToScrapeResult(legacy, url),
          newToLegacy: (scrapeResult: ScrapeResult): CrawlResult => this.scrapeResultToCrawlResult(scrapeResult),
        },
      });

      return result;
    } catch (error) {
      // On routing error, fall back to legacy
      console.warn(
        `[UniversalCrawler] MigrationRouter error, falling back to legacy:`,
        error instanceof Error ? error.message : String(error)
      );
      return this.crawlLegacy(url, opts);
    }
  }

  /**
   * Convert CrawlResult to ScrapeResult for unified system.
   */
  private crawlResultToScrapeResult(result: CrawlResult, url: string): ScrapeResult {
    return {
      url,
      success: result.status === "success",
      statusCode: result.status === "success" ? 200 : result.status === "blocked" ? 403 : 500,
      tierUsed: result.method === "dataforseo" ? "dfs_basic" : result.method === "playwright" ? "camoufox" : "direct",
      fromCache: false,
      responseTimeMs: 0,
      responseSizeBytes: 0,
      estimatedCostUsd: 0,
      error: result.error,
      parsedData: result.data ? {
        title: result.data.title,
        metaDescription: result.data.metaDescription ?? undefined,
        h1: result.data.h1,
        h2: result.data.h2,
        canonical: result.data.canonicalUrl ?? undefined,
        internalLinks: result.data.internalLinks.map(link => ({ url: link, text: "" })),
      } : undefined,
    };
  }

  /**
   * Convert ScrapeResult to CrawlResult for legacy compatibility.
   */
  private scrapeResultToCrawlResult(result: ScrapeResult): CrawlResult {
    if (!result.success) {
      if (result.statusCode === 403 || result.statusCode === 429) {
        return {
          status: "blocked",
          reason: result.error ?? "Access blocked",
          error: result.error,
        };
      }
      return {
        status: "error",
        error: result.error ?? "Unknown error",
      };
    }

    // Map tier to method
    let method: "fetch" | "dataforseo" | "playwright" = "fetch";
    if (result.tierUsed === "dfs_basic" || result.tierUsed === "dfs_js" || result.tierUsed === "dfs_browser") {
      method = "dataforseo";
    } else if (result.tierUsed === "camoufox") {
      method = "playwright";
    }

    // Extract page data
    const data: PageData = result.parsedData ? {
      title: result.parsedData.title ?? "",
      metaDescription: result.parsedData.metaDescription ?? null,
      h1: result.parsedData.h1 ?? [],
      h2: result.parsedData.h2 ?? [],
      canonicalUrl: result.parsedData.canonical ?? null,
      ogTitle: null,
      ogDescription: null,
      internalLinks: (result.parsedData.internalLinks ?? []).map(l => l.url),
    } : {
      title: "",
      metaDescription: null,
      h1: [],
      h2: [],
      canonicalUrl: null,
      ogTitle: null,
      ogDescription: null,
      internalLinks: [],
    };

    return {
      status: "success",
      method,
      data,
    };
  }

  /**
   * Legacy crawl implementation (original behavior).
   */
  private async crawlLegacy(
    url: string,
    opts: typeof this.options & CrawlOptions
  ): Promise<CrawlResult> {
    try {
      const parsedUrl = new URL(url);
      const path = parsedUrl.pathname;

      // Step 1: Check robots.txt (D-16)
      if (opts.respectRobots) {
        const robots = await RobotsTxtParser.fetch(parsedUrl.origin);
        if (robots && !RobotsTxtParser.isAllowed(robots, path, opts.userAgent)) {
          return {
            status: "blocked",
            reason: "robots.txt disallows crawling this path",
          };
        }
      }

      // Step 2: Try sitemap discovery (D-17)
      const sitemapUrl = await SitemapParser.findSitemap(parsedUrl.origin);
      let sitemapUrls: string[] | undefined;
      if (sitemapUrl) {
        const urls = await SitemapParser.parseRecursive(sitemapUrl);
        sitemapUrls = urls.map((u) => u.loc).slice(0, opts.maxPages);
      }

      // Step 3: Detect if JS rendering needed (D-18)
      const detection = await SPADetector.checkUrl(url);
      const needsJs = detection.needsJs;

      // Step 4: Route to provider based on strategy
      return await this.routeToProvider(url, opts, needsJs, sitemapUrls);
    } catch (error) {
      if (error instanceof CrawlRequiresUpgradeError) {
        return {
          status: "requires_upgrade",
          reason: error.reason,
          guidance: error.message,
        };
      }
      return {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Route crawl to appropriate provider based on options and requirements.
   * This is the key architectural decision point.
   */
  private async routeToProvider(
    url: string,
    opts: typeof this.options,
    needsJs: boolean,
    sitemapUrls?: string[]
  ): Promise<CrawlResult> {
    const provider = opts.provider ?? "auto";

    // Explicit provider selection
    if (provider === "dataforseo") {
      return this.crawlWithDataForSeo(url, opts, sitemapUrls);
    }

    if (provider === "playwright") {
      // Explicit opt-in only - NOT automatic
      return this.crawlWithPlaywright(url, opts, sitemapUrls);
    }

    if (provider === "direct") {
      if (needsJs) {
        // Direct fetch requested but page needs JS - error, don't silently fail
        throw new CrawlRequiresUpgradeError(
          url,
          "Page requires JavaScript rendering but 'direct' provider was specified"
        );
      }
      return this.crawlWithFetch(url, opts, sitemapUrls);
    }

    // Auto mode: intelligent routing
    if (!needsJs) {
      // Static page - use direct fetch (cheapest)
      return this.crawlWithFetch(url, opts, sitemapUrls);
    }

    // Page needs JS rendering - check if DataForSEO is configured
    if (opts.dataForSeo?.login && opts.dataForSeo?.password) {
      return this.crawlWithDataForSeo(url, opts, sitemapUrls);
    }

    // No provider for JS rendering - ERROR instead of burning resources
    // This is intentional! Per infra research, we should not auto-fall to Playwright.
    throw new CrawlRequiresUpgradeError(
      url,
      `SPA detected (${await this.getSpaFramework(url)}). ` +
        `Options: 1) Connect via OAuth 2) Configure DataForSEO OnPage API 3) Use direct fetch with manual JS handling`
    );
  }

  private async getSpaFramework(url: string): Promise<string> {
    const detection = await SPADetector.checkUrl(url);
    return detection.detection.framework ?? "unknown framework";
  }

  /**
   * Crawl with direct fetch - for static/SSR pages only.
   * Cost: ~$0.02/1k pages (just bandwidth)
   */
  private async crawlWithFetch(
    url: string,
    opts: typeof this.options,
    sitemapUrls?: string[]
  ): Promise<CrawlResult> {
    const response = await fetch(url, {
      headers: {
        "User-Agent": opts.userAgent,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "lt-LT,lt;q=0.9,en;q=0.8", // Lithuanian priority
      },
      signal: AbortSignal.timeout(opts.timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const data = this.extractPageData(html, url);

    return {
      status: "success",
      method: "fetch",
      data,
      sitemapUrls,
    };
  }

  /**
   * Crawl with DataForSEO OnPage API - handles JS rendering at $0.001/page.
   * This is the recommended path for JS-heavy sites at scale.
   */
  private async crawlWithDataForSeo(
    url: string,
    opts: typeof this.options & CrawlOptions,
    sitemapUrls?: string[]
  ): Promise<CrawlResult> {
    if (!opts.dataForSeo?.login || !opts.dataForSeo?.password) {
      throw new Error(
        "DataForSEO credentials required. Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD."
      );
    }

    const auth = Buffer.from(
      `${opts.dataForSeo.login}:${opts.dataForSeo.password}`
    ).toString("base64");

    // DataForSEO OnPage API - single page fetch
    const response = await fetch(
      "https://api.dataforseo.com/v3/on_page/instant_pages",
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          {
            url,
            enable_browser_rendering: opts.dataForSeo.enableBrowserRendering ?? true,
            enable_javascript: true,
            custom_user_agent: opts.userAgent,
          },
        ]),
        signal: AbortSignal.timeout(opts.timeout),
      }
    );

    if (!response.ok) {
      throw new Error(`DataForSEO API error: ${response.status}`);
    }

    const result = await response.json() as {
      tasks?: Array<{
        status_code?: number;
        status_message?: string;
        result?: Array<{
          items?: Array<{
            meta?: any;
            onpage_score?: any;
            page_timing?: any;
            links?: {
              internal?: Array<{ url: string }>;
            };
          }>;
        }>;
      }>;
    };
    const task = result.tasks?.[0];

    if (task?.status_code !== 20000 || !task?.result?.[0]?.items?.[0]) {
      throw new Error(
        `DataForSEO crawl failed: ${task?.status_message ?? "Unknown error"}`
      );
    }

    const item = task.result[0].items[0];
    const meta = item.meta ?? {};
    // Note: onpage_score is available in item.onpage_score but not used yet

    // Track DataForSEO cost (fire-and-forget pattern)
    // Browser rendering is enabled by default, so use browser tier cost
    const useBrowserRendering = opts.dataForSeo?.enableBrowserRendering ?? true;
    const mode = useBrowserRendering ? "browser" : "basic";
    const estimatedCost = DFS_LIVE_COSTS[mode as keyof typeof DFS_LIVE_COSTS];

    this.recordDfsCostFireAndForget({
      url,
      mode: mode as "basic" | "js" | "browser",
      success: true,
      estimatedCost,
      clientId: opts.clientId,
      jobId: opts.jobId,
    });

    // Map DataForSEO response to our PageData format
    const data: PageData = {
      title: meta.title ?? "",
      metaDescription: meta.description ?? null,
      h1: meta.h1 ? [meta.h1] : [],
      h2: meta.h2 ? [meta.h2] : [],
      canonicalUrl: meta.canonical ?? null,
      ogTitle: meta.open_graph?.title ?? null,
      ogDescription: meta.open_graph?.description ?? null,
      internalLinks: (item.links?.internal ?? []).map(
        (l: { url: string }) => l.url
      ),
    };

    return {
      status: "success",
      method: "dataforseo",
      data,
      sitemapUrls,
    };
  }

  /**
   * Record DataForSEO cost (fire-and-forget pattern).
   * Does not block crawl completion - errors are logged but don't fail the request.
   */
  private recordDfsCostFireAndForget(record: {
    url: string;
    mode: "basic" | "js" | "browser";
    success: boolean;
    estimatedCost: number;
    statusCode?: number;
    errorMessage?: string;
    clientId?: string;
    jobId?: string;
  }): void {
    // Fire and forget - don't await, don't block
    getDfsCostTracker(db)
      .recordCost({
        url: record.url,
        domain: extractDomainFromUrl(record.url),
        mode: record.mode,
        usedStandardQueue: false, // Live API via instant_pages
        estimatedCost: record.estimatedCost,
        success: record.success,
        statusCode: record.statusCode,
        errorMessage: record.errorMessage,
        clientId: record.clientId,
        jobId: record.jobId,
      })
      .catch((error) => {
        // Log error but don't fail the crawl
        costLogger.error(
          {
            url: record.url,
            mode: record.mode,
            error: error instanceof Error ? error.message : String(error),
          },
          "Failed to record DataForSEO cost in UniversalCrawler"
        );
      });
  }

  /**
   * Crawl with Playwright - EXPLICIT OPT-IN ONLY.
   *
   * WARNING: This is expensive (~$2-5/1k pages including memory/compute).
   * Only use when:
   * - Testing locally
   * - User explicitly requested it
   * - Volume is very low (<100 pages/day)
   *
   * At scale, use DataForSEO OnPage instead.
   */
  private async crawlWithPlaywright(
    url: string,
    opts: typeof this.options,
    sitemapUrls?: string[]
  ): Promise<CrawlResult> {
    console.warn(
      `[UniversalCrawler] Using Playwright for ${url}. ` +
        `This is expensive at scale - consider DataForSEO OnPage for production.`
    );

    const browser = await this.getBrowser();
    const page = await (browser as any).newPage();

    try {
      await page.setUserAgent(opts.userAgent);
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: opts.timeout,
      });

      await page
        .waitForSelector("h1, article, main", { timeout: 10000 })
        .catch(() => {});

      const data = await page.evaluate(() => {
        const getAttr = (sel: string, attr: string): string | null => {
          const el = document.querySelector(sel);
          return el?.getAttribute(attr) ?? null;
        };

        const getAll = (sel: string): string[] => {
          return Array.from(document.querySelectorAll(sel))
            .map((el) => el.textContent?.trim() ?? "")
            .filter(Boolean);
        };

        const origin = window.location.origin;
        const internalLinks = Array.from(
          document.querySelectorAll(`a[href^="/"], a[href^="${origin}"]`)
        )
          .map((a) => a.getAttribute("href"))
          .filter((href): href is string => href !== null);

        return {
          title: document.title || "",
          metaDescription: getAttr('meta[name="description"]', "content"),
          h1: getAll("h1"),
          h2: getAll("h2"),
          canonicalUrl: getAttr('link[rel="canonical"]', "href"),
          ogTitle: getAttr('meta[property="og:title"]', "content"),
          ogDescription: getAttr('meta[property="og:description"]', "content"),
          internalLinks,
        };
      });

      return {
        status: "success",
        method: "playwright",
        data,
        sitemapUrls,
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Extract page data from HTML using regex (for direct fetch).
   */
  extractPageData(html: string, url: string): PageData {
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
      title: getMatch(/<title[^>]*>([^<]+)<\/title>/i) || "",
      metaDescription:
        getMatch(
          /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
        ) ??
        getMatch(
          /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i
        ),
      h1: getAllMatches(/<h1[^>]*>([^<]+)<\/h1>/gi),
      h2: getAllMatches(/<h2[^>]*>([^<]+)<\/h2>/gi),
      canonicalUrl:
        getMatch(
          /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i
        ) ??
        getMatch(
          /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i
        ),
      ogTitle:
        getMatch(
          /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
        ) ??
        getMatch(
          /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i
        ),
      ogDescription:
        getMatch(
          /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i
        ) ??
        getMatch(
          /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i
        ),
      internalLinks,
    };
  }

  private async getBrowser(): Promise<unknown> {
    if (this.browser) {
      return this.browser;
    }

    try {
      // @ts-ignore - playwright is an optional dependency
      const playwright = await import("playwright");
      this.browser = await playwright.chromium.launch({ headless: true });
      return this.browser;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Cannot find module") || message.includes("playwright")) {
        throw new Error(
          "Playwright not installed. For production, use DataForSEO OnPage instead. " +
            "For local testing: pnpm add -D playwright"
        );
      }
      throw error;
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await (this.browser as any).close();
      this.browser = null;
    }
  }
}

/**
 * Convenience function for one-shot crawl.
 *
 * Note: For JS-heavy sites, either:
 * 1. Configure dataForSeo credentials, or
 * 2. Explicitly set provider: 'playwright' (not recommended at scale)
 */
export async function crawlUrl(
  url: string,
  options?: CrawlOptions
): Promise<CrawlResult> {
  const crawler = new UniversalCrawler(options);
  try {
    return await crawler.crawl(url);
  } finally {
    await crawler.close();
  }
}
