/**
 * SERP analyzer service for extracting competitor patterns.
 * Phase 36: Content Brief Generation
 */

import { fetchLiveSerpItemsRaw } from "@/server/lib/dataforseo";
import type { SerpLiveItem } from "@/server/lib/dataforseoSchemas";
import {
  buildSerpCacheKey,
  getCachedSerp,
  setCachedSerp,
} from "@/server/lib/cache/serp-cache";
import type { SerpAnalysisData } from "@/db/brief-schema";
import { analyzeSerpContent } from "./SerpContentAnalyzer";
import { db } from "@/db/index";
import {
  withBudgetCheck,
  BudgetExceededError,
  DFS_API_COSTS,
} from "@/server/features/scraping";

/**
 * Extract "People Also Ask" questions from SERP items.
 */
export function extractPAAQuestions(items: SerpLiveItem[]): string[] {
  return items
    .filter((item) => item.type === "people_also_ask")
    .map((item) => item.title)
    .filter((title): title is string => typeof title === "string");
}

/**
 * Extract common H2 headings from competitors.
 * NOTE: DataForSEO SERP API does not provide H2 extraction directly.
 * This would require:
 * - Using DataForSEO OnPage API to fetch full HTML
 * - Or fetching and parsing HTML ourselves with cheerio
 *
 * For MVP, returning empty array. Future enhancement: implement HTML parsing.
 */
export function extractCommonH2s(
  _items: SerpLiveItem[]
): { heading: string; frequency: number }[] {
  // TODO: Implement H2 extraction via OnPage API or HTML parsing
  return [];
}

/**
 * Calculate word count statistics from competitors.
 * NOTE: DataForSEO SERP API does not provide word count directly.
 * This would require:
 * - Using DataForSEO OnPage API with word_count field
 * - Or fetching and counting words ourselves
 *
 * For MVP, returning empty array. Future enhancement: implement word counting.
 */
export function calculateWordCountStats(_items: SerpLiveItem[]): {
  min: number;
  max: number;
  avg: number;
} {
  // TODO: Implement word count extraction via OnPage API
  return { min: 0, max: 0, avg: 0 };
}

/**
 * Calculate average meta title and description lengths from organic results.
 */
export function calculateMetaLengths(items: SerpLiveItem[]): {
  title: number;
  description: number;
} {
  const organicItems = items.filter((item) => item.type === "organic");

  if (organicItems.length === 0) {
    return { title: 0, description: 0 };
  }

  const titleLengths = organicItems
    .map((item) => item.title?.length ?? 0)
    .filter((length) => length > 0);

  const descriptionLengths = organicItems
    .map((item) => item.description?.length ?? 0)
    .filter((length) => length > 0);

  const avgTitle =
    titleLengths.length > 0
      ? Math.round(
          titleLengths.reduce((sum, len) => sum + len, 0) / titleLengths.length
        )
      : 0;

  const avgDescription =
    descriptionLengths.length > 0
      ? Math.round(
          descriptionLengths.reduce((sum, len) => sum + len, 0) /
            descriptionLengths.length
        )
      : 0;

  return { title: avgTitle, description: avgDescription };
}

/**
 * Analyze SERP for a keyword with caching and budget enforcement.
 * Extracts competitor patterns: PAA questions, meta lengths, H2s, word counts.
 *
 * @param clientId - Client ID for multi-tenant cache isolation
 * @param mappingId - Keyword mapping ID for cache key
 * @param keyword - Target keyword
 * @param locationCode - DataForSEO location code (default: 2840 = United States)
 * @param workspaceId - Workspace ID for budget enforcement (optional)
 * @throws BudgetExceededError if DataForSEO budget is exceeded
 */
/**
 * Result of SERP analysis including cost tracking.
 * P2.G16: Extended to include accumulated scraping costs.
 */
export interface SerpAnalysisResult {
  data: SerpAnalysisData;
  /** Total cost of SERP fetch + competitor content scraping in USD */
  totalCostUsd: number;
}

export async function analyzeSerpForKeyword(
  clientId: string,
  mappingId: string,
  keyword: string,
  locationCode: number = 2840,
  workspaceId?: string
): Promise<SerpAnalysisResult> {
  const cacheKey = buildSerpCacheKey(clientId, mappingId, keyword);

  // Check cache first
  const cached = await getCachedSerp(cacheKey);
  if (cached) {
    // P2.G16: Cached results have zero cost
    return { data: cached, totalCostUsd: 0 };
  }

  // Fetch SERP data from DataForSEO with budget pre-check (COST-1)
  const response = await withBudgetCheck(
    () => fetchLiveSerpItemsRaw(keyword, locationCode, "en"),
    DFS_API_COSTS.SERP_LIVE,
    db,
    { workspaceId }
  );
  const items = response.data;

  // P2.G16: Track SERP API cost
  const serpApiCost = response.billing?.costUsd ?? DFS_API_COSTS.SERP_LIVE;

  // Get organic URLs for content analysis
  const organicUrls = items
    .filter((item) => item.type === "organic" && item.url)
    .slice(0, 5)
    .map((item) => item.url as string);

  // Analyze competitor content (H2s and word counts)
  const contentAnalysis = await analyzeSerpContent(organicUrls);

  // Extract patterns
  const analysis: SerpAnalysisData = {
    commonH2s: contentAnalysis.commonH2s,
    paaQuestions: extractPAAQuestions(items),
    competitorWordCounts: contentAnalysis.wordCounts,
    metaLengths: calculateMetaLengths(items),
    analyzedAt: new Date().toISOString(),
    location: getLocationName(locationCode),
  };

  // Cache for 24h
  await setCachedSerp(cacheKey, analysis);

  // P2.G16: Return analysis with accumulated cost (SERP API + content scraping)
  const totalCostUsd = serpApiCost + contentAnalysis.totalCostUsd;
  return { data: analysis, totalCostUsd };
}

/**
 * Map location code to human-readable name.
 * Defaults to "United States" for code 2840.
 */
function getLocationName(locationCode: number): string {
  const locations: Record<number, string> = {
    2840: "United States",
    2826: "United Kingdom",
    2124: "Canada",
    2036: "Australia",
    // Add more as needed
  };
  return locations[locationCode] ?? `Location ${locationCode}`;
}
