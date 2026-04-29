/**
 * DataForSEO API client for keyword metrics.
 *
 * Fetches keyword volume, difficulty, CPC, and competition
 * from DataForSEO keywords_data endpoint.
 *
 * Features:
 * - 60 second timeout (DataForSEO can be slow for large requests)
 * - Automatic retries with exponential backoff
 * - Circuit breaker to prevent cascading failures
 * - Redis-backed token bucket rate limiting (5 requests per second, shared across workers)
 */

import { dataForSeoClient, HttpError, TimeoutError } from "@/server/lib/http-client";
import { type DataforseoApiResponse, calculateApiCallCost } from "@/server/lib/dataforseoCost";
import {
  type LabsKeywordDataItem,
  type DomainRankedKeywordItem,
  type SerpLiveItem,
  type DomainMetricsItem,
  labsKeywordDataItemSchema,
  domainRankedKeywordItemSchema,
  serpSnapshotItemSchema,
  domainMetricsItemSchema,
  dataforseoResponseSchema,
  parseTaskItems,
} from "@/server/lib/dataforseoSchemas";
import { getDataForSEOHeaders } from "@/server/lib/dataforseo-auth";

// ============================================================================
// Redis-backed Rate Limiter for DataForSEO API
// ============================================================================

import { dataForSeoRateLimiter } from "@/server/lib/redis-rate-limiter";

/**
 * Redis-backed rate limiter for DataForSEO API calls.
 * 5 requests per second with burst capacity of 5.
 * Shared across all workers via Redis for consistent rate limiting.
 * Re-exported for use by other DataForSEO modules (e.g., scraper).
 */
export { dataForSeoRateLimiter };

// Re-export types for consumers
export type { LabsKeywordDataItem, DomainRankedKeywordItem, SerpLiveItem, DomainMetricsItem };

export interface KeywordMetric {
  keyword: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  competitionLevel: string;
}

interface DataForSEOResponse {
  status_code: number;
  status_message: string;
  tasks?: Array<{
    result?: Array<{
      keyword: string;
      search_volume?: number;
      cpc?: number;
      competition?: number;
      competition_level?: string;
    }>;
  }>;
}

/**
 * Fetch keyword metrics from DataForSEO.
 *
 * @param keywords - Array of keyword strings (max 1000)
 * @param location - Location code (e.g., 2440 for Lithuania)
 * @param language - Language code (e.g., "lt" for Lithuanian)
 * @returns Array of keyword metrics
 */
export async function fetchKeywordMetrics(
  keywords: string[],
  location: number,
  language: string
): Promise<KeywordMetric[]> {
  // Uses centralized auth from dataforseo-auth.ts
  // Throws if DATAFORSEO_API_KEY is not set
  const headers = getDataForSEOHeaders();

  // Wait for rate limit token before making API call
  await dataForSeoRateLimiter.acquire();

  try {
    const data = await dataForSeoClient.post<DataForSEOResponse>(
      "/v3/keywords_data/google_ads/search_volume/live",
      [
        {
          keywords,
          location_code: location,
          language_code: language,
        },
      ],
      {
        headers,
        timeout: 60000, // 60 second timeout for DataForSEO
        retries: 2,
      },
    );

    if (data.status_code !== 20000) {
      throw new Error(`DataForSEO error: ${data.status_message}`);
    }

    // Extract results from nested response
    const results: KeywordMetric[] = [];
    for (const task of data.tasks || []) {
      for (const resultItem of task.result || []) {
        results.push({
          keyword: resultItem.keyword,
          searchVolume: resultItem.search_volume || 0,
          cpc: resultItem.cpc || 0,
          competition: resultItem.competition || 0,
          competitionLevel: resultItem.competition_level || "unknown",
        });
      }
    }

    return results;
  } catch (error) {
    if (error instanceof HttpError) {
      throw new Error(`DataForSEO API error: ${error.status}`);
    }
    if (error instanceof TimeoutError) {
      throw new Error(`DataForSEO API timeout after ${error.timeoutMs}ms`);
    }
    throw error;
  }
}

