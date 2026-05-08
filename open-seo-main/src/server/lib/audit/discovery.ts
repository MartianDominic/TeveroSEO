/**
 * robots.txt and sitemap.xml discovery for the site audit crawler.
 *
 * SEO-01: Uses TextFetcher for cached, rate-limited fetching of text files.
 * - robots.txt: 10 min TTL (changes frequently with SEO updates)
 * - sitemap.xml: 2 hour TTL (more stable)
 */
import robotsParser from "robots-parser";
import { XMLParser } from "fast-xml-parser";
import { isSameOrigin, normalizeUrl } from "./url-utils";
import { createLogger } from "@/server/lib/logger";
import { textFetcher } from "@/server/features/scraping/TextFetcher";

const log = createLogger({ module: "discovery" });

const SITEMAP_FETCH_TIMEOUT_MS = 15_000;
const MAX_SITEMAP_DEPTH = 3;
const MAX_SITEMAP_DOCS = 300;
const SITEMAP_CONCURRENCY = 5;
const SITEMAP_RETRIES = 1;

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  isArray: (name) => name === "sitemap" || name === "url",
});

export interface RobotsResult {
  isAllowed: (url: string) => boolean;
  sitemapUrls: string[];
}

/**
 * Fetch and parse robots.txt for a given origin.
 * Returns a helper to check if URLs are allowed + discovered sitemap URLs.
 *
 * SEO-01: Uses TextFetcher for caching (10 min TTL) and consistent rate limiting.
 */
export async function fetchRobotsTxt(origin: string): Promise<RobotsResult> {
  const robotsUrl = `${origin}/robots.txt`;
  try {
    // SEO-01: Use TextFetcher for cached, rate-limited fetching
    const result = await textFetcher.fetchRobotsTxt(origin, {
      timeoutMs: 10_000,
    });

    if (!result.success || !result.content) {
      // No robots.txt = everything allowed
      log.debug(`robots.txt not available: ${origin} fromCache=${result.fromCache} error=${result.error}`);
      return {
        isAllowed: () => true,
        sitemapUrls: [],
      };
    }

    const robots = robotsParser(robotsUrl, result.content);
    log.debug(`robots.txt parsed successfully: ${origin} fromCache=${result.fromCache} time=${result.responseTimeMs}ms sitemaps=${robots.getSitemaps().length}`);

    return {
      isAllowed: (url: string) => robots.isAllowed(url) ?? true,
      sitemapUrls: robots.getSitemaps(),
    };
  } catch (error) {
    log.warn("Failed to fetch robots.txt", { error: error instanceof Error ? error.message : String(error) });
    return {
      isAllowed: () => true,
      sitemapUrls: [],
    };
  }
}

/**
 * Fetch and parse a sitemap (supports sitemap index recursion).
 * Returns a flat list of page URLs found.
 */
function isProbablySitemapXml(
  contentType: string | null,
  body: string,
): boolean {
  if (contentType?.toLowerCase().includes("xml")) {
    return true;
  }

  const trimmed = body.trimStart().toLowerCase();
  return (
    trimmed.startsWith("<?xml") ||
    trimmed.startsWith("<urlset") ||
    trimmed.startsWith("<sitemapindex")
  );
}

