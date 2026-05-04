/**
 * FunnelClassifier: Pattern-based BOFU/MOFU/TOFU classification.
 *
 * Decision tree (highest to lowest confidence):
 * 1. Explicit pattern match -> 0.85-0.90 confidence
 * 2. DataForSEO intent + context signals -> 0.65-0.80 confidence
 * 3. Fallback (no signals) -> 0.40 confidence, flag for LLM
 */

import { createLogger } from "@/server/lib/logger";
import {
  detectFunnelPatterns,
  BOFU_PATTERNS,
  matchPatterns,
} from "./patterns";
import type {
  FunnelStage,
  FunnelClassification,
  FunnelClassificationResult,
  FunnelBusinessContext,
} from "./types";
import type { KeywordIntent } from "@/types/keywords";

const log = createLogger({ module: "FunnelClassifier" });

// Confidence thresholds
const CONFIDENCE = {
  PATTERN_MATCH: 0.90,
  PATTERN_MATCH_MOFU: 0.85,  // Slightly lower for comparison patterns
  DATAFORSEO_TRANSACTIONAL: 0.75,
  DATAFORSEO_COMMERCIAL_WITH_CONTEXT: 0.70,
  DATAFORSEO_COMMERCIAL: 0.65,
  DATAFORSEO_INFORMATIONAL: 0.80,
  FALLBACK: 0.40,
  HIGH_THRESHOLD: 0.80,
  LOW_THRESHOLD: 0.60,
};

// Lithuanian city patterns for local intent detection
const LITHUANIAN_CITY_PATTERN = /\b(vilni|kaun|klaipėd|šiauli|panev|alyt|marijampol|maž|utenio|telši|taurag|panevėž)/i;

export interface ClassifyOptions {
  dataForSeoIntent?: KeywordIntent;
  businessContext?: FunnelBusinessContext;
}

export class FunnelClassifier {
  /**
   * Classify a single keyword into funnel stage.
   */
  classify(keyword: string, options: ClassifyOptions = {}): FunnelClassification {
    const { dataForSeoIntent, businessContext } = options;

    // Step 1: Check explicit patterns (highest confidence)
    const patternResult = detectFunnelPatterns(keyword);

    if (patternResult.stage) {
      const confidence = patternResult.stage === "mofu"
        ? CONFIDENCE.PATTERN_MATCH_MOFU
        : CONFIDENCE.PATTERN_MATCH;

      return this.buildClassification(keyword, {
        stage: patternResult.stage,
        confidence,
        patternMatch: true,
        patternType: patternResult.patternType,
        dataForSeoIntent: dataForSeoIntent ?? null,
        businessContextBoost: false,
        reasoning: `Pattern match: ${patternResult.patternType}`,
      });
    }

    // Step 2: Check DataForSEO intent + business context
    if (dataForSeoIntent) {
      const intentResult = this.classifyByIntent(
        keyword,
        dataForSeoIntent,
        businessContext
      );
      if (intentResult) {
        return intentResult;
      }
    }

    // Step 3: Check business context alone (city + service)
    if (businessContext) {
      const contextResult = this.classifyByContext(keyword, businessContext);
      if (contextResult) {
        return contextResult;
      }
    }

    // Step 4: Fallback - default to MOFU with low confidence
    return this.buildClassification(keyword, {
      stage: "mofu",
      confidence: CONFIDENCE.FALLBACK,
      patternMatch: false,
      patternType: null,
      dataForSeoIntent: dataForSeoIntent ?? null,
      businessContextBoost: false,
      reasoning: "No clear signals - default MOFU, flagged for LLM review",
    });
  }

  /**
   * Classify by DataForSEO intent with context enhancement.
   */
  private classifyByIntent(
    keyword: string,
    intent: KeywordIntent,
    context?: FunnelBusinessContext
  ): FunnelClassification | null {
    // Transactional -> BOFU
    if (intent === "transactional") {
      return this.buildClassification(keyword, {
        stage: "bofu",
        confidence: CONFIDENCE.DATAFORSEO_TRANSACTIONAL,
        patternMatch: false,
        patternType: null,
        dataForSeoIntent: intent,
        businessContextBoost: false,
        reasoning: "DataForSEO transactional intent",
      });
    }

    // Commercial with context -> BOFU or MOFU
    if (intent === "commercial") {
      const hasLocalSignal = this.detectLocalSignal(keyword, context);
      const isServiceContext = context?.isServiceBusiness ?? false;

      if (hasLocalSignal && isServiceContext) {
        return this.buildClassification(keyword, {
          stage: "bofu",
          confidence: CONFIDENCE.DATAFORSEO_COMMERCIAL_WITH_CONTEXT,
          patternMatch: false,
          patternType: null,
          dataForSeoIntent: intent,
          businessContextBoost: true,
          reasoning: "Commercial + city + service business = BOFU",
        });
      }

      // Plain commercial -> MOFU
      return this.buildClassification(keyword, {
        stage: "mofu",
        confidence: CONFIDENCE.DATAFORSEO_COMMERCIAL,
        patternMatch: false,
        patternType: null,
        dataForSeoIntent: intent,
        businessContextBoost: false,
        reasoning: "DataForSEO commercial intent (no local boost)",
      });
    }

    // Informational -> TOFU
    if (intent === "informational") {
      return this.buildClassification(keyword, {
        stage: "tofu",
        confidence: CONFIDENCE.DATAFORSEO_INFORMATIONAL,
        patternMatch: false,
        patternType: null,
        dataForSeoIntent: intent,
        businessContextBoost: false,
        reasoning: "DataForSEO informational intent",
      });
    }

    // Navigational or unknown - don't classify by intent alone
    return null;
  }

