/**
 * DataForSEO API wrappers for keyword gap analysis.
 * Phase 28: Keyword Gap Analysis
 *
 * This module provides the domain intersection endpoint to identify keywords
 * where competitors rank but the target domain doesn't - keyword gaps.
 *
 * Endpoint: /v3/dataforseo_labs/google/domain_intersection/live
 * Cost: ~$0.02-0.05 per request
 */
import type { DataforseoApiResponse } from "@/server/lib/dataforseoCost";
import { AppError } from "@/server/lib/errors";
import {
  dataforseoResponseSchema,
  domainIntersectionItemSchema,
  type DomainIntersectionItem,
} from "@/server/lib/dataforseoSchemas";
import type { KeywordGap } from "@/db/prospect-schema";

// ---------------------------------------------------------------------------
// SDK client (uses centralized auth from dataforseo-auth.ts)
// ---------------------------------------------------------------------------

import { createDataForSEOFetch } from "@/server/lib/dataforseo-auth";

const API_BASE = "https://api.dataforseo.com";

// Use centralized auth - throws if DATAFORSEO_API_KEY is not set
const createAuthenticatedFetch = createDataForSEOFetch;

async function postDataforseo(
  path: string,
  payload: unknown,
): Promise<unknown> {
  const authenticatedFetch = createAuthenticatedFetch();
  const response = await authenticatedFetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO HTTP ${response.status} on ${path}. Response: ${rawText.slice(0, 500)}`,
    );
  }

  try {
    return JSON.parse(rawText);
  } catch {
    throw new AppError(
      "INTERNAL_ERROR",
      `DataForSEO ${path} returned non-JSON response`,
    );
  }
}

// ---------------------------------------------------------------------------
// Response helpers (reuse pattern from dataforseoProspect.ts)
// ---------------------------------------------------------------------------

function assertOk(response: unknown): {
  path: string[];
  cost: number;
  result_count: number | null;
  result: unknown[];
} {
  const parsed = dataforseoResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new AppError("INTERNAL_ERROR", "DataForSEO response parse failed");
  }

  const data = parsed.data;
  if (data.status_code !== 20000) {
    throw new AppError(
      "INTERNAL_ERROR",
      data.status_message || "DataForSEO request failed",
    );
  }

  const task = data.tasks?.[0];
  if (!task) {
    throw new AppError("INTERNAL_ERROR", "DataForSEO response missing task");
  }
  if (task.status_code !== 20000) {
    throw new AppError(
      "INTERNAL_ERROR",
      task.status_message || "DataForSEO task failed",
    );
  }

  return {
    path: task.path ?? [],
    cost: task.cost ?? 0,
    result_count: task.result_count ?? null,
    result: task.result ?? [],
  };
}

function buildTaskBilling(task: {
  path: string[];
  cost: number;
  result_count: number | null;
}) {
  return {
    path: task.path,
    costUsd: task.cost,
    resultCount: task.result_count,
  };
}

// ---------------------------------------------------------------------------
// Domain Intersection API
// /v3/dataforseo_labs/google/domain_intersection/live
// ---------------------------------------------------------------------------

export interface DomainIntersectionInput {
  target1: string; // Competitor domain (has the keywords)
  target2: string; // Target domain (missing the keywords - your prospect)
  locationCode: number;
  languageCode: string;
  limit?: number;
  onlyMissingInTarget2?: boolean; // Default true - only return gaps
}

/**
 * Fetch keywords where target1 (competitor) ranks but target2 (prospect) doesn't.
 * This identifies keyword gaps - opportunities for the prospect.
 *
 * @param input - Two domains to compare and location/language settings
 * @returns Keyword gaps with ranking data and billing info
 *
 * Cost: ~$0.02-0.05 depending on result count
 *
 * @see https://docs.dataforseo.com/v3/dataforseo_labs/google/domain_intersection/live
 */
export async function fetchDomainIntersectionRaw(
  input: DomainIntersectionInput,
): Promise<DataforseoApiResponse<KeywordGap[]>> {
  const responseRaw = await postDataforseo(
    "/v3/dataforseo_labs/google/domain_intersection/live",
    [
      {
        target1: input.target1,
        target2: input.target2,
        location_code: input.locationCode,
        language_code: input.languageCode,
        limit: input.limit ?? 100,
        include_serp_info: false, // Don't need full SERP data for gap analysis
        intersections_mode: "missing_keywords_in_domain_2", // Only return gaps
      },
    ],
  );

  const task = assertOk(responseRaw);

  // Parse items from result array and transform to KeywordGap format
  const gaps: KeywordGap[] = [];
  for (const resultItem of task.result) {
    if (
      resultItem &&
      typeof resultItem === "object" &&
      "items" in resultItem &&
      Array.isArray((resultItem as { items?: unknown[] }).items)
    ) {
      for (const item of (resultItem as { items: unknown[] }).items) {
        const parsed = domainIntersectionItemSchema.safeParse(item);
        if (parsed.success) {
          const data = parsed.data;

          // Only include if target2 doesn't rank (this is the gap)
          const target2Ranks = data.domain_2_ranked_serp_element?.rank_absolute;
          if (input.onlyMissingInTarget2 !== false && target2Ranks) {
            // Skip - target already ranks for this keyword
            continue;
          }

          const keyword = data.keyword_data?.keyword;
          const searchVolume = data.keyword_data?.keyword_info?.search_volume ?? 0;
          const cpc = data.keyword_data?.keyword_info?.cpc ?? 0;
          const difficulty = data.keyword_data?.keyword_properties?.keyword_difficulty ?? 0;
          const competitorPosition = data.domain_1_ranked_serp_element?.rank_absolute ?? 0;

          if (keyword) {
            const gap: KeywordGap = {
              keyword,
              competitorDomain: input.target1,
              competitorPosition,
              searchVolume,
              cpc,
              difficulty,
              trafficPotential: calculateOpportunityScore({
                keyword,
                competitorDomain: input.target1,
                competitorPosition,
                searchVolume,
                cpc,
                difficulty,
                trafficPotential: 0, // Will be calculated
              }),
            };
            gaps.push(gap);
          }
        }
      }
    }
  }

  return {
    data: gaps,
    billing: buildTaskBilling(task),
  };
}

/**
 * Calculate opportunity score for a keyword gap.
 *
 * Formula: searchVolume * cpc * (100 - difficulty) / 100
 *
 * This weights high-volume, high-value keywords while penalizing difficulty.
 * A keyword with 10k volume, $5 CPC, and 30 difficulty scores:
 * 10000 * 5 * (100-30)/100 = 10000 * 5 * 0.7 = 35000
 *
 * @param gap - Keyword gap to score
 * @returns Traffic potential score (higher is better opportunity)
 */
export function calculateOpportunityScore(gap: KeywordGap): number {
  const { searchVolume, cpc, difficulty } = gap;

  // Edge cases
  if (searchVolume <= 0 || cpc <= 0) return 0;
  if (difficulty >= 100) return 0;

  // Calculate score
  const difficultyFactor = (100 - difficulty) / 100;
  return Math.round(searchVolume * cpc * difficultyFactor);
}

// ---------------------------------------------------------------------------
// Achievability scoring (Phase 28-02)
// ---------------------------------------------------------------------------

/**
 * Extended KeywordGap type with achievability score.
 */
export interface KeywordGapWithAchievability extends KeywordGap {
  achievability: number;
}

/**
 * Calculate achievability score for a keyword based on domain authority.
 *
 * Formula: 100 - max(0, difficulty - domainAuthority)
 *
 * This measures how realistic it is for a domain to rank for a keyword.
 * A domain with DA 50 can tackle difficulty 40 keywords easily (score 100),
 * but a DA 30 domain facing difficulty 60 keywords scores 70.
 *
 * Examples:
 * - DA 50, Difficulty 40 → 100 - max(0, 40-50) = 100 (easy target)
 * - DA 30, Difficulty 60 → 100 - max(0, 60-30) = 70 (achievable with effort)
 * - DA 20, Difficulty 80 → 100 - max(0, 80-20) = 40 (challenging)
 * - DA 10, Difficulty 10 → 100 - max(0, 10-10) = 100 (easy target)
 *
 * @param difficulty - Keyword difficulty (0-100)
 * @param domainAuthority - Domain Authority / Domain Rank (0-100)
 * @returns Achievability score (0-100, higher = more achievable)
 */
export function calculateAchievability(
  difficulty: number,
  domainAuthority: number,
): number {
  // Higher DA = can tackle harder keywords
  // DA 50, Difficulty 40 → achievability = 100 - max(0, 40-50) = 100
  // DA 30, Difficulty 60 → achievability = 100 - max(0, 60-30) = 70
  return 100 - Math.max(0, difficulty - domainAuthority);
}

/**
 * Enrich keyword gaps with achievability scores based on domain authority.
 *
 * @param gaps - Array of keyword gaps to enrich
 * @param domainAuthority - The prospect's Domain Authority / Domain Rank
 * @returns Keyword gaps with achievability scores added
 */
export function enrichGapsWithAchievability(
  gaps: KeywordGap[],
  domainAuthority: number,
): KeywordGapWithAchievability[] {
  return gaps.map((gap) => ({
    ...gap,
    achievability: calculateAchievability(gap.difficulty, domainAuthority),
  }));
}

// ---------------------------------------------------------------------------
// Keyword Classification (Phase 28-04)
// ---------------------------------------------------------------------------

/**
 * Keyword classification categories for prioritization
 */
export type KeywordClassification = "quick_win" | "strategic" | "long_tail" | "standard";

/**
 * Extended KeywordGap type with classification
 */
export interface ClassifiedKeywordGap extends KeywordGapWithAchievability {
  classification: KeywordClassification;
}

/**
 * Classify a keyword gap based on difficulty, search volume, and achievability.
 *
 * Categories:
 * - Quick Win: difficulty < 30 AND searchVolume > 100 AND achievability > 70
 * - Strategic: difficulty 30-60 AND searchVolume > 500
 * - Long Tail: searchVolume < 100
 * - Standard: everything else
 *
 * @param gap - Keyword gap with achievability score
 * @returns Classification category
 */
export function classifyKeywordGap(gap: KeywordGapWithAchievability): KeywordClassification {
  const { difficulty, searchVolume, achievability } = gap;

  // Quick Win: easy to rank, decent volume, highly achievable
  if (difficulty < 30 && searchVolume > 100 && achievability > 70) {
    return "quick_win";
  }

  // Strategic: medium difficulty, high volume
  if (difficulty >= 30 && difficulty <= 60 && searchVolume > 500) {
    return "strategic";
  }

  // Long Tail: low volume keywords
  if (searchVolume < 100) {
    return "long_tail";
  }

  // Standard: everything else
  return "standard";
}

/**
 * Enrich keyword gaps with classification based on achievability.
 *
 * @param gaps - Array of keyword gaps with achievability
 * @returns Keyword gaps with classification added
 */
export function classifyKeywordGaps(
  gaps: KeywordGapWithAchievability[]
): ClassifiedKeywordGap[] {
  return gaps.map((gap) => ({
    ...gap,
    classification: classifyKeywordGap(gap),
  }));
}

/**
 * Filter gaps to only Quick Wins
 */
export function filterQuickWins(gaps: KeywordGapWithAchievability[]): KeywordGapWithAchievability[] {
  return gaps.filter((gap) => classifyKeywordGap(gap) === "quick_win");
}

// Re-export types
export type { DomainIntersectionItem };