function getSitemapLocations(input: unknown): string[] {
  if (!input) return [];
  const entries = Array.isArray(input) ? input : [input];
  return entries
    .map((entry) => {
      if (isRecord(entry)) {
        const loc = entry["loc"];
        return typeof loc === "string" ? loc : null;
      }
      return null;
    })
    .filter((loc): loc is string => typeof loc === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

function getParsedSitemapSections(parsed: unknown): {
  sitemap: unknown;
  url: unknown;
} {
  if (!parsed || typeof parsed !== "object") {
    return { sitemap: undefined, url: undefined };
  }

  const root = parsed as {
    sitemapindex?: { sitemap?: unknown };
    urlset?: { url?: unknown };
  };

  return {
    sitemap: root.sitemapindex?.sitemap,
    url: root.urlset?.url,
  };
}

function isTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return "name" in error && error.name === "TimeoutError";
}

function parseXmlDocument(body: string): unknown {
  return xmlParser.parse(body) as unknown;
}

/**
 * Fetch and parse a sitemap document with caching and retry support.
 *
 * SEO-01: Uses TextFetcher for caching (2 hour TTL) and consistent rate limiting.
 */
async function fetchSitemapDocumentWithRetry(sitemapUrl: string): Promise<{
  nestedSitemaps: string[];
  pageUrls: string[];
  timedOut: boolean;
}> {
  const normalizedSitemapUrl = normalizeUrl(sitemapUrl);
  if (!normalizedSitemapUrl) {
    return { nestedSitemaps: [], pageUrls: [], timedOut: false };
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt <= SITEMAP_RETRIES; attempt++) {
    try {
      // SEO-01: Use TextFetcher for cached, rate-limited fetching
      const result = await textFetcher.fetchSitemapXml(normalizedSitemapUrl, {
        timeoutMs: SITEMAP_FETCH_TIMEOUT_MS,
      });

      if (!result.success || !result.content) {
        // Log cache info for debugging
        log.debug(`Sitemap fetch failed: ${normalizedSitemapUrl} fromCache=${result.fromCache} status=${result.statusCode} error=${result.error}`);
        return { nestedSitemaps: [], pageUrls: [], timedOut: result.error === "Timeout" };
      }

      const body = result.content;

      // Validate content type (use "application/xml" as placeholder since we have raw content)
      if (!isProbablySitemapXml("application/xml", body)) {
        log.debug(`Content is not valid sitemap XML: ${normalizedSitemapUrl}`);
        return { nestedSitemaps: [], pageUrls: [], timedOut: false };
      }

      const parsed = parseXmlDocument(body);
      const sections = getParsedSitemapSections(parsed);
      const nestedSitemaps = getSitemapLocations(sections.sitemap)
        .map((loc) => normalizeUrl(loc, normalizedSitemapUrl))
        .filter((loc): loc is string => loc !== null);
      const pageUrls = getSitemapLocations(sections.url)
        .map((loc) => normalizeUrl(loc, normalizedSitemapUrl))
        .filter((loc): loc is string => loc !== null);

      log.debug(`Sitemap parsed successfully: ${normalizedSitemapUrl} fromCache=${result.fromCache} time=${result.responseTimeMs}ms nested=${nestedSitemaps.length} urls=${pageUrls.length}`);

      return { nestedSitemaps, pageUrls, timedOut: false };
    } catch (error) {
      lastError = error;
      if (!isTimeoutError(error) || attempt === SITEMAP_RETRIES) {
        break;
      }
    }
  }

  return {
    nestedSitemaps: [],
    pageUrls: [],
    timedOut: isTimeoutError(lastError),
  };
}

/**
 * Discover all page URLs from robots.txt + sitemaps for an origin.
 * Also tries the default /sitemap.xml if not listed in robots.txt.
 */
/**
 * Sitemap fetch statistics for audit reporting.
 */
export interface SitemapFetchResult {
  fetched: number;
  failed: number;
  timedOut: number;
  discoveredUrls: number;
  success: boolean;
}

export async function discoverUrls(
  origin: string,
  maxPages = 50,
): Promise<{ urls: string[]; robots: RobotsResult; sitemapUrls: Set<string>; sitemapFetchResult: SitemapFetchResult }> {
  const robots = await fetchRobotsTxt(origin);

  // Collect sitemap URLs: from robots.txt + default location
  const sitemapSources = new Set(robots.sitemapUrls);
  sitemapSources.add(`${origin}/sitemap.xml`);

  const maxDiscoveredUrls = Math.min(Math.max(maxPages * 20, 500), 50_000);
  const allUrls = new Set<string>();

  const queue: Array<{ url: string; depth: number }> = Array.from(
    sitemapSources,
  )
    .map((url) => normalizeUrl(url, origin))
    .filter((url): url is string => url !== null)
    .filter((url) => isSameOrigin(url, origin))
    .map((url) => ({ url, depth: MAX_SITEMAP_DEPTH }));
  const seenSitemapDocs = new Set<string>();
  let fetchedDocs = 0;
  let failedDocs = 0;
  let timedOutDocs = 0;

  while (queue.length > 0 && allUrls.size < maxDiscoveredUrls) {
    if (fetchedDocs >= MAX_SITEMAP_DOCS) {
      break;
    }
    const batch = queue.splice(0, SITEMAP_CONCURRENCY);
    await Promise.all(
      batch.map(async ({ url, depth }) => {
        const normalizedUrl = normalizeUrl(url);
        if (
          !normalizedUrl ||
          !isSameOrigin(normalizedUrl, origin) ||
          depth <= 0 ||
          seenSitemapDocs.has(normalizedUrl)
        ) {
          return;
        }

        seenSitemapDocs.add(normalizedUrl);
        fetchedDocs += 1;

        const result = await fetchSitemapDocumentWithRetry(normalizedUrl);
        if (
          result.pageUrls.length === 0 &&
          result.nestedSitemaps.length === 0
        ) {
          failedDocs += 1;
          if (result.timedOut) {
            timedOutDocs += 1;
          }
          return;
        }

        for (const pageUrl of result.pageUrls) {
          if (!isSameOrigin(pageUrl, origin)) continue;
          if (allUrls.size >= maxDiscoveredUrls) break;
          allUrls.add(pageUrl);
        }

        if (depth <= 1) return;

        for (const nestedUrl of result.nestedSitemaps) {
          if (!isSameOrigin(nestedUrl, origin)) continue;
          if (!seenSitemapDocs.has(nestedUrl)) {
            queue.push({ url: nestedUrl, depth: depth - 1 });
          }
        }
      }),
    );
  }

  // FIX-13 (MED-SEO-04): Enhanced sitemap fetch failure logging and reporting
  const sitemapFetchResult = {
    fetched: fetchedDocs,
    failed: failedDocs,
    timedOut: timedOutDocs,
    discoveredUrls: allUrls.size,
    success: failedDocs === 0,
  };

  if (failedDocs > 0) {
    log.warn("Sitemap discovery completed with partial failures", {
      origin,
      ...sitemapFetchResult,
    });
  } else {
    log.info("Sitemap discovery completed successfully", {
      origin,
      ...sitemapFetchResult,
    });
  }

  return {
    urls: Array.from(allUrls),
    robots,
    sitemapUrls: allUrls,
    // FIX-13 (MED-SEO-04): Include sitemap fetch stats for audit report
    sitemapFetchResult,
  };
}