// ============================================================================
// DataForSEO Labs API Functions
// ============================================================================

/**
 * Fetch related keywords from DataForSEO Labs API.
 */
export async function fetchRelatedKeywordsRaw(
  keyword: string,
  locationCode: number,
  languageCode: string,
  limit: number,
  depth?: number
): Promise<DataforseoApiResponse<LabsKeywordDataItem[]>> {
  await dataForSeoRateLimiter.acquire();
  const path = ["v3", "dataforseo_labs", "google", "related_keywords", "live"];
  const response = await dataForSeoClient.post<unknown>(
    `/${path.join("/")}`,
    [{ keyword, location_code: locationCode, language_code: languageCode, limit, depth }],
    { headers: getAuthHeaders(), timeout: 60000, retries: 2 }
  );
  const parsed = dataforseoResponseSchema.parse(response);
  const task = parsed.tasks?.[0];
  if (!task) throw new Error("No task returned from DataForSEO");
  const items = parseTaskItems("related_keywords", task, labsKeywordDataItemSchema);
  return { data: items, billing: calculateApiCallCost(path, task.cost) };
}

/**
 * Fetch keyword suggestions from DataForSEO Labs API.
 */
export async function fetchKeywordSuggestionsRaw(
  keyword: string,
  locationCode: number,
  languageCode: string,
  limit: number
): Promise<DataforseoApiResponse<LabsKeywordDataItem[]>> {
  await dataForSeoRateLimiter.acquire();
  const path = ["v3", "dataforseo_labs", "google", "keyword_suggestions", "live"];
  const response = await dataForSeoClient.post<unknown>(
    `/${path.join("/")}`,
    [{ keyword, location_code: locationCode, language_code: languageCode, limit }],
    { headers: getAuthHeaders(), timeout: 60000, retries: 2 }
  );
  const parsed = dataforseoResponseSchema.parse(response);
  const task = parsed.tasks?.[0];
  if (!task) throw new Error("No task returned from DataForSEO");
  const items = parseTaskItems("keyword_suggestions", task, labsKeywordDataItemSchema);
  return { data: items, billing: calculateApiCallCost(path, task.cost) };
}

/**
 * Fetch keyword ideas from DataForSEO Labs API.
 */
export async function fetchKeywordIdeasRaw(
  keyword: string,
  locationCode: number,
  languageCode: string,
  limit: number
): Promise<DataforseoApiResponse<LabsKeywordDataItem[]>> {
  await dataForSeoRateLimiter.acquire();
  const path = ["v3", "dataforseo_labs", "google", "keyword_ideas", "live"];
  const response = await dataForSeoClient.post<unknown>(
    `/${path.join("/")}`,
    [{ keyword, location_code: locationCode, language_code: languageCode, limit }],
    { headers: getAuthHeaders(), timeout: 60000, retries: 2 }
  );
  const parsed = dataforseoResponseSchema.parse(response);
  const task = parsed.tasks?.[0];
  if (!task) throw new Error("No task returned from DataForSEO");
  const items = parseTaskItems("keyword_ideas", task, labsKeywordDataItemSchema);
  return { data: items, billing: calculateApiCallCost(path, task.cost) };
}

/**
 * Fetch domain rank overview from DataForSEO Labs API.
 */
export async function fetchDomainRankOverviewRaw(
  target: string,
  locationCode: number,
  languageCode: string
): Promise<DataforseoApiResponse<DomainMetricsItem[]>> {
  await dataForSeoRateLimiter.acquire();
  const path = ["v3", "dataforseo_labs", "google", "domain_rank_overview", "live"];
  const response = await dataForSeoClient.post<unknown>(
    `/${path.join("/")}`,
    [{ target, location_code: locationCode, language_code: languageCode }],
    { headers: getAuthHeaders(), timeout: 60000, retries: 2 }
  );
  const parsed = dataforseoResponseSchema.parse(response);
  const task = parsed.tasks?.[0];
  if (!task) throw new Error("No task returned from DataForSEO");
  const items = parseTaskItems("domain_rank_overview", task, domainMetricsItemSchema);
  return { data: items, billing: calculateApiCallCost(path, task.cost) };
}

