/**
 * Sitemap Parser with lastmod support
 *
 * Parses XML sitemaps and sitemap indexes with metadata extraction.
 * Per crawling doc Section 5: lastmod reliability varies by platform.
 */

import { XMLParser } from "fast-xml-parser";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "sitemap-parser" });

export interface SitemapUrl {
  loc: string;
  lastmod: Date | null;
  changefreq: string | null;
  priority: number | null;
}

export interface SitemapParseResult {
  urls: SitemapUrl[];
  sitemapIndexUrls: string[];
  parseTimeMs: number;
}

/**
 * Parse XML sitemap and extract URLs with metadata.
 * Handles both regular sitemaps and sitemap indexes.
 *
 * Per crawling doc Section 5:
 * - lastmod reliability varies by platform
 * - Yoast/RankMath WordPress: fairly accurate
 * - Shopify: flips on any admin mutation (treat as negative-only signal)
 * - Magento 2: may produce garbage timestamps
 */
export async function parseSitemap(
  sitemapUrl: string
): Promise<SitemapParseResult> {
  const startTime = Date.now();

  const response = await fetch(sitemapUrl, {
    headers: {
      "User-Agent": "TeveroSEO/1.0 (+https://teveroseo.com/bot)",
      Accept: "application/xml, text/xml",
      "Cache-Control": "no-cache", // Avoid stale cached sitemaps
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch sitemap: ${response.status} ${response.statusText}`
    );
  }

  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    textNodeName: "#text",
  });

  const parsed = parser.parse(xml);

  // Check if this is a sitemap index
  if (parsed.sitemapindex) {
    const sitemaps = Array.isArray(parsed.sitemapindex.sitemap)
      ? parsed.sitemapindex.sitemap
      : [parsed.sitemapindex.sitemap];

    return {
      urls: [],
      sitemapIndexUrls: sitemaps
        .filter((s: unknown): s is { loc: string } => {
          return s != null && typeof s === "object" && "loc" in s;
        })
        .map((s: { loc: string }) => s.loc),
      parseTimeMs: Date.now() - startTime,
    };
  }

  // Regular sitemap
  if (!parsed.urlset?.url) {
    return { urls: [], sitemapIndexUrls: [], parseTimeMs: Date.now() - startTime };
  }

  const urlEntries = Array.isArray(parsed.urlset.url)
    ? parsed.urlset.url
    : [parsed.urlset.url];

  const urls: SitemapUrl[] = urlEntries
    .map((entry: Record<string, unknown>) => ({
      loc: String(entry.loc || ""),
      lastmod: parseLastmod(entry.lastmod),
      changefreq: entry.changefreq ? String(entry.changefreq) : null,
      priority: entry.priority ? Number(entry.priority) : null,
    }))
    .filter((u: SitemapUrl) => u.loc);

  return {
    urls,
    sitemapIndexUrls: [],
    parseTimeMs: Date.now() - startTime,
  };
}

/**
 * Parse lastmod value, handling various formats.
 */
function parseLastmod(value: unknown): Date | null {
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
 * Recursively fetch all URLs from sitemap (including sitemap indexes).
 * Returns flat list of all URLs across all sitemaps.
 */
export async function fetchAllSitemapUrls(
  sitemapUrl: string,
  maxDepth: number = 2
): Promise<SitemapUrl[]> {
  const visited = new Set<string>();
  const allUrls: SitemapUrl[] = [];

  async function processRecursive(url: string, depth: number): Promise<void> {
    if (depth > maxDepth || visited.has(url)) {
      return;
    }
    visited.add(url);

    try {
      const result = await parseSitemap(url);
      allUrls.push(...result.urls);

      // Process nested sitemaps
      for (const nestedUrl of result.sitemapIndexUrls) {
        await processRecursive(nestedUrl, depth + 1);
      }
    } catch (error) {
      log.warn(
        `Failed to parse sitemap: ${url}`,
        error instanceof Error ? { error: error.message } : { error: String(error) }
      );
    }
  }

  await processRecursive(sitemapUrl, 0);
  return allUrls;
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
