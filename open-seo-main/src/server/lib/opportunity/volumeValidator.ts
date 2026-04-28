/**
 * Keyword volume validation and opportunity scoring.
 * Phase 29: AI Opportunity Discovery - Task 29-02/29-03
 *
 * Validates AI-generated keywords against DataForSEO search volume data,
 * filters zero-volume keywords, and calculates opportunity scores.
 */

import type { OpportunityKeyword } from "@/db/prospect-schema";
import type { GeneratedKeyword } from "./keywordGenerator";
import { fetchSearchVolumeRaw, type SearchVolumeItem } from "./dataforseoVolume";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "volume-validator" });

// Maximum keywords per DataForSEO request
const MAX_KEYWORDS_PER_BATCH = 1000;

// Default difficulty when not provided by API
const DEFAULT_DIFFICULTY = 50;

export interface KeywordVolumeResult {
  keyword: string;
  searchVolume: number;
  cpc: number;
  difficulty: number;
}

export interface VolumeValidationResult {
  volumeData: KeywordVolumeResult[];
  costUsd: number;
}

/**
 * Calculate opportunity score for a keyword.
 * Formula: searchVolume * cpc * (100 - difficulty) / 100
 *
 * Higher scores indicate better opportunities:
 * - High volume = more potential traffic
 * - High CPC = more valuable traffic
 * - Low difficulty = easier to rank
 *
 * @param searchVolume - Monthly search volume
 * @param cpc - Cost per click
 * @param difficulty - Keyword difficulty (0-100)
 * @returns Opportunity score (rounded integer)
 */
export function calculateOpportunityScore(
  searchVolume: number,
  cpc: number,
  difficulty: number,
): number {
  const difficultyMultiplier = (100 - difficulty) / 100;
  const score = searchVolume * cpc * difficultyMultiplier;
  return Math.round(score);
}

/**
 * Enrich generated keywords with volume metrics and calculate opportunity scores.
 *
 * @param keywords - AI-generated keywords with categories
 * @param volumeData - Volume data from DataForSEO
 * @returns OpportunityKeyword array sorted by opportunity score
 */
export function enrichKeywordsWithMetrics(
  keywords: GeneratedKeyword[],
  volumeData: KeywordVolumeResult[],
): OpportunityKeyword[] {
  // Create lookup map for volume data
  const volumeMap = new Map<string, KeywordVolumeResult>();
  for (const item of volumeData) {
    volumeMap.set(item.keyword.toLowerCase(), item);
  }

  const enrichedKeywords: OpportunityKeyword[] = [];

  for (const keyword of keywords) {
    const volume = volumeMap.get(keyword.keyword.toLowerCase());

    // Skip keywords not found or with zero volume
    if (!volume || volume.searchVolume === 0) {
      continue;
    }

    const opportunityScore = calculateOpportunityScore(
      volume.searchVolume,
      volume.cpc,
      volume.difficulty,
    );

    enrichedKeywords.push({
      keyword: keyword.keyword,
      category: keyword.category,
      searchVolume: volume.searchVolume,
      cpc: volume.cpc,
      difficulty: volume.difficulty,
      opportunityScore,
      source: "ai_generated",
    });
  }

  // Sort by opportunity score descending
  return enrichedKeywords.sort((a, b) => b.opportunityScore - a.opportunityScore);
}

// Default concurrency limit to prevent overwhelming the API
const DEFAULT_CONCURRENCY_LIMIT = 5;

/**
 * Validate keywords by fetching search volume data from DataForSEO.
 * Batches keywords in groups of 1000 (API limit) and processes batches
 * concurrently with configurable concurrency limit.
 *
 * @param keywords - AI-generated keywords to validate
 * @param locationCode - DataForSEO location code (e.g., 2840 for US)
 * @param languageCode - Language code (e.g., "en")
 * @param concurrencyLimit - Maximum concurrent batch requests (default: 5)
 * @returns Volume data for all keywords and total cost
 */
export async function validateKeywordVolumes(
  keywords: GeneratedKeyword[],
  locationCode: number,
  languageCode: string,
  concurrencyLimit: number = DEFAULT_CONCURRENCY_LIMIT,
): Promise<VolumeValidationResult> {
  if (keywords.length === 0) {
    return { volumeData: [], costUsd: 0 };
  }

  const keywordStrings = keywords.map((k) => k.keyword);

  // Create batches
  const batches: string[][] = [];
  for (let i = 0; i < keywordStrings.length; i += MAX_KEYWORDS_PER_BATCH) {
    batches.push(keywordStrings.slice(i, i + MAX_KEYWORDS_PER_BATCH));
  }

  // Process batches with concurrency limit
  const allVolumeData: KeywordVolumeResult[] = [];
  let totalCost = 0;

  // Process in chunks based on concurrency limit
  for (let i = 0; i < batches.length; i += concurrencyLimit) {
    const batchChunk = batches.slice(i, i + concurrencyLimit);

    const batchPromises = batchChunk.map(async (batch, chunkIndex) => {
      const batchIndex = i + chunkIndex;
      try {
        const response = await fetchSearchVolumeRaw({
          keywords: batch,
          locationCode,
          languageCode,
        });

        return {
          volumeData: response.data.map(transformVolumeItem),
          costUsd: response.billing.costUsd,
        };
      } catch (error) {
        log.error(
          "Failed to fetch search volume batch",
          error instanceof Error ? error : new Error(String(error)),
          { batchIndex, batchSize: batch.length },
        );
        throw error;
      }
    });

    const results = await Promise.all(batchPromises);

    // Aggregate results from this chunk
    for (const result of results) {
      allVolumeData.push(...result.volumeData);
      totalCost += result.costUsd;
    }
  }

  log.info("Keyword volumes validated", {
    keywordsRequested: keywords.length,
    volumeResultsReceived: allVolumeData.length,
    batchCount: batches.length,
    totalCost,
  });

  return {
    volumeData: allVolumeData,
    costUsd: totalCost,
  };
}

/**
 * Transform DataForSEO search volume item to our format.
 */
function transformVolumeItem(item: SearchVolumeItem): KeywordVolumeResult {
  return {
    keyword: item.keyword,
    searchVolume: item.search_volume ?? 0,
    cpc: item.cpc ?? 0,
    difficulty: item.keyword_info?.keyword_difficulty ?? DEFAULT_DIFFICULTY,
  };
}
