/**
 * Unified SitemapParser
 *
 * Consolidated sitemap parsing utility that replaces duplicate implementations.
 * Supports: sitemap.xml, sitemap index, gzipped sitemaps
 *
 * Gap: P2.G15 - Duplicate sitemap parsers unified
 */

import { XMLParser } from "fast-xml-parser";
import { createLogger } from "@/server/lib/logger";
import { gunzipSync } from "zlib";

const log = createLogger({ module: "sitemap-parser" });

// Configuration constants
const DEFAULT_USER_AGENT = "TeveroSEO-Bot/1.0 (+https://tevero.io/bot)";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_URLS = 50_000;
const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_MAX_CHILD_SITEMAPS = 300;
const SITEMAP_CONCURRENCY = 5;

/**
 * Common sitemap locations to check per D-17.
 */
export const SITEMAP_LOCATIONS = [
  "/sitemap.xml",
  "/sitemap_index.xml",
  "/sitemap/sitemap.xml",
  "/wp-sitemap.xml",
  "/sitemap/index.xml",
] as const;

/**
 * Sitemap URL entry with metadata.
 */
export interface SitemapUrl {
  loc: string;
  lastmod: Date | null;
  changefreq: string | null;
  priority: number | null;
}

/**
 * Result from parsing a single sitemap document.
 */
export interface SitemapParseResult {
  urls: SitemapUrl[];
  childSitemaps: string[];
  isIndex: boolean;
  parseTimeMs?: number;
}

/**
 * Options for sitemap parsing operations.
 */
export interface SitemapParseOptions {
  /** User agent for requests (default: TeveroSEO-Bot) */
  userAgent?: string;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
  /** Maximum URLs to extract (default: 50000) */
  maxUrls?: number;
  /** Maximum recursion depth for sitemap indexes (default: 2) */
  maxDepth?: number;
  /** Maximum child sitemaps to process (default: 300) */
  maxChildSitemaps?: number;
  /** Enable concurrent fetching (default: true) */
  concurrent?: boolean;
}

/**
 * Sitemap fetch statistics for reporting.
 */
export interface SitemapFetchStats {
  fetched: number;
  failed: number;
  timedOut: number;
  discoveredUrls: number;
  truncated: boolean;
}

// XML parser instance with consistent configuration
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  isArray: (name) => name === "sitemap" || name === "url",
});

/**
 * Unified SitemapParser class.
 *
 * Provides static methods for sitemap discovery, parsing, and recursive fetching.
 */
