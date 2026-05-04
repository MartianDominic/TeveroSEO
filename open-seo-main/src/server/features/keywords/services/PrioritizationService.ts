/**
 * PrioritizationService
 * Phase 43-04: Prioritization Engine + UI
 *
 * Multi-factor keyword scoring with 5 weighted factors:
 * - Volume (0.15), Competition (0.10), Relevance (0.25), Focus (0.35), Position (0.15)
 *
 * Tier thresholds: Must-Do >= 0.75, Should-Do >= 0.50, Nice-to-Have >= 0.25, Ignore < 0.25
 *
 * Phase 77: Geographic Intelligence Integration
 * - Geo weight: 0.15 (configurable)
 * - Geo filtering: excluded keywords get score=0, tier="excluded"
 */

import { db } from "@/db";
import {
  prospectKeywords,
  type KeywordTier,
} from "@/db/prospect-keyword-schema";
import { eq, inArray } from "drizzle-orm";
import { quickWinDetector } from "./QuickWinDetector";
import { geoClassifier } from "../geo";
import type { GeoConstraints, GeoClassification } from "../geo/types";

export interface ScoreWeights {
  volume: number; // Default: 0.15
  competition: number; // Default: 0.10
  relevance: number; // Default: 0.25
  focus: number; // Default: 0.35
  position: number; // Default: 0.15
  geo: number; // Default: 0.15 (Phase 77)
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  volume: 0.15,
  competition: 0.1,
  relevance: 0.25,
  focus: 0.35,
  position: 0.15,
  geo: 0.15, // Phase 77: Geographic Intelligence
};

export interface TierThresholds {
  mustDo: number; // Default: 0.75
  shouldDo: number; // Default: 0.50
  niceToHave: number; // Default: 0.25
}

export const DEFAULT_THRESHOLDS: TierThresholds = {
  mustDo: 0.75,
  shouldDo: 0.5,
  niceToHave: 0.25,
};

export interface PrioritizationResult {
  keywordsProcessed: number;
  tierCounts: Record<KeywordTier, number>;
  quickWinCounts: {
    strikingDistance: number;
    lowHanging: number;
    freshOpportunity: number;
  };
}

// Phase 77: Individual keyword prioritization result
export interface KeywordPrioritizationResult {
  keyword: string;
  compositeScore: number;
  tier: KeywordTier;
  searchVolume: number | null;
  competition: number | null;
  relevanceScore: number | null;
  currentPosition: number | null;
  geoClassification?: GeoClassification; // Phase 77
}

export class PrioritizationService {
  private weights: ScoreWeights;
  private thresholds: TierThresholds;

  constructor(
    weights: ScoreWeights = DEFAULT_WEIGHTS,
    thresholds: TierThresholds = DEFAULT_THRESHOLDS
  ) {
    this.weights = weights;
    this.thresholds = thresholds;
  }

  /**
   * Compute composite score for a single keyword.
   * Uses 5 weighted factors plus quick win multiplier.
   */
  computeCompositeScore(
    keyword: {
      searchVolume: number | null;
      competition: number | null;
      relevanceScore: number | null;
      currentPosition: number | null;
    },
    focusScore: number = 0.5
  ): number {
    // Normalize factors to 0-1 scale
    const volumeScore = this.normalizeVolume(keyword.searchVolume ?? 0);
    const competitionScore = 1 - (keyword.competition ?? 0.5); // Lower is better
    const relevanceScore = keyword.relevanceScore ?? 0.5;
    const positionScore = this.normalizePosition(keyword.currentPosition);

    // Compute weighted sum
    const baseScore =
      volumeScore * this.weights.volume +
      competitionScore * this.weights.competition +
      relevanceScore * this.weights.relevance +
      focusScore * this.weights.focus +
      positionScore * this.weights.position;

    // Apply quick win multiplier
    const quickWin = quickWinDetector.detect(keyword);
    const finalScore = baseScore * quickWin.multiplier;

    // Clamp to 0-1
    return Math.min(1, Math.max(0, finalScore));
  }

  /**
   * Assign tier based on composite score.
   */
  assignTier(compositeScore: number): KeywordTier {
    if (compositeScore >= this.thresholds.mustDo) return "must_do";
    if (compositeScore >= this.thresholds.shouldDo) return "should_do";
    if (compositeScore >= this.thresholds.niceToHave) return "nice_to_have";
    return "ignore";
  }

  /**
   * Prioritize all keywords for a prospect.
   * Updates tier, compositeScore, and quickWinType in database.
   */
  async prioritizeKeywords(
    prospectId: string,
    focusScores?: Map<string, number>
  ): Promise<PrioritizationResult> {
    // Fetch keywords
    const keywords = await db
      .select()
      .from(prospectKeywords)
      .where(eq(prospectKeywords.prospectId, prospectId));

    const result: PrioritizationResult = {
      keywordsProcessed: keywords.length,
      tierCounts: { must_do: 0, should_do: 0, nice_to_have: 0, ignore: 0 },
      quickWinCounts: {
        strikingDistance: 0,
        lowHanging: 0,
        freshOpportunity: 0,
      },
    };

    // Process each keyword
    for (const kw of keywords) {
      const focusScore = focusScores?.get(kw.id) ?? 0.5;
      const compositeScore = this.computeCompositeScore(kw, focusScore);
      const tier = this.assignTier(compositeScore);
      const quickWin = quickWinDetector.detect(kw);

      // Update database
      await db
        .update(prospectKeywords)
        .set({
          compositeScore,
          tier,
          quickWinType: quickWin.type,
          updatedAt: new Date(),
        })
        .where(eq(prospectKeywords.id, kw.id));

      // Track counts
      result.tierCounts[tier]++;
      if (quickWin.type === "striking_distance")
        result.quickWinCounts.strikingDistance++;
      if (quickWin.type === "low_hanging") result.quickWinCounts.lowHanging++;
      if (quickWin.type === "fresh_opportunity")
        result.quickWinCounts.freshOpportunity++;
    }

    return result;
  }