  /**
   * Classify by business context alone (city + service detection).
   */
  private classifyByContext(
    keyword: string,
    context: FunnelBusinessContext
  ): FunnelClassification | null {
    if (!context.isServiceBusiness) {
      return null;
    }

    const hasLocalSignal = this.detectLocalSignal(keyword, context);
    if (!hasLocalSignal) {
      return null;
    }

    // Service + city mention = likely BOFU
    return this.buildClassification(keyword, {
      stage: "bofu",
      confidence: 0.65,
      patternMatch: false,
      patternType: null,
      dataForSeoIntent: null,
      businessContextBoost: true,
      reasoning: "City mention + service business context",
    });
  }

  /**
   * Detect local intent signals in keyword.
   */
  private detectLocalSignal(keyword: string, context?: FunnelBusinessContext): boolean {
    const lowerKeyword = keyword.toLowerCase();

    // Check for city patterns
    if (LITHUANIAN_CITY_PATTERN.test(lowerKeyword)) {
      return true;
    }

    // Check against context cities
    if (context?.cities) {
      for (const city of context.cities) {
        if (lowerKeyword.includes(city.toLowerCase())) {
          return true;
        }
      }
    }

    // Check for "near me" patterns (already in BOFU patterns, but double-check)
    const nearMeMatch = matchPatterns(keyword, [
      { type: "local", patterns: [/(šalia manęs|netoli|arti)/i] }
    ]);

    return nearMeMatch.matched;
  }

  /**
   * Build classification result object.
   */
  private buildClassification(
    keyword: string,
    data: {
      stage: FunnelStage;
      confidence: number;
      patternMatch: boolean;
      patternType: string | null;
      dataForSeoIntent: string | null;
      businessContextBoost: boolean;
      reasoning: string;
    }
  ): FunnelClassification {
    return {
      keyword,
      stage: data.stage,
      confidence: data.confidence,
      signals: {
        patternMatch: data.patternMatch,
        patternType: data.patternType,
        dataForSeoIntent: data.dataForSeoIntent,
        businessContextBoost: data.businessContextBoost,
      },
      reasoning: data.reasoning,
    };
  }

  /**
   * Classify a batch of keywords.
   */
  classifyBatch(
    keywords: string[],
    options: ClassifyOptions = {}
  ): FunnelClassificationResult {
    const classifications: FunnelClassification[] = [];
    const stats = {
      total: keywords.length,
      bofu: 0,
      mofu: 0,
      tofu: 0,
      highConfidence: 0,
      lowConfidence: 0,
    };

    for (const keyword of keywords) {
      const result = this.classify(keyword, options);
      classifications.push(result);

      // Update stats
      stats[result.stage]++;
      if (result.confidence >= CONFIDENCE.HIGH_THRESHOLD) {
        stats.highConfidence++;
      } else if (result.confidence < CONFIDENCE.LOW_THRESHOLD) {
        stats.lowConfidence++;
      }
    }

    log.info("Batch classification complete", {
      total: stats.total,
      bofu: stats.bofu,
      mofu: stats.mofu,
      tofu: stats.tofu,
      lowConfidence: stats.lowConfidence,
    });

    return { classifications, stats };
  }

  /**
   * Get keywords that need LLM review (low confidence).
   */
  getLowConfidenceKeywords(result: FunnelClassificationResult): string[] {
    return result.classifications
      .filter(c => c.confidence < CONFIDENCE.LOW_THRESHOLD)
      .map(c => c.keyword);
  }
}

/**
 * Factory function for creating FunnelClassifier.
 */
export function createFunnelClassifier(): FunnelClassifier {
  return new FunnelClassifier();
}
