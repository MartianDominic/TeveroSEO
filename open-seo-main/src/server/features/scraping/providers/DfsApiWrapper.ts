/**
 * DataForSEO API Wrapper with Cost Tracking
 * Phase 96: Legacy Module Unification
 *
 * Centralized wrapper that intercepts all DataForSEO API calls
 * from legacy modules and tracks costs via DfsCostTracker.
 *
 * This module provides drop-in replacements for legacy DataForSEO functions
 * that add cost tracking without breaking existing code.
 *
 * Legacy modules to migrate:
 * - dataforseo-organic.ts (fetchOrganicKeywords)
 * - dataforseoVolume.ts (fetchSearchVolumeRaw)
 * - dataforseoBacklinks.ts (fetchBacklinksSummaryRaw, etc.)
 * - dataforseoKeywordGap.ts (fetchDomainIntersectionRaw)
 * - dataforseoProspect.ts (fetchKeywordsForSiteRaw, fetchCompetitorsDomainRaw)
 * - dataforseo.ts (fetchKeywordMetrics, fetchRelatedKeywordsRaw, etc.)
 *
 * @example
 * // Before (no cost tracking):
 * import { fetchOrganicKeywords } from "@/server/lib/dataforseo-organic";
 * const keywords = await fetchOrganicKeywords(domain, locationCode, languageCode, limit);
 *
 * // After (with cost tracking):
 * import { withCostTracking } from "@/server/features/scraping/providers/DfsApiWrapper";
 * const keywords = await withCostTracking(
 *   () => fetchOrganicKeywords(domain, locationCode, languageCode, limit),
 *   { endpoint: "labs/ranked_keywords", feature: "organic_keywords" }
 * );
 */

import { db, type DbClient } from "@/db";
import { getDfsCostTracker, extractDomainFromUrl } from "./DfsCostTracker";
import {
  DFS_LABS_PRICING,
  DFS_BACKLINKS_PRICING,
  DFS_SERP_PRICING,
  DFS_ONPAGE_PRICING,
  type DfsLabsOperation,
  type DfsBacklinksOperation,
} from "../cost/dfs-pricing";
import type { DataforseoApiResponse, DataforseoApiCallCost } from "@/server/lib/dataforseoCost";
import { createComponentLogger } from "../logging";

// =============================================================================
// Logger
// =============================================================================

const logger = createComponentLogger("dfs-api-wrapper");

// =============================================================================
// Types
// =============================================================================

/**
 * Options for cost tracking.
 */
export interface CostTrackingOptions {
  /** API endpoint for categorization (e.g., "labs/ranked_keywords", "backlinks/summary") */
  endpoint: string;

  /** Feature name for attribution (e.g., "organic_keywords", "keyword_gap") */
  feature: string;

  /** Client ID for attribution */
  clientId?: string;

  /** Workspace ID for grouping */
  workspaceId?: string;

  /** Job ID for correlation */
  jobId?: string;

  /** Correlation ID for request tracing */
  correlationId?: string;

  /** Target domain (extracted from URL if not provided) */
  domain?: string;
}

/**
 * Endpoint category for pricing lookup.
 */
type EndpointCategory = "labs" | "backlinks" | "serp" | "onpage";

/**
 * Endpoint pricing map for cost estimation.
 * All costs derived from canonical DFS_LABS_PRICING constants.
 */
