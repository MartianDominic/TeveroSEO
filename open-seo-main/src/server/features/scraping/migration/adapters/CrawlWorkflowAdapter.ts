/**
 * CrawlWorkflow Consumer Adapter
 * Phase 95-06: Consumer Migration Wiring
 * Gap: MIG-2
 *
 * Bridges UniversalCrawler to unified ScrapingService via MigrationRouter.
 * Feature flag: crawlWorkflow
 *
 * UniversalCrawler is used for site audit crawl workflows (crawlWorkflow feature).
 */

import type { ScrapeResult, ScrapeOptions } from "../../ScrapingService";
import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapingFeature } from "../../config";

// =============================================================================
// Types
// =============================================================================

/**
 * Page data structure from UniversalCrawler.
 */
export interface CrawlPageData {
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
 * Input type for CrawlWorkflow operations.
 */
export interface CrawlWorkflowInput {
  url: string;
  /** Maximum pages to crawl */
  maxPages?: number;
  /** Respect robots.txt (default: true) */
  respectRobots?: boolean;
  /** Request timeout in ms */
  timeout?: number;
  /** User agent string */
  userAgent?: string;
  /** Crawl provider preference */
  provider?: "auto" | "direct" | "dataforseo" | "playwright" | "tiered";
  /** DataForSEO configuration (for legacy compatibility) */
  dataForSeo?: {
    login: string;
    password: string;
    enableBrowserRendering?: boolean;
  };
  /** Client ID for cost tracking */
  clientId?: string;
  /** Workspace ID for cost tracking */
  workspaceId?: string;
  /** Job ID for cost tracking */
  jobId?: string;
}

/**
 * Output type matching UniversalCrawler's CrawlResult.
 */
export interface CrawlWorkflowOutput {
  status: "success" | "blocked" | "error" | "requires_upgrade";
  method?: "fetch" | "dataforseo" | "playwright" | "tiered";
  data?: CrawlPageData;
  sitemapUrls?: string[];
  reason?: string;
  error?: string;
  guidance?: string;
}

// =============================================================================
// Adapter Implementation
// =============================================================================

/**
 * Adapter that bridges UniversalCrawler (crawlWorkflow) to ScrapingService.
 */
export const crawlWorkflowAdapter: ConsumerAdapter<
  CrawlWorkflowInput,
  CrawlWorkflowOutput
> = {
  feature: "crawlWorkflow" as ScrapingFeature,

  toScrapeOptions(input: CrawlWorkflowInput): ScrapeOptions & { url: string } {
    const headers: Record<string, string> = {};

    if (input.userAgent) {
      headers["User-Agent"] = input.userAgent;
    }

    // Map provider to forceTier
    let forceTier: string | undefined;
    if (input.provider === "direct") {
      forceTier = "direct";
    } else if (input.provider === "dataforseo") {
      forceTier = "dfs_basic";
    } else if (input.provider === "playwright") {
      forceTier = "camoufox";
    }

    return {
      url: input.url,
      timeoutMs: input.timeout ?? 30000,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      forceTier: forceTier as any,
      clientId: input.clientId,
      jobId: input.jobId,
      feature: "crawlWorkflow",
      includeHtml: true,
      includeParsedData: true,
    };
  },

  toConsumerOutput(result: ScrapeResult, _input: CrawlWorkflowInput): CrawlWorkflowOutput {
    if (!result.success) {
      return mapErrorToOutput(result);
    }

    // Extract page data from parsed data or raw HTML
    const data = extractPageData(result);

    return {
      status: "success",
      method: mapTierToMethod(result.tierUsed),
      data,
    };
  },

  compareOutputs(legacy: CrawlWorkflowOutput, adapted: CrawlWorkflowOutput): ComparisonResult {
    const differences: Array<{ field: string; legacy: unknown; new: unknown }> = [];

    // Compare status
    if (legacy.status !== adapted.status) {
      differences.push({
        field: "status",
        legacy: legacy.status,
        new: adapted.status,
      });
    }

    // Compare data fields if both successful
    if (legacy.data && adapted.data) {
      if (legacy.data.title !== adapted.data.title) {
        differences.push({
          field: "data.title",
          legacy: legacy.data.title,
          new: adapted.data.title,
        });
      }

      if (legacy.data.metaDescription !== adapted.data.metaDescription) {
        differences.push({
          field: "data.metaDescription",
          legacy: legacy.data.metaDescription,
          new: adapted.data.metaDescription,
        });
      }

      // Compare h1 count (not exact text, as parsing may differ)
      if (legacy.data.h1.length !== adapted.data.h1.length) {
        differences.push({
          field: "data.h1.length",
          legacy: legacy.data.h1.length,
          new: adapted.data.h1.length,
        });
      }

      // Compare internal links count (significant differences only)
      const linkDiff = Math.abs(
        legacy.data.internalLinks.length - adapted.data.internalLinks.length
      );
      if (linkDiff > 5) {
        differences.push({
          field: "data.internalLinks.length",
          legacy: legacy.data.internalLinks.length,
          new: adapted.data.internalLinks.length,
        });
      }
    }

    return {
      match: differences.length === 0,
      differences,
    };
  },
};

// =============================================================================
// Helpers
// =============================================================================

/**
 * Map scrape tier to UniversalCrawler method.
 */
function mapTierToMethod(tier: string): "fetch" | "dataforseo" | "playwright" | "tiered" {
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
 * Map error result to CrawlWorkflowOutput.
 */
function mapErrorToOutput(result: ScrapeResult): CrawlWorkflowOutput {
  if (result.statusCode === 403 || result.statusCode === 429) {
    return {
      status: "blocked",
      reason: result.error ?? "Access blocked",
      error: result.error,
    };
  }

  if (result.quality && !result.quality.acceptable) {
    return {
      status: "requires_upgrade",
      reason: "Page requires JavaScript rendering",
      guidance:
        "Options: 1) Connect via OAuth 2) Configure DataForSEO OnPage API 3) Use direct fetch with manual JS handling",
      error: result.error,
    };
  }

  return {
    status: "error",
    error: result.error ?? "Unknown error",
  };
}

/**
 * Extract CrawlPageData from ScrapeResult.
 */
function extractPageData(result: ScrapeResult): CrawlPageData {
  // Use parsed data if available
  if (result.parsedData) {
    return {
      title: result.parsedData.title ?? "",
      metaDescription: result.parsedData.metaDescription ?? null,
      h1: result.parsedData.h1 ?? [],
      h2: result.parsedData.h2 ?? [],
      canonicalUrl: result.parsedData.canonical ?? null,
      ogTitle: null, // Not in ParsedPageData
      ogDescription: null,
      internalLinks: (result.parsedData.internalLinks ?? []).map((l) => l.url),
    };
  }

  // Fallback: parse from HTML
  if (result.html) {
    return parseHtmlToPageData(result.html, result.url);
  }

  // Empty result
  return {
    title: "",
    metaDescription: null,
    h1: [],
    h2: [],
    canonicalUrl: null,
    ogTitle: null,
    ogDescription: null,
    internalLinks: [],
  };
}

/**
 * Parse HTML to extract page data.
 * Mirrors UniversalCrawler.extractPageData.
 */
function parseHtmlToPageData(html: string, url: string): CrawlPageData {
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

/**
 * Create a CrawlWorkflowAdapter instance for custom configuration.
 */
export function createCrawlWorkflowAdapter(): ConsumerAdapter<
  CrawlWorkflowInput,
  CrawlWorkflowOutput
> {
  return { ...crawlWorkflowAdapter };
}
