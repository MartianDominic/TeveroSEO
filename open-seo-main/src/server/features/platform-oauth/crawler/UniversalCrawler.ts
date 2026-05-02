/**
 * UniversalCrawler
 *
 * Intelligent crawler with fetch-first, Playwright-fallback pattern.
 * Per D-16 through D-19:
 * - D-16: Check robots.txt before crawling
 * - D-17: Sitemap discovery in 5 common locations
 * - D-18: SPA detection via framework indicators
 * - D-19: Playwright headless chromium for JS-rendered sites
 */

import { RobotsTxtParser, type RobotsTxt } from "./RobotsTxtParser";
import { SitemapParser, type SitemapUrl } from "./SitemapParser";
import { SPADetector, type SPADetectionResult } from "./SPADetector";

export interface CrawlOptions {
  /** Maximum pages to crawl (default: 100) */
  maxPages?: number;
  /** Respect robots.txt (default: true) */
  respectRobots?: boolean;
  /** JS rendering mode: true=always, false=never, 'auto'=detect (default: 'auto') */
  renderJs?: boolean | "auto";
  /** Request timeout in ms (default: 30000) */
  timeout?: number;
  /** User agent string */
  userAgent?: string;
}

export interface PageData {
  /** Page title */
  title: string;
  /** Meta description */
  metaDescription: string | null;
  /** H1 headings */
  h1: string[];
  /** H2 headings */
  h2: string[];
  /** Canonical URL */
  canonicalUrl: string | null;
  /** Open Graph title */
  ogTitle: string | null;
  /** Open Graph description */
  ogDescription: string | null;
  /** Internal links on the page */
  internalLinks: string[];
}

export interface CrawlResult {
  /** Crawl status */
  status: "success" | "blocked" | "error";
  /** Crawl method used */
  method?: "fetch" | "playwright";
  /** Extracted page data */
  data?: PageData;
  /** URLs found in sitemap */
  sitemapUrls?: string[];
  /** Reason for blocked/error status */
  reason?: string;
  /** Error message */
  error?: string;
}

const DEFAULT_OPTIONS: Required<CrawlOptions> = {
  maxPages: 100,
  respectRobots: true,
  renderJs: "auto",
  timeout: 30000,
  userAgent: "TeveroSEO-Bot/1.0 (+https://tevero.io/bot)",
};

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
  setUserAgent(userAgent: string): Promise<void>;
  goto(
    url: string,
    options: { waitUntil: string; timeout: number }
  ): Promise<PlaywrightResponse | null>;
  waitForSelector(
    selector: string,
    options: { timeout: number }
  ): Promise<unknown>;
  evaluate<T>(fn: () => T): Promise<T>;
  content(): Promise<string>;
}

interface PlaywrightResponse {
  status(): number;
}

export class UniversalCrawler {
  private options: Required<CrawlOptions>;
  private browser: PlaywrightBrowser | null = null;

  constructor(options?: CrawlOptions) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Crawl a URL with intelligent method selection.
   *
   * @param url - URL to crawl
   * @param options - Override crawl options
   * @returns Crawl result with page data or error
   */
  async crawl(url: string, options?: CrawlOptions): Promise<CrawlResult> {
    const opts = { ...this.options, ...options };

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
        sitemapUrls = urls
          .map((u) => u.loc)
          .slice(0, opts.maxPages);
      }

      // Step 3: Detect if JS rendering needed (D-18)
      let needsJs = false;
      if (opts.renderJs === true) {
        needsJs = true;
      } else if (opts.renderJs === "auto") {
        const detection = await SPADetector.checkUrl(url);
        needsJs = detection.needsJs;
      }

      // Step 4: Crawl with appropriate method (D-19)
      let data: PageData;
      let method: "fetch" | "playwright";

      if (needsJs) {
        data = await this.crawlWithPlaywright(url, opts);
        method = "playwright";
      } else {
        data = await this.crawlWithFetch(url, opts);
        method = "fetch";
      }

      return {
        status: "success",
        method,
        data,
        sitemapUrls,
      };
    } catch (error) {
      return {
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Crawl URL with simple fetch (for static pages).
   */
  async crawlWithFetch(url: string, opts: Required<CrawlOptions>): Promise<PageData> {
    const response = await fetch(url, {
      headers: {
        "User-Agent": opts.userAgent,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(opts.timeout),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    return this.extractPageData(html, url);
  }

  /**
   * Crawl URL with Playwright for JS-heavy pages (D-19).
   */
  async crawlWithPlaywright(
    url: string,
    opts: Required<CrawlOptions>
  ): Promise<PageData> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setUserAgent(opts.userAgent);
      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: opts.timeout,
      });

      // Wait for content to render
      await page
        .waitForSelector("h1, article, main", { timeout: 10000 })
        .catch(() => {
          // Content selector not found, continue anyway
        });

      // Extract data using page.evaluate
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

      return data;
    } finally {
      // Don't close browser, reuse for subsequent pages
    }
  }

  /**
   * Extract page data from HTML using regex.
   */
  extractPageData(html: string, url: string): PageData {
    const getMatch = (regex: RegExp): string | null => {
      const match = html.match(regex);
      return match?.[1]?.trim() ?? null;
    };

    const getAllMatches = (regex: RegExp): string[] => {
      const matches: string[] = [];
      let match;
      while ((match = regex.exec(html)) !== null) {
        if (match[1]) {
          matches.push(match[1].trim());
        }
      }
      return matches;
    };

    // Parse URL origin for internal link detection
    const origin = new URL(url).origin;

    // Extract internal links
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
      metaDescription: getMatch(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
      ) ?? getMatch(
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i
      ),
      h1: getAllMatches(/<h1[^>]*>([^<]+)<\/h1>/gi),
      h2: getAllMatches(/<h2[^>]*>([^<]+)<\/h2>/gi),
      canonicalUrl: getMatch(
        /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i
      ) ?? getMatch(
        /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i
      ),
      ogTitle: getMatch(
        /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i
      ) ?? getMatch(
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i
      ),
      ogDescription: getMatch(
        /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i
      ) ?? getMatch(
        /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i
      ),
      internalLinks,
    };
  }

  /**
   * Get or create Playwright browser instance.
   * Uses dynamic import to avoid loading Playwright unless needed.
   */
  private async getBrowser(): Promise<PlaywrightBrowser> {
    if (this.browser) {
      return this.browser;
    }

    try {
      // Dynamic import using import() instead of require()
      const playwright = (await import("playwright")) as PlaywrightModule;
      this.browser = await playwright.chromium.launch({ headless: true });
      return this.browser;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Cannot find module") && message.includes("playwright")) {
        throw new Error(
          "Playwright not installed. Install with: pnpm add -D playwright"
        );
      }
      throw error;
    }
  }

  /**
   * Close browser instance.
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

/**
 * Convenience function for one-shot crawl.
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
