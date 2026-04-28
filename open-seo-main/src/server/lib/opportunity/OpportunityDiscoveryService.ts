/**
 * Opportunity Discovery Service
 * Phase 29: AI Opportunity Discovery
 *
 * Orchestrates the full workflow:
 * 1. Generate keywords from business info using AI
 * 2. Validate keywords with DataForSEO volume data
 * 3. Calculate opportunity scores
 * 4. Return ranked, categorized opportunities
 */

import type { OpportunityKeyword, OpportunityKeywordCategory, KeywordClass } from "@/db/prospect-schema";
import type { BusinessInfo } from "@/server/lib/scraper/businessExtractor";
import { generateKeywordOpportunities } from "./keywordGenerator";
import { validateKeywordVolumes, enrichKeywordsWithMetrics } from "./volumeValidator";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "opportunity-discovery" });

export interface DiscoverOpportunitiesInput {
  businessInfo: BusinessInfo | null;
  locationCode: number;
  languageCode: string;
}

export interface CategorySummary {
  product: number;
  brand: number;
  service: number;
  commercial: number;
  informational: number;
}

export interface OpportunitySummary {
  totalKeywords: number;
  totalVolume: number;
  avgOpportunityScore: number;
  byCategory: CategorySummary;
}

export interface DiscoverOpportunitiesResult {
  keywords: OpportunityKeyword[];
  summary: OpportunitySummary;
  costUsd: number;
}

export const OpportunityDiscoveryService = {
  /**
   * Discover keyword opportunities from business information.
   *
   * @param input - Business info and location/language settings
   * @returns Ranked keyword opportunities with summary stats
   */
  async discoverOpportunities(
    input: DiscoverOpportunitiesInput,
  ): Promise<DiscoverOpportunitiesResult> {
    const { businessInfo, locationCode, languageCode } = input;

    // Return empty result if no business info
    if (!businessInfo || !hasBusinessData(businessInfo)) {
      log.info("No business info available for opportunity discovery");
      return {
        keywords: [],
        summary: getEmptySummary(),
        costUsd: 0,
      };
    }

    log.info("Starting opportunity discovery", {
      products: businessInfo.products.length,
      brands: businessInfo.brands.length,
      services: businessInfo.services.length,
      location: businessInfo.location,
      languageCode,
    });

    // Step 1: Generate keywords using AI
    const generatedKeywords = await generateKeywordOpportunities({
      products: businessInfo.products,
      brands: businessInfo.brands,
      services: businessInfo.services,
      location: businessInfo.location,
      targetMarket: businessInfo.targetMarket,
      language: languageCode,
    });

    if (generatedKeywords.length === 0) {
      log.warn("No keywords generated from business info");
      return {
        keywords: [],
        summary: getEmptySummary(),
        costUsd: 0,
      };
    }

    log.info("Keywords generated", { count: generatedKeywords.length });

    // Step 2: Validate with DataForSEO
    const { volumeData, costUsd } = await validateKeywordVolumes(
      generatedKeywords,
      locationCode,
      languageCode,
    );

    // Step 3: Enrich with metrics and calculate scores
    const enrichedKeywords = enrichKeywordsWithMetrics(generatedKeywords, volumeData);

    // Step 4: Apply classification
    const classifiedKeywords = classifyKeywords(enrichedKeywords);

    // Step 6: Calculate summary
    const summary = this.calculateSummary(classifiedKeywords);

    log.info("Opportunity discovery complete", {
      keywordsGenerated: generatedKeywords.length,
      keywordsValidated: enrichedKeywords.length,
      totalVolume: summary.totalVolume,
      costUsd,
    });

    return {
      keywords: classifiedKeywords,
      summary,
      costUsd,
    };
  },

  /**
   * Calculate summary statistics for opportunity keywords.
   */
  calculateSummary(keywords: OpportunityKeyword[]): OpportunitySummary {
    if (keywords.length === 0) {
      return getEmptySummary();
    }

    const totalVolume = keywords.reduce((sum, k) => sum + k.searchVolume, 0);
    const totalScore = keywords.reduce((sum, k) => sum + k.opportunityScore, 0);

    return {
      totalKeywords: keywords.length,
      totalVolume,
      avgOpportunityScore: Math.round(totalScore / keywords.length),
      byCategory: this.getCategorySummary(keywords),
    };
  },

  /**
   * Get count of keywords by category.
   */
  getCategorySummary(keywords: OpportunityKeyword[]): CategorySummary {
    const counts: CategorySummary = {
      product: 0,
      brand: 0,
      service: 0,
      commercial: 0,
      informational: 0,
    };

    for (const keyword of keywords) {
      counts[keyword.category]++;
    }

    return counts;
  },
};

/**
 * Check if business info has any usable data.
 */
function hasBusinessData(info: BusinessInfo): boolean {
  return (
    info.products.length > 0 ||
    info.brands.length > 0 ||
    info.services.length > 0
  );
}

/**
 * Get empty summary object.
 */
function getEmptySummary(): OpportunitySummary {
  return {
    totalKeywords: 0,
    totalVolume: 0,
    avgOpportunityScore: 0,
    byCategory: {
      product: 0,
      brand: 0,
      service: 0,
      commercial: 0,
      informational: 0,
    },
  };
}

/**
 * Classify a keyword based on difficulty, volume, and achievability.
 * Phase 29-04: Keyword Classification Algorithm
 *
 * Classification rules:
 * - quick_win: Low difficulty (<30), decent volume (>100), high achievability (>70)
 * - strategic: Medium difficulty (30-60), high volume (>500)
 * - long_tail: Everything else (typically low volume, high difficulty, or low achievability)
 */
export function classifyOpportunityKeyword(keyword: OpportunityKeyword): KeywordClass {
  const { searchVolume, difficulty, achievability = 50 } = keyword;

  // Quick wins: easy to rank, reasonable volume, high achievability
  if (difficulty < 30 && searchVolume > 100 && achievability > 70) {
    return "quick_win";
  }

  // Strategic: medium difficulty but high volume worth the effort
  if (difficulty >= 30 && difficulty <= 60 && searchVolume > 500) {
    return "strategic";
  }

  // Long tail: everything else
  return "long_tail";
}

/**
 * Apply classification to all keywords in a list.
 */
export function classifyKeywords(keywords: OpportunityKeyword[]): OpportunityKeyword[] {
  return keywords.map((keyword) => ({
    ...keyword,
    classification: classifyOpportunityKeyword(keyword),
  }));
}
