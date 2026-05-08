/**
 * robots.txt and sitemap.xml discovery for the site audit crawler.
 * GAP-O1/GAP-O3: Added cost attribution for discovery phase tracking.
 */
import robotsParser from "robots-parser";
import { XMLParser } from "fast-xml-parser";
import { isSameOrigin, normalizeUrl } from "./url-utils";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db";
import { getDfsCostTracker, extractDomainFromUrl } from "@/server/features/scraping/providers/DfsCostTracker";

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
 * GAP-O1/GAP-O3: Cost attribution options for discovery phase.
 * Used to track robots.txt and sitemap fetch costs per audit.
 */
export interface DiscoveryCostOptions {
  auditId?: string;
  clientId?: string;
  workspaceId?: string;
  trackCosts?: boolean;
}

/**
 * Fetch and parse robots.txt for a given origin.
 * Returns a helper to check if URLs are allowed + discovered sitemap URLs.
 * GAP-O1/GAP-O3: Added cost attribution for audit cost tracking.
 */
export async function fetchRobotsTxt(
  origin: string,
  costOptions?: DiscoveryCostOptions,
): Promise<RobotsResult> {
  const robotsUrl = `${origin}/robots.txt`;
  const startTime = Date.now();
  const domain = extractDomainFromUrl(origin);

  try {
    const response = await fetch(robotsUrl, {
      headers: { "User-Agent": "OpenSEO-Audit/1.0" },
      signal: AbortSignal.timeout(10_000),
    });

    const responseTimeMs = Date.now() - startTime;

    // GAP-O1/GAP-O3: Track discovery cost (free tier, but useful for monitoring)
    if (costOptions?.trackCosts && costOptions.clientId) {
      const costTracker = getDfsCostTracker(db as any);
      costTracker.recordCost({
        url: robotsUrl,
        domain,
        mode: "basic",
        usedStandardQueue: false,
        estimatedCost: 0, // Direct fetch is free
        actualCost: 0,
        success: response.ok,
        statusCode: response.status,
        responseTimeMs,
        clientId: costOptions.clientId,
        workspaceId: costOptions.workspaceId,
        jobId: costOptions.auditId,
      }).catch((err) => {
        log.warn("Failed to record robots.txt cost", { error: err instanceof Error ? err.message : String(err) });
      });
    }

    if (!response.ok) {
      // No robots.txt = everything allowed
      return {
        isAllowed: () => true,
        sitemapUrls: [],
      };
    }

    const text = await response.text();
    const robots = robotsParser(robotsUrl, text);

    return {
      isAllowed: (url: string) => robots.isAllowed(url) ?? true,
      sitemapUrls: robots.getSitemaps(),
    };
  } catch (error) {
    const responseTimeMs = Date.now() - startTime;

    // GAP-O1/GAP-O3: Track failed discovery attempt
    if (costOptions?.trackCosts && costOptions.clientId) {
      const costTracker = getDfsCostTracker(db as any);
      costTracker.recordCost({
        url: robotsUrl,
        domain,
        mode: "basic",
        usedStandardQueue: false,
        estimatedCost: 0,
        actualCost: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        responseTimeMs,
        clientId: costOptions.clientId,
        workspaceId: costOptions.workspaceId,
        jobId: costOptions.auditId,
      }).catch((err) => {
        log.warn("Failed to record robots.txt error cost", { error: err instanceof Error ? err.message : String(err) });
      });
    }

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
      const response = await fetch(normalizedSitemapUrl, {
        headers: { "User-Agent": "OpenSEO-Audit/1.0" },
        signal: AbortSignal.timeout(SITEMAP_FETCH_TIMEOUT_MS),
      });

      const finalUrl = normalizeUrl(response.url, normalizedSitemapUrl);
      if (!finalUrl || !isSameOrigin(finalUrl, normalizedSitemapUrl)) {
        return { nestedSitemaps: [], pageUrls: [], timedOut: false };
      }

      if (!response.ok) {
        return { nestedSitemaps: [], pageUrls: [], timedOut: false };
      }

      const body = await response.text();
      if (!isProbablySitemapXml(response.headers.get("content-type"), body)) {
        return { nestedSitemaps: [], pageUrls: [], timedOut: false };
      }

      const parsed = parseXmlDocument(body);
      const sections = getParsedSitemapSections(parsed);
      const nestedSitemaps = getSitemapLocations(sections.sitemap)
        .map((loc) => normalizeUrl(loc, finalUrl))
        .filter((loc): loc is string => loc !== null);
      const pageUrls = getSitemapLocations(sections.url)
        .map((loc) => normalizeUrl(loc, finalUrl))
        .filter((loc): loc is string => loc !== null);

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
  costOptions?: DiscoveryCostOptions,
): Promise<{ urls: string[]; robots: RobotsResult; sitemapUrls: Set<string>; sitemapFetchResult: SitemapFetchResult }> {
  // GAP-O1/GAP-O3: Pass cost options for tracking discovery phase costs
  const robots = await fetchRobotsTxt(origin, costOptions);

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
