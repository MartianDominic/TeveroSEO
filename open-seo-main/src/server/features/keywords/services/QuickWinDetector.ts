/**
 * QuickWinDetector Service
 * Phase 43-04: Prioritization Engine + UI
 *
 * Detects quick win opportunities in keyword data:
 * - Striking Distance: Position 11-30, volume >= 200, competition <= 0.7 -> 1.3x
 * - Low Hanging Fruit: Position 4-10, competition <= 0.5, volume >= 100 -> 1.2x
 * - Fresh Opportunity: Not ranking, relevance >= 0.9, volume >= 500, competition <= 0.4 -> 1.15x
 */

import type {
  ProspectKeywordSelect,
  QuickWinType,
} from "@/db/prospect-keyword-schema";

export interface QuickWinCriteria {
  strikingDistance: {
    positionMin: number;
    positionMax: number;
    volumeMin: number;
    competitionMax: number;
    multiplier: number;
  };
  lowHanging: {
    positionMin: number;
    positionMax: number;
    competitionMax: number;
    volumeMin: number;
    multiplier: number;
  };
  freshOpportunity: {
    relevanceMin: number;
    volumeMin: number;
    competitionMax: number;
    multiplier: number;
  };
}

export const DEFAULT_QUICK_WIN_CRITERIA: QuickWinCriteria = {
  strikingDistance: {
    positionMin: 11,
    positionMax: 30,
    volumeMin: 200,
    competitionMax: 0.7,
    multiplier: 1.3,
  },
  lowHanging: {
    positionMin: 4,
    positionMax: 10,
    competitionMax: 0.5,
    volumeMin: 100,
    multiplier: 1.2,
  },
  freshOpportunity: {
    relevanceMin: 0.9,
    volumeMin: 500,
    competitionMax: 0.4,
    multiplier: 1.15,
  },
};

export interface QuickWinResult {
  type: QuickWinType | null;
  multiplier: number;
}

export class QuickWinDetector {
  private criteria: QuickWinCriteria;

  constructor(criteria: QuickWinCriteria = DEFAULT_QUICK_WIN_CRITERIA) {
    this.criteria = criteria;
  }

  /**
   * Detect quick win type for a keyword.
   * Returns the highest-value quick win if multiple criteria match.
   */
  detect(keyword: {
    currentPosition: number | null;
    searchVolume: number | null;
    competition: number | null;
    relevanceScore: number | null;
  }): QuickWinResult {
    const candidates: QuickWinResult[] = [];

    // Check Striking Distance (highest value: 1.3x)
    if (this.isStrikingDistance(keyword)) {
      candidates.push({
        type: "striking_distance",
        multiplier: this.criteria.strikingDistance.multiplier,
      });
    }

    // Check Low Hanging Fruit (1.2x)
    if (this.isLowHanging(keyword)) {
      candidates.push({
        type: "low_hanging",
        multiplier: this.criteria.lowHanging.multiplier,
      });
    }

    // Check Fresh Opportunity (1.15x)
    if (this.isFreshOpportunity(keyword)) {
      candidates.push({
        type: "fresh_opportunity",
        multiplier: this.criteria.freshOpportunity.multiplier,
      });
    }

    // Return highest multiplier (or no quick win)
    if (candidates.length === 0) {
      return { type: null, multiplier: 1.0 };
    }

    candidates.sort((a, b) => b.multiplier - a.multiplier);
    return candidates[0];
  }

  /**
   * Detect quick wins for multiple keywords.
   * Returns a Map keyed by keyword ID.
   */
  detectBatch(keywords: ProspectKeywordSelect[]): Map<string, QuickWinResult> {
    const results = new Map<string, QuickWinResult>();

    for (const kw of keywords) {
      results.set(
        kw.id,
        this.detect({
          currentPosition: kw.currentPosition,
          searchVolume: kw.searchVolume,
          competition: kw.competition,
          relevanceScore: kw.relevanceScore,
        })
      );
    }

    return results;
  }

  /**
   * Striking Distance: Position 11-30, volume >= 200, competition <= 0.7
   */
  private isStrikingDistance(keyword: {
    currentPosition: number | null;
    searchVolume: number | null;
    competition: number | null;
  }): boolean {
    const { positionMin, positionMax, volumeMin, competitionMax } =
      this.criteria.strikingDistance;

    return (
      keyword.currentPosition !== null &&
      keyword.currentPosition >= positionMin &&
      keyword.currentPosition <= positionMax &&
      (keyword.searchVolume ?? 0) >= volumeMin &&
      (keyword.competition ?? 1) <= competitionMax
    );
  }

  /**
   * Low Hanging Fruit: Position 4-10, competition <= 0.5, volume >= 100
   */
  private isLowHanging(keyword: {
    currentPosition: number | null;
    searchVolume: number | null;
    competition: number | null;
  }): boolean {
    const { positionMin, positionMax, competitionMax, volumeMin } =
      this.criteria.lowHanging;

    return (
      keyword.currentPosition !== null &&
      keyword.currentPosition >= positionMin &&
      keyword.currentPosition <= positionMax &&
      (keyword.competition ?? 1) <= competitionMax &&
      (keyword.searchVolume ?? 0) >= volumeMin
    );
  }

  /**
   * Fresh Opportunity: Not ranking, relevance >= 0.9, volume >= 500, competition <= 0.4
   */
  private isFreshOpportunity(keyword: {
    currentPosition: number | null;
    searchVolume: number | null;
    competition: number | null;
    relevanceScore: number | null;
  }): boolean {
    const { relevanceMin, volumeMin, competitionMax } =
      this.criteria.freshOpportunity;

    return (
      keyword.currentPosition === null && // Not ranking
      (keyword.relevanceScore ?? 0) >= relevanceMin &&
      (keyword.searchVolume ?? 0) >= volumeMin &&
      (keyword.competition ?? 1) <= competitionMax
    );
  }
}

export const quickWinDetector = new QuickWinDetector();