export class SitemapParser {
  /**
   * Find sitemap URL by checking common locations and robots.txt.
   *
   * @param baseUrl - Base URL of the site
   * @param options - Parse options
   * @returns Sitemap URL or null if not found
   */
  static async findSitemap(
    baseUrl: string,
    options: SitemapParseOptions = {}
  ): Promise<string | null> {
    const { userAgent = DEFAULT_USER_AGENT, timeoutMs = 5000 } = options;
    const base = new URL(baseUrl).origin;

    // Check common locations first per D-17
    for (const path of SITEMAP_LOCATIONS) {
      try {
        const url = `${base}${path}`;
        const response = await fetch(url, {
          method: "HEAD",
          headers: { "User-Agent": userAgent },
          signal: AbortSignal.timeout(timeoutMs),
        });

        if (
          response.ok &&
          (response.headers.get("content-type")?.includes("xml") ||
            response.headers.get("content-type")?.includes("gzip"))
        ) {
          return url;
        }
      } catch {
        // Continue to next location
      }
    }

    // Check robots.txt for Sitemap directive
    try {
      const robotsResponse = await fetch(`${base}/robots.txt`, {
        headers: { "User-Agent": userAgent },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (robotsResponse.ok) {
        const robotsText = await robotsResponse.text();
        const sitemapMatch = robotsText.match(/^Sitemap:\s*(.+)$/im);
        if (sitemapMatch) {
          return sitemapMatch[1].trim();
        }
      }
    } catch {
      // robots.txt not available
    }

    return null;
  }

  /**
   * Parse a sitemap from URL (handles gzipped sitemaps).
   *
   * @param sitemapUrl - URL of the sitemap to parse
   * @param options - Parse options
   * @returns Parsed sitemap with URLs or child sitemap references
   */
  static async parse(
    sitemapUrl: string,
    options: SitemapParseOptions = {}
  ): Promise<SitemapParseResult> {
    const {
      userAgent = DEFAULT_USER_AGENT,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      maxUrls = DEFAULT_MAX_URLS,
    } = options;

    const startTime = Date.now();

    try {
      const response = await fetch(sitemapUrl, {
        headers: {
          "User-Agent": userAgent,
          Accept: "application/xml, text/xml, application/gzip",
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        return { urls: [], childSitemaps: [], isIndex: false };
      }

      let xml: string;
      const contentType = response.headers.get("content-type") || "";
      const isGzipped =
        contentType.includes("gzip") || sitemapUrl.endsWith(".gz");

      if (isGzipped) {
        const buffer = await response.arrayBuffer();
        try {
          xml = gunzipSync(Buffer.from(buffer)).toString("utf-8");
        } catch {
          log.warn(`Failed to decompress gzipped sitemap: ${sitemapUrl}`);
          return { urls: [], childSitemaps: [], isIndex: false };
        }
      } else {
        xml = await response.text();
      }

      const result = this.parseXml(xml, maxUrls);
      result.parseTimeMs = Date.now() - startTime;
      return result;
    } catch (error) {
      log.warn(
        `Failed to fetch sitemap: ${sitemapUrl}`,
        error instanceof Error ? { error: error.message } : { error: String(error) }
      );
      return { urls: [], childSitemaps: [], isIndex: false };
    }
  }

  /**
   * Parse sitemap XML content directly.
   *
   * @param xml - Raw XML content
   * @param maxUrls - Maximum URLs to extract
   * @returns Parsed sitemap result
   */
  static parseXml(xml: string, maxUrls: number = DEFAULT_MAX_URLS): SitemapParseResult {
    try {
      const parsed = xmlParser.parse(xml);

      // Check if this is a sitemap index
      if (parsed.sitemapindex) {
        const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
          ? parsed.sitemapindex.sitemap
          : parsed.sitemapindex.sitemap
            ? [parsed.sitemapindex.sitemap]
            : [];

        const childSitemaps = sitemaps
          .filter(
            (s: unknown): s is { loc: string } =>
              s != null && typeof s === "object" && "loc" in s
          )
          .map((s: { loc: string }) => String(s.loc));

        return {
          urls: [],
          childSitemaps,
          isIndex: true,
        };
      }

      // Regular sitemap
      if (!parsed.urlset?.url) {
        return { urls: [], childSitemaps: [], isIndex: false };
      }

      const urlEntries = Array.isArray(parsed.urlset.url)
        ? parsed.urlset.url
        : [parsed.urlset.url];

      // Limit URLs to prevent memory issues
      const limitedEntries = urlEntries.slice(0, maxUrls);

      const urls: SitemapUrl[] = limitedEntries
        .map((entry: Record<string, unknown>) => ({
          loc: String(entry.loc || ""),
          lastmod: this.parseLastmod(entry.lastmod),
          changefreq: entry.changefreq ? String(entry.changefreq) : null,
          priority: entry.priority ? Number(entry.priority) : null,
        }))
        .filter((u: SitemapUrl) => u.loc);

      return { urls, childSitemaps: [], isIndex: false };
    } catch {
      return { urls: [], childSitemaps: [], isIndex: false };
    }
  }

  /**
   * Parse lastmod value, handling various formats.
   * Per crawling doc Section 5: lastmod reliability varies by platform.
   */
  private static parseLastmod(value: unknown): Date | null {
    if (!value) return null;
    const str = String(value);

    // Handle Magento garbage timestamps
    if (str === "0000-00-00" || str.startsWith("0000")) {
      return null;
    }

    const parsed = new Date(str);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  /**
   * Recursively parse sitemap, following sitemap index references.
   * Limits processing to prevent DoS.
   *
   * @param sitemapUrl - URL of the sitemap to parse
   * @param options - Parse options
   * @returns All URLs from sitemap and its children with fetch stats
   */
  static async parseRecursive(
    sitemapUrl: string,
    options: SitemapParseOptions = {}
  ): Promise<SitemapUrl[]> {
    const result = await this.parseRecursiveWithStats(sitemapUrl, options);
    return result.urls;
  }

  /**
   * Recursively parse sitemap with detailed statistics.
   *
   * @param sitemapUrl - URL of the sitemap to parse
   * @param options - Parse options
   * @returns URLs and fetch statistics
   */
  static async parseRecursiveWithStats(
    sitemapUrl: string,
    options: SitemapParseOptions = {}
  ): Promise<{ urls: SitemapUrl[]; stats: SitemapFetchStats }> {
    const {
      maxUrls = DEFAULT_MAX_URLS,
      maxDepth = DEFAULT_MAX_DEPTH,
      maxChildSitemaps = DEFAULT_MAX_CHILD_SITEMAPS,
      concurrent = true,
    } = options;

    const visited = new Set<string>();
    const allUrls: SitemapUrl[] = [];
    let fetchedCount = 0;
    let failedCount = 0;
    let timedOutCount = 0;

    const processQueue = async (
      queue: Array<{ url: string; depth: number }>
    ): Promise<void> => {
      while (queue.length > 0 && allUrls.length < maxUrls) {
        if (fetchedCount >= maxChildSitemaps) {
          break;
        }

        const batchSize = concurrent ? SITEMAP_CONCURRENCY : 1;
        const batch = queue.splice(0, batchSize);

        const results = await Promise.all(
          batch.map(async ({ url, depth }) => {
            if (visited.has(url) || depth > maxDepth) {
              return { urls: [], childSitemaps: [] as string[], failed: false, timedOut: false };
            }
            visited.add(url);
            fetchedCount++;

            try {
              const result = await this.parse(url, options);
              return { ...result, failed: false, timedOut: false };
            } catch (error) {
              const isTimeout =
                error instanceof Error && error.name === "TimeoutError";
              return {
                urls: [],
                childSitemaps: [] as string[],
                failed: true,
                timedOut: isTimeout,
              };
            }
          })
        );

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const { depth } = batch[i];

          if (result.failed) {
            failedCount++;
            if (result.timedOut) {
              timedOutCount++;
            }
            continue;
          }

          // Add URLs respecting limit
          for (const url of result.urls) {
            if (allUrls.length >= maxUrls) break;
            allUrls.push(url);
          }

          // Queue child sitemaps if not at max depth
          if (depth < maxDepth) {
            for (const childUrl of result.childSitemaps) {
              if (!visited.has(childUrl) && fetchedCount < maxChildSitemaps) {
                queue.push({ url: childUrl, depth: depth + 1 });
              }
            }
          }
        }
      }
    };

    await processQueue([{ url: sitemapUrl, depth: 0 }]);

    return {
      urls: allUrls,
      stats: {
        fetched: fetchedCount,
        failed: failedCount,
        timedOut: timedOutCount,
        discoveredUrls: allUrls.length,
        truncated: allUrls.length >= maxUrls,
      },
    };
  }

  /**
   * Fetch and parse sitemap, returning URLs (compatibility method).
   *
   * @param sitemapUrl - URL of the sitemap
   * @returns Flat list of URLs
   */
  static async fetchAndParse(
    sitemapUrl: string,
    options: SitemapParseOptions = {}
  ): Promise<SitemapUrl[]> {
    return this.parseRecursive(sitemapUrl, options);
  }
}

// ============================================================================
// Functional API (backward compatibility with sitemap-parser.ts)
// ============================================================================

/**
 * Parse XML sitemap and extract URLs with metadata.
 * @deprecated Use SitemapParser.parse() instead
 */
export async function parseSitemap(
  sitemapUrl: string
): Promise<{
  urls: SitemapUrl[];
  sitemapIndexUrls: string[];
  parseTimeMs: number;
}> {
  const startTime = Date.now();
  const result = await SitemapParser.parse(sitemapUrl);
  return {
    urls: result.urls,
    sitemapIndexUrls: result.childSitemaps,
    parseTimeMs: result.parseTimeMs ?? Date.now() - startTime,
  };
}

/**
 * Recursively fetch all URLs from sitemap (including sitemap indexes).
 * @deprecated Use SitemapParser.parseRecursive() instead
 */
export async function fetchAllSitemapUrls(
  sitemapUrl: string,
  maxDepth: number = 2
): Promise<SitemapUrl[]> {
  return SitemapParser.parseRecursive(sitemapUrl, { maxDepth });
}

/**
 * Filter URLs by lastmod, returning only those modified after threshold.
 * Used for delta crawling L0 layer.
 */
export function filterByLastmod(
  urls: SitemapUrl[],
  sinceDate: Date,
  maxAgeDays: number = 30
): { unchanged: SitemapUrl[]; changed: SitemapUrl[]; unknown: SitemapUrl[] } {
  const unchanged: SitemapUrl[] = [];
  const changed: SitemapUrl[] = [];
  const unknown: SitemapUrl[] = [];

  const maxAgeThreshold = new Date(
    Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
  );

  for (const url of urls) {
    if (!url.lastmod) {
      // No lastmod - must check
      unknown.push(url);
    } else if (url.lastmod < sinceDate && url.lastmod > maxAgeThreshold) {
      // Unchanged (lastmod before our last crawl and reasonably recent)
      unchanged.push(url);
    } else {
      // Changed or very old (re-check to be safe)
      changed.push(url);
    }
  }

  return { unchanged, changed, unknown };
}