const ENDPOINT_PRICING: Record<string, { category: EndpointCategory; costUsd: number }> = {
  // Labs API endpoints
  "labs/ranked_keywords": { category: "labs", costUsd: DFS_LABS_PRICING.rankedKeywords },
  "labs/domain_rank": { category: "labs", costUsd: DFS_LABS_PRICING.domainRank },
  "labs/keyword_metrics": { category: "labs", costUsd: DFS_LABS_PRICING.keywordMetrics },
  "labs/keyword_ideas": { category: "labs", costUsd: DFS_LABS_PRICING.keywordIdeas },
  "labs/related_keywords": { category: "labs", costUsd: DFS_LABS_PRICING.relatedKeywords },
  "labs/keyword_suggestions": { category: "labs", costUsd: DFS_LABS_PRICING.keywordSuggestions },
  "labs/keywords_for_site": { category: "labs", costUsd: DFS_LABS_PRICING.keywordsForSite },
  "labs/competitors_domain": { category: "labs", costUsd: DFS_LABS_PRICING.competitorsDomain },
  "labs/domain_intersection": { category: "labs", costUsd: DFS_LABS_PRICING.domainIntersection },
  "labs/serp_competitors": { category: "labs", costUsd: DFS_LABS_PRICING.serpCompetitors },

  // Backlinks API endpoints
  "backlinks/summary": { category: "backlinks", costUsd: DFS_BACKLINKS_PRICING.summary },
  "backlinks/backlinks": { category: "backlinks", costUsd: DFS_BACKLINKS_PRICING.summary },
  "backlinks/referring_domains": { category: "backlinks", costUsd: DFS_BACKLINKS_PRICING.summary },
  "backlinks/domain_pages": { category: "backlinks", costUsd: DFS_BACKLINKS_PRICING.summary },
  "backlinks/history": { category: "backlinks", costUsd: DFS_BACKLINKS_PRICING.history },

  // SERP API endpoints
  "serp/live": { category: "serp", costUsd: DFS_SERP_PRICING.live },
  "serp/standard": { category: "serp", costUsd: DFS_SERP_PRICING.standard },

  // On-Page API endpoints
  "onpage/instant_pages": { category: "onpage", costUsd: DFS_ONPAGE_PRICING.basic.live },

  // Keywords Data endpoints
  "keywords_data/search_volume": { category: "labs", costUsd: DFS_LABS_PRICING.keywordMetrics },
};

// =============================================================================
// Core Wrapper Functions
// =============================================================================

/**
 * Get estimated cost for an endpoint.
 *
 * @param endpoint - Endpoint identifier
 * @returns Estimated cost in USD
 */
function getEstimatedCost(endpoint: string): number {
  const pricing = ENDPOINT_PRICING[endpoint];
  if (pricing) {
    return pricing.costUsd;
  }

  // Default fallback based on endpoint prefix
  if (endpoint.startsWith("labs/")) return 0.002;
  if (endpoint.startsWith("backlinks/")) return 0.002;
  if (endpoint.startsWith("serp/")) return 0.002;
  if (endpoint.startsWith("onpage/")) return 0.000125;

  logger.warn({ endpoint }, "Unknown endpoint, using default cost estimate");
  return 0.002;
}

/**
 * Record cost fire-and-forget (non-blocking).
 * This is the recommended method for legacy module migration.
 *
 * @param options - Cost tracking options
 * @param costUsd - Actual or estimated cost
 * @param success - Whether the API call succeeded
 * @param startTime - Start time for response time calculation
 */
function recordCostFireAndForget(
  options: CostTrackingOptions,
  costUsd: number,
  success: boolean,
  startTime: number,
  errorMessage?: string,
): void {
  const responseTimeMs = Date.now() - startTime;

  // Fire and forget - don't await
  getDfsCostTracker(db)
    .recordCost({
      url: options.endpoint,
      domain: options.domain || "unknown",
      mode: "basic", // Legacy modules typically use basic mode
      usedStandardQueue: false, // Legacy modules use Live API
      estimatedCost: getEstimatedCost(options.endpoint),
      actualCost: costUsd,
      success,
      responseTimeMs,
      clientId: options.clientId,
      workspaceId: options.workspaceId,
      jobId: options.jobId,
      taskId: options.correlationId,
      errorMessage,
    })
    .catch((err) => {
      logger.error({ error: err instanceof Error ? err.message : String(err) }, "Failed to record cost");
    });
}

/**
 * Wrap a DataForSEO API call with cost tracking.
 * For functions that return DataforseoApiResponse (with billing info).
 *
 * @param execute - Function that executes the API call
 * @param options - Cost tracking options
 * @returns Result data (extracts .data from DataforseoApiResponse)
 *
 * @example
 * const keywords = await withCostTrackingRaw(
 *   () => fetchKeywordsForSiteRaw({ target: domain, locationCode, languageCode }),
 *   { endpoint: "labs/keywords_for_site", feature: "prospect_analysis" }
 * );
 */
export async function withCostTrackingRaw<T>(
  execute: () => Promise<DataforseoApiResponse<T>>,
  options: CostTrackingOptions,
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await execute();

    // Use actual cost from billing info
    const costUsd = result.billing?.costUsd ?? getEstimatedCost(options.endpoint);

    recordCostFireAndForget(options, costUsd, true, startTime);

    logger.debug(
      {
        endpoint: options.endpoint,
        feature: options.feature,
        costUsd,
        responseTimeMs: Date.now() - startTime,
      },
      "API call tracked",
    );

    return result.data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordCostFireAndForget(options, getEstimatedCost(options.endpoint), false, startTime, errorMessage);

    logger.error(
      {
        endpoint: options.endpoint,
        feature: options.feature,
        error: errorMessage,
        responseTimeMs: Date.now() - startTime,
      },
      "API call failed",
    );

    throw error;
  }
}