  /**
   * Bulk update tier for selected keywords.
   */
  async bulkUpdateTier(
    keywordIds: string[],
    tier: KeywordTier
  ): Promise<number> {
    if (keywordIds.length === 0) return 0;

    await db
      .update(prospectKeywords)
      .set({ tier, updatedAt: new Date() })
      .where(inArray(prospectKeywords.id, keywordIds));

    return keywordIds.length;
  }

  /**
   * Phase 77: Geo-aware keyword prioritization (non-database version)
   * Prioritize keywords with optional geographic filtering.
   *
   * @param keywords - Array of keywords to prioritize
   * @param weights - Custom score weights (optional)
   * @param geoConstraints - Geographic filtering constraints (optional)
   * @returns Array of prioritized keywords with scores and tiers
   */
  prioritizeKeywordsList(
    keywords: Array<{
      keyword: string;
      searchVolume: number | null;
      competition: number | null;
      relevanceScore: number | null;
      currentPosition: number | null;
    }>,
    weights?: Partial<ScoreWeights>,
    geoConstraints?: Partial<GeoConstraints>
  ): KeywordPrioritizationResult[] {
    const w = { ...this.weights, ...weights };

    // Pre-classify all keywords for geo if constraints provided
    const geoResults = geoConstraints
      ? geoClassifier.classifyBatch(
          keywords.map((k) => k.keyword),
          geoConstraints
        )
      : null;

    const results: KeywordPrioritizationResult[] = keywords.map((kw, i) => {
      const geo = geoResults?.[i];

      // If geo constraint provided and keyword fails, score = 0
      if (geo && !geo.passesGeoFilter) {
        return {
          keyword: kw.keyword,
          compositeScore: 0,
          tier: "excluded" as KeywordTier,
          searchVolume: kw.searchVolume,
          competition: kw.competition,
          relevanceScore: kw.relevanceScore,
          currentPosition: kw.currentPosition,
          geoClassification: geo,
        };
      }

      // Normal scoring with optional geo boost
      const baseScore = this.computeBaseScore(kw, w);
      const geoBoost = geo ? geo.geoScore * w.geo : w.geo; // Default to full weight if no constraint
      const compositeScore = Math.min(1, Math.max(0, baseScore + geoBoost));

      return {
        keyword: kw.keyword,
        compositeScore,
        tier: this.assignTier(compositeScore),
        searchVolume: kw.searchVolume,
        competition: kw.competition,
        relevanceScore: kw.relevanceScore,
        currentPosition: kw.currentPosition,
        geoClassification: geo,
      };
    });

    // Sort by compositeScore descending, excluded last
    return this.sortResults(results);
  }

  /**
   * Compute base score without geo factor
   */
  private computeBaseScore(
    keyword: {
      searchVolume: number | null;
      competition: number | null;
      relevanceScore: number | null;
      currentPosition: number | null;
    },
    weights: ScoreWeights
  ): number {
    // Normalize factors to 0-1 scale
    const volumeScore = this.normalizeVolume(keyword.searchVolume ?? 0);
    const competitionScore = 1 - (keyword.competition ?? 0.5); // Lower is better
    const relevanceScore = keyword.relevanceScore ?? 0.5;
    const positionScore = this.normalizePosition(keyword.currentPosition);
    const focusScore = 0.5; // Default focus score

    // Compute weighted sum (excluding geo)
    return (
      volumeScore * weights.volume +
      competitionScore * weights.competition +
      relevanceScore * weights.relevance +
      focusScore * weights.focus +
      positionScore * weights.position
    );
  }

  /**
   * Sort results: non-excluded by score descending, then excluded last
   */
  private sortResults(
    results: KeywordPrioritizationResult[]
  ): KeywordPrioritizationResult[] {
    const nonExcluded = results.filter((r) => r.tier !== "excluded");
    const excluded = results.filter((r) => r.tier === "excluded");

    nonExcluded.sort((a, b) => b.compositeScore - a.compositeScore);

    return [...nonExcluded, ...excluded];
  }

  /**
   * Normalize search volume to 0-1 scale using log scale.
   * 0 = 0, 100 = ~0.5, 10000 = 1.0
   */
  private normalizeVolume(volume: number): number {
    if (volume <= 0) return 0;
    const logVol = Math.log10(volume);
    const normalized = logVol / 4; // log10(10000) = 4
    return Math.min(1, Math.max(0, normalized));
  }

  /**
   * Normalize position to 0-1 scale (opportunity score).
   * Position 1-3 = 0.3 (already ranking well, less opportunity)
   * Position 4-10 = 0.5-0.8 (improving opportunity)
   * Position 11-30 = 0.8-1.0 (striking distance, high opportunity)
   * Position > 30 = 0.7 (harder to improve)
   * Not ranking = 0.5 (neutral)
   */
  private normalizePosition(position: number | null): number {
    if (position === null) return 0.5; // Not ranking = neutral

    if (position <= 3) return 0.3; // Already ranking well
    if (position <= 10) return 0.5 + (position - 3) * 0.043; // 0.5 to 0.8
    if (position <= 30) return 0.8 + (position - 10) * 0.01; // 0.8 to 1.0
    return 0.7; // Position > 30, harder to improve
  }
}

export const prioritizationService = new PrioritizationService();