/**
 * Fetch ranked keywords for a domain from DataForSEO Labs API.
 */
export async function fetchRankedKeywordsRaw(
  target: string,
  locationCode: number,
  languageCode: string,
  limit: number,
  orderBy?: string[]
): Promise<DataforseoApiResponse<DomainRankedKeywordItem[]>> {
  await dataForSeoRateLimiter.acquire();
  const path = ["v3", "dataforseo_labs", "google", "ranked_keywords", "live"];
  const response = await dataForSeoClient.post<unknown>(
    `/${path.join("/")}`,
    [{ target, location_code: locationCode, language_code: languageCode, limit, order_by: orderBy }],
    { headers: getAuthHeaders(), timeout: 60000, retries: 2 }
  );
  const parsed = dataforseoResponseSchema.parse(response);
  const task = parsed.tasks?.[0];
  if (!task) throw new Error("No task returned from DataForSEO");
  const items = parseTaskItems("ranked_keywords", task, domainRankedKeywordItemSchema);
  return { data: items, billing: calculateApiCallCost(path, task.cost) };
}

// ============================================================================
// DataForSEO SERP API Functions
// ============================================================================

/**
 * Fetch live SERP items from DataForSEO SERP API.
 */
export async function fetchLiveSerpItemsRaw(
  keyword: string,
  locationCode: number,
  languageCode: string
): Promise<DataforseoApiResponse<SerpLiveItem[]>> {
  await dataForSeoRateLimiter.acquire();
  const path = ["v3", "serp", "google", "organic", "live", "regular"];
  const response = await dataForSeoClient.post<unknown>(
    `/${path.join("/")}`,
    [{ keyword, location_code: locationCode, language_code: languageCode, depth: 100 }],
    { headers: getAuthHeaders(), timeout: 60000, retries: 2 }
  );
  const parsed = dataforseoResponseSchema.parse(response);
  const task = parsed.tasks?.[0];
  if (!task) throw new Error("No task returned from DataForSEO");
  const items = parseTaskItems("serp_live", task, serpSnapshotItemSchema);
  return { data: items, billing: calculateApiCallCost(path, task.cost) };
}

// ============================================================================
// DataForSEO On-Page API Functions
// ============================================================================

export interface OnPageInstantPageResult {
  url: string;
  status_code: number;
  fetch_html?: string;
}

/**
 * Fetch instant pages from DataForSEO On-Page API.
 * Retrieves HTML content for multiple URLs in a single API call.
 */
export async function fetchOnPageInstantPages(
  urls: string[]
): Promise<OnPageInstantPageResult[]> {
  await dataForSeoRateLimiter.acquire();
  const path = ["v3", "on_page", "instant_pages"];
  const response = await dataForSeoClient.post<unknown>(
    `/${path.join("/")}`,
    urls.map((url) => ({ url, enable_javascript: false, custom_js: null })),
    { headers: getAuthHeaders(), timeout: 120000, retries: 1 }
  );
  const parsed = dataforseoResponseSchema.parse(response);

  const results: OnPageInstantPageResult[] = [];
  for (const task of parsed.tasks ?? []) {
    for (const result of task.result ?? []) {
      const item = result as { url?: string; status_code?: number; fetch_html?: string };
      if (item.url) {
        results.push({
          url: item.url,
          status_code: item.status_code ?? 0,
          fetch_html: item.fetch_html,
        });
      }
    }
  }
  return results;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getAuthHeaders(): Record<string, string> {
  // Delegate to centralized auth module
  // Throws if DATAFORSEO_API_KEY is not set
  return getDataForSEOHeaders();
}