/**
 * Wrap a legacy DataForSEO API call with cost tracking.
 * For functions that return raw data (no DataforseoApiResponse wrapper).
 *
 * @param execute - Function that executes the API call
 * @param options - Cost tracking options
 * @returns Result data
 *
 * @example
 * const keywords = await withCostTracking(
 *   () => fetchOrganicKeywords(domain, locationCode, languageCode, limit),
 *   { endpoint: "labs/ranked_keywords", feature: "organic_keywords", domain }
 * );
 */
export async function withCostTracking<T>(
  execute: () => Promise<T>,
  options: CostTrackingOptions,
): Promise<T> {
  const startTime = Date.now();

  try {
    const result = await execute();

    recordCostFireAndForget(options, getEstimatedCost(options.endpoint), true, startTime);

    logger.debug(
      {
        endpoint: options.endpoint,
        feature: options.feature,
        costUsd: getEstimatedCost(options.endpoint),
        responseTimeMs: Date.now() - startTime,
      },
      "Legacy API call tracked",
    );

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    recordCostFireAndForget(options, getEstimatedCost(options.endpoint), false, startTime, errorMessage);

    logger.error(
      {
        endpoint: options.endpoint,
        feature: options.feature,
        error: errorMessage,
        responseTimeMs: Date.now() - startTime,
      },
      "Legacy API call failed",
    );

    throw error;
  }
}

// =============================================================================
// Pre-wrapped Legacy Functions
// =============================================================================

/**
 * Import legacy functions for wrapping.
 * These are re-exported with cost tracking built in.
 */

// From dataforseo-organic.ts
import { fetchOrganicKeywords as _fetchOrganicKeywords } from "@/server/lib/dataforseo-organic";

/**
 * Fetch organic keywords with cost tracking.
 * Drop-in replacement for fetchOrganicKeywords from dataforseo-organic.ts.
 */
export async function fetchOrganicKeywordsTracked(
  domain: string,
  locationCode: number,
  languageCode: string,
  limit: number = 100,
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTracking(
    () => _fetchOrganicKeywords(domain, locationCode, languageCode, limit),
    {
      endpoint: "labs/ranked_keywords",
      feature: "organic_keywords",
      domain,
      ...trackingOptions,
    },
  );
}

// From dataforseoVolume.ts
import { fetchSearchVolumeRaw as _fetchSearchVolumeRaw } from "@/server/lib/opportunity/dataforseoVolume";

/**
 * Fetch search volume with cost tracking.
 * Drop-in replacement for fetchSearchVolumeRaw from dataforseoVolume.ts.
 */
export async function fetchSearchVolumeTracked(
  input: { keywords: string[]; locationCode: number; languageCode: string },
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTrackingRaw(
    () => _fetchSearchVolumeRaw(input),
    {
      endpoint: "keywords_data/search_volume",
      feature: "search_volume",
      ...trackingOptions,
    },
  );
}

// From dataforseoBacklinks.ts
import {
  fetchBacklinksSummaryRaw as _fetchBacklinksSummaryRaw,
  fetchBacklinksRowsRaw as _fetchBacklinksRowsRaw,
  fetchReferringDomainsRaw as _fetchReferringDomainsRaw,
  fetchDomainPagesSummaryRaw as _fetchDomainPagesSummaryRaw,
  fetchBacklinksHistoryRaw as _fetchBacklinksHistoryRaw,
  type BacklinksRequest,
  type BacklinksListRequest,
  type BacklinksTimeseriesRequest,
} from "@/server/lib/dataforseoBacklinks";

/**
 * Fetch backlinks summary with cost tracking.
 */
export async function fetchBacklinksSummaryTracked(
  input: BacklinksRequest,
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTrackingRaw(
    () => _fetchBacklinksSummaryRaw(input),
    {
      endpoint: "backlinks/summary",
      feature: "backlinks_summary",
      domain: input.target,
      ...trackingOptions,
    },
  );
}

/**
 * Fetch backlinks rows with cost tracking.
 */
