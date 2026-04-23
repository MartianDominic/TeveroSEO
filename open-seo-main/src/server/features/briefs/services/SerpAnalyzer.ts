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
 * Analyze SERP for a keyword with caching.
 * Extracts competitor patterns: PAA questions, meta lengths.
 *
 * @param mappingId - Keyword mapping ID for cache key
 * @param keyword - Target keyword
 * @param locationCode - DataForSEO location code (default: 2840 = United States)
 */
export async function analyzeSerpForKeyword(
  mappingId: string,
  keyword: string,
  locationCode: number = 2840
): Promise<SerpAnalysisData> {
  const cacheKey = buildSerpCacheKey(mappingId, keyword);

  // Check cache first
  const cached = await getCachedSerp(cacheKey);
  if (cached) {
    return cached;
  }

  // Fetch from DataForSEO
  const response = await fetchLiveSerpItemsRaw(keyword, locationCode, "en");

  const task = response.tasks[0];
  if (!task || task.status_code !== 20000) {
    throw new Error(
      `DataForSEO SERP task failed: ${task?.status_message || "Unknown error"}`
    );
  }

  const items = task.result?.[0]?.items ?? [];

  // Extract patterns
  const analysis: SerpAnalysisData = {
    commonH2s: extractCommonH2s(items),
    paaQuestions: extractPAAQuestions(items),
    competitorWordCounts: [], // TODO: Implement via OnPage API
    metaLengths: calculateMetaLengths(items),
    analyzedAt: new Date().toISOString(),
    location: getLocationName(locationCode),
  };

  // Cache for 24h
  await setCachedSerp(cacheKey, analysis);

  return analysis;
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
