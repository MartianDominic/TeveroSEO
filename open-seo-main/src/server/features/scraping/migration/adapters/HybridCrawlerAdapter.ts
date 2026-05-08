/**
 * HybridCrawler Consumer Adapter
 * Phase 95-06: Consumer Migration Wiring
 * Gap: MIG-2
 *
 * Bridges HybridCrawler to unified ScrapingService via MigrationRouter.
 * Feature flag: hybridCrawler
 */

import type { ScrapeResult, ScrapeOptions } from "../../ScrapingService";
import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapingFeature } from "../../config";

// =============================================================================
// Types
// =============================================================================

/**
 * Input type for HybridCrawler fetch operations.
 */
export interface HybridCrawlerInput {
  url: string;
  /** Optional timeout in milliseconds */
  timeoutMs?: number;
  /** User-Agent header */
  userAgent?: string;
  /** Accept-Language header */
  acceptLanguage?: string;
  /** Enable Playwright fallback (default: true) */
  playwrightFallback?: boolean;
  /** Maximum redirect chain depth */
  maxRedirects?: number;
  /** Client ID for cost tracking */
  clientId?: string;
  /** Workspace ID for cost tracking */
  workspaceId?: string;
  /** Job ID for cost tracking */
  jobId?: string;
}

/**
 * Output type matching HybridCrawler's CrawlResult.
 */
export interface HybridCrawlerOutput {
  /** URL that was crawled (final URL after redirects) */
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

// =============================================================================
// Adapter Implementation
// =============================================================================

/**
 * Adapter that bridges HybridCrawler to ScrapingService.
 */
export const hybridCrawlerAdapter: ConsumerAdapter<
  HybridCrawlerInput,
  HybridCrawlerOutput
> = {
  feature: "hybridCrawler" as ScrapingFeature,

  toScrapeOptions(input: HybridCrawlerInput): ScrapeOptions & { url: string } {
    const headers: Record<string, string> = {};

    if (input.userAgent) {
      headers["User-Agent"] = input.userAgent;
    }
    if (input.acceptLanguage) {
      headers["Accept-Language"] = input.acceptLanguage;
    }

    return {
      url: input.url,
      timeoutMs: input.timeoutMs ?? 30000,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      clientId: input.clientId,
      jobId: input.jobId,
      feature: "hybridCrawler",
      includeHtml: true,
    };
  },

  toConsumerOutput(result: ScrapeResult, _input: HybridCrawlerInput): HybridCrawlerOutput {
    return {
      url: result.url,
      html: result.html ?? "",
      statusCode: result.statusCode,
      fetchMethod: mapTierToFetchMethod(result.tierUsed),
      changeType: "add", // Delta sync not yet integrated
      fetchTimeMs: result.responseTimeMs,
    };
  },

  compareOutputs(legacy: HybridCrawlerOutput, adapted: HybridCrawlerOutput): ComparisonResult {
    const differences: Array<{ field: string; legacy: unknown; new: unknown }> = [];

    // Compare status code
    if (legacy.statusCode !== adapted.statusCode) {
      differences.push({
        field: "statusCode",
        legacy: legacy.statusCode,
        new: adapted.statusCode,
      });
    }

    // Compare HTML length (not exact match, as formatting may differ)
    const legacyLength = legacy.html?.length ?? 0;
    const adaptedLength = adapted.html?.length ?? 0;
    const lengthDiff = Math.abs(legacyLength - adaptedLength);
    const lengthThreshold = Math.max(legacyLength, adaptedLength) * 0.1; // 10% tolerance

    if (lengthDiff > lengthThreshold) {
      differences.push({
        field: "htmlLength",
        legacy: legacyLength,
        new: adaptedLength,
      });
    }

    // Compare timing (large discrepancies only)
    if (Math.abs(legacy.fetchTimeMs - adapted.fetchTimeMs) > 5000) {
      differences.push({
        field: "fetchTimeMs",
        legacy: legacy.fetchTimeMs,
        new: adapted.fetchTimeMs,
      });
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
 * Map scrape tier to HybridCrawler fetch method.
 */
function mapTierToFetchMethod(tier: string): "http" | "playwright" | "tiered" {
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

/**
 * Create a HybridCrawlerAdapter instance for custom configuration.
 */
export function createHybridCrawlerAdapter(): ConsumerAdapter<
  HybridCrawlerInput,
  HybridCrawlerOutput
> {
  return { ...hybridCrawlerAdapter };
}