export async function fetchBacklinksRowsTracked(
  input: BacklinksListRequest,
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTrackingRaw(
    () => _fetchBacklinksRowsRaw(input),
    {
      endpoint: "backlinks/backlinks",
      feature: "backlinks_list",
      domain: input.target,
      ...trackingOptions,
    },
  );
}

/**
 * Fetch referring domains with cost tracking.
 */
export async function fetchReferringDomainsTracked(
  input: BacklinksListRequest,
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTrackingRaw(
    () => _fetchReferringDomainsRaw(input),
    {
      endpoint: "backlinks/referring_domains",
      feature: "referring_domains",
      domain: input.target,
      ...trackingOptions,
    },
  );
}

/**
 * Fetch domain pages summary with cost tracking.
 */
export async function fetchDomainPagesSummaryTracked(
  input: BacklinksListRequest,
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTrackingRaw(
    () => _fetchDomainPagesSummaryRaw(input),
    {
      endpoint: "backlinks/domain_pages",
      feature: "domain_pages",
      domain: input.target,
      ...trackingOptions,
    },
  );
}

/**
 * Fetch backlinks history with cost tracking.
 */
export async function fetchBacklinksHistoryTracked(
  input: BacklinksTimeseriesRequest,
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTrackingRaw(
    () => _fetchBacklinksHistoryRaw(input),
    {
      endpoint: "backlinks/history",
      feature: "backlinks_history",
      domain: input.target,
      ...trackingOptions,
    },
  );
}

// From dataforseoKeywordGap.ts
import { fetchDomainIntersectionRaw as _fetchDomainIntersectionRaw } from "@/server/lib/dataforseoKeywordGap";
import type { DomainIntersectionInput } from "@/server/lib/dataforseoKeywordGap";

/**
 * Fetch domain intersection (keyword gap) with cost tracking.
 */
export async function fetchDomainIntersectionTracked(
  input: DomainIntersectionInput,
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTrackingRaw(
    () => _fetchDomainIntersectionRaw(input),
    {
      endpoint: "labs/domain_intersection",
      feature: "keyword_gap",
      domain: input.target2, // Target domain (prospect)
      ...trackingOptions,
    },
  );
}

// From dataforseoProspect.ts
import {
  fetchKeywordsForSiteRaw as _fetchKeywordsForSiteRaw,
  fetchCompetitorsDomainRaw as _fetchCompetitorsDomainRaw,
  type KeywordsForSiteInput,
  type CompetitorsDomainInput,
} from "@/server/lib/dataforseoProspect";

/**
 * Fetch keywords for site with cost tracking.
 */
export async function fetchKeywordsForSiteTracked(
  input: KeywordsForSiteInput,
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTrackingRaw(
    () => _fetchKeywordsForSiteRaw(input),
    {
      endpoint: "labs/keywords_for_site",
      feature: "keywords_for_site",
      domain: input.target,
      ...trackingOptions,
    },
  );
}

/**
 * Fetch competitors domain with cost tracking.
 */
export async function fetchCompetitorsDomainTracked(
  input: CompetitorsDomainInput,
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTrackingRaw(
    () => _fetchCompetitorsDomainRaw(input),
    {
      endpoint: "labs/competitors_domain",
      feature: "competitors_domain",
      domain: input.target,
      ...trackingOptions,
    },
  );
}

// From dataforseo.ts (main module)
import {
  fetchKeywordMetrics as _fetchKeywordMetrics,
  fetchRelatedKeywordsRaw as _fetchRelatedKeywordsRaw,
  fetchKeywordSuggestionsRaw as _fetchKeywordSuggestionsRaw,
  fetchKeywordIdeasRaw as _fetchKeywordIdeasRaw,
  fetchDomainRankOverviewRaw as _fetchDomainRankOverviewRaw,
  fetchRankedKeywordsRaw as _fetchRankedKeywordsRaw,
  fetchLiveSerpItemsRaw as _fetchLiveSerpItemsRaw,
} from "@/server/lib/dataforseo";

/**
 * Fetch keyword metrics with cost tracking.
 */
export async function fetchKeywordMetricsTracked(
  keywords: string[],
  location: number,
  language: string,
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTracking(
    () => _fetchKeywordMetrics(keywords, location, language),
    {
      endpoint: "labs/keyword_metrics",
      feature: "keyword_metrics",
      ...trackingOptions,
    },
  );
}

/**
 * Fetch related keywords with cost tracking.
 */
export async function fetchRelatedKeywordsTracked(
  keyword: string,
  locationCode: number,
  languageCode: string,
  limit: number,
  depth?: number,
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTrackingRaw(
    () => _fetchRelatedKeywordsRaw(keyword, locationCode, languageCode, limit, depth),
    {
      endpoint: "labs/related_keywords",
      feature: "related_keywords",
      ...trackingOptions,
    },
  );
}

/**
 * Fetch keyword suggestions with cost tracking.
 */
export async function fetchKeywordSuggestionsTracked(
  keyword: string,
  locationCode: number,
  languageCode: string,
  limit: number,
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTrackingRaw(
    () => _fetchKeywordSuggestionsRaw(keyword, locationCode, languageCode, limit),
    {
      endpoint: "labs/keyword_suggestions",
      feature: "keyword_suggestions",
      ...trackingOptions,
    },
  );
}

/**
 * Fetch keyword ideas with cost tracking.
 */
export async function fetchKeywordIdeasTracked(
  keyword: string,
  locationCode: number,
  languageCode: string,
  limit: number,
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTrackingRaw(
    () => _fetchKeywordIdeasRaw(keyword, locationCode, languageCode, limit),
    {
      endpoint: "labs/keyword_ideas",
      feature: "keyword_ideas",
      ...trackingOptions,
    },
  );
}

/**
 * Fetch domain rank overview with cost tracking.
 */
export async function fetchDomainRankOverviewTracked(
  target: string,
  locationCode: number,
  languageCode: string,
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTrackingRaw(
    () => _fetchDomainRankOverviewRaw(target, locationCode, languageCode),
    {
      endpoint: "labs/domain_rank",
      feature: "domain_rank",
      domain: target,
      ...trackingOptions,
    },
  );
}

/**
 * Fetch ranked keywords with cost tracking.
 */
export async function fetchRankedKeywordsTracked(
  target: string,
  locationCode: number,
  languageCode: string,
  limit: number,
  orderBy?: string[],
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTrackingRaw(
    () => _fetchRankedKeywordsRaw(target, locationCode, languageCode, limit, orderBy),
    {
      endpoint: "labs/ranked_keywords",
      feature: "ranked_keywords",
      domain: target,
      ...trackingOptions,
    },
  );
}

/**
 * Fetch live SERP items with cost tracking.
 */
export async function fetchLiveSerpItemsTracked(
  keyword: string,
  locationCode: number,
  languageCode: string,
  trackingOptions?: Partial<CostTrackingOptions>,
) {
  return withCostTrackingRaw(
    () => _fetchLiveSerpItemsRaw(keyword, locationCode, languageCode),
    {
      endpoint: "serp/live",
      feature: "serp_live",
      ...trackingOptions,
    },
  );
}

// =============================================================================
// Batch Cost Tracking
// =============================================================================

/**
 * Record batch costs for multiple API calls.
 * Use this when processing multiple items in a single operation.
 *
 * @param calls - Array of API call results with costs
 * @param options - Base tracking options (applied to all calls)
 */
export function recordBatchCosts(
  calls: Array<{ costUsd: number; success: boolean; domain?: string; endpoint?: string }>,
  options: Omit<CostTrackingOptions, "domain" | "endpoint">,
): void {
  const tracker = getDfsCostTracker(db);

  for (const call of calls) {
    tracker
      .recordCost({
        url: call.endpoint || options.feature,
        domain: call.domain || "unknown",
        mode: "basic",
        usedStandardQueue: false,
        estimatedCost: call.costUsd,
        actualCost: call.costUsd,
        success: call.success,
        clientId: options.clientId,
        workspaceId: options.workspaceId,
        jobId: options.jobId,
        taskId: options.correlationId,
      })
      .catch((err) => {
        logger.error({ error: err instanceof Error ? err.message : String(err) }, "Failed to record batch cost");
      });
  }
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export type {
  BacklinksRequest,
  BacklinksListRequest,
  BacklinksTimeseriesRequest,
  DomainIntersectionInput,
  KeywordsForSiteInput,
  CompetitorsDomainInput,
};

// Re-export the cost tracker for direct access if needed
export { getDfsCostTracker, extractDomainFromUrl };

// Re-export pricing constants for reference
export {
  DFS_LABS_PRICING,
  DFS_BACKLINKS_PRICING,
  DFS_SERP_PRICING,
  DFS_ONPAGE_PRICING,
  ENDPOINT_PRICING,
};
