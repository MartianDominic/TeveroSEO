/**
 * AdaptiveIntentRouter: Intent detection and routing for keyword analysis.
 *
 * Routes analysis requests based on input characteristics:
 * - quick_check: <10 keywords, no expansion needed, completes <30s
 * - full_analysis: >10 keywords OR expansion requested, uses complete pipeline
 */

import {
  ClassificationPipeline,
  type PipelineConfig,
} from "../classification/ClassificationPipeline";
import {
  KeywordUniverseBuilder,
  type DataForSEOAutocomplete,
} from "../universe/KeywordUniverseBuilder";
import { NegativeAssociationExtractor } from "../context/NegativeAssociationExtractor";
import type { BusinessContext, ClassifiedKeyword } from "../classification/types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "AdaptiveIntentRouter" });

export type IntentType = "quick_check" | "full_analysis";

export interface AnalysisInput {
  /** Pre-existing keywords to classify (optional if seedKeywords provided) */
  keywords?: string[];
  /** Seed keywords for expansion (triggers full_analysis) */
  seedKeywords?: string[];
  /** Domain for relevance filtering during expansion */
  domain?: string;
  /** Business context for classification decisions */
  businessContext: BusinessContext;
  /** Force a specific intent type (overrides detection) */
  forceIntent?: IntentType;
}

export interface AnalysisResult {
  intent: IntentType;
  keywords: ClassifiedKeyword[];
  stats: {
    totalInput: number;
    included: number;
    excluded: number;
    pass1Rate: number;
    durationMs: number;
  };
}

export interface RouterConfig extends PipelineConfig {
  /** DataForSEO client for keyword expansion (optional) */
  dataForSEO?: DataForSEOAutocomplete;
  /** Threshold for quick_check vs full_analysis (default: 10) */
  quickCheckThreshold?: number;
  /** Timeout for quick_check in milliseconds (default: 30000) */
  quickCheckTimeoutMs?: number;
}

const DEFAULT_CONFIG = {
  quickCheckThreshold: 10,
  quickCheckTimeoutMs: 30000,
};

export class AdaptiveIntentRouter {
  private pipeline: ClassificationPipeline;
  private universeBuilder: KeywordUniverseBuilder | null;
  private negativeExtractor: NegativeAssociationExtractor;
  private config: Required<
    Pick<RouterConfig, "quickCheckThreshold" | "quickCheckTimeoutMs">
  >;

  constructor(config: RouterConfig) {
    this.pipeline = new ClassificationPipeline(config);
    this.universeBuilder = config.dataForSEO
      ? new KeywordUniverseBuilder(config.dataForSEO)
      : null;
    this.negativeExtractor = new NegativeAssociationExtractor(
      config.claudeApiKey
    );
    this.config = {
      quickCheckThreshold:
        config.quickCheckThreshold ?? DEFAULT_CONFIG.quickCheckThreshold,
      quickCheckTimeoutMs:
        config.quickCheckTimeoutMs ?? DEFAULT_CONFIG.quickCheckTimeoutMs,
    };
  }

  /**
   * Detect the appropriate intent based on input characteristics.
   *
   * Rules:
   * - forceIntent always wins
   * - seedKeywords present -> full_analysis (expansion needed)
   * - keywords.length > threshold -> full_analysis
   * - keywords.length <= threshold -> quick_check
   */
  detectIntent(input: AnalysisInput): IntentType {
    if (input.forceIntent) {
      return input.forceIntent;
    }

    // Full analysis required when expansion is needed
    if (input.seedKeywords && input.seedKeywords.length > 0) {
      return "full_analysis";
    }

    // Quick check: small keyword list, no expansion needed
    const keywordCount = input.keywords?.length ?? 0;
    if (keywordCount <= this.config.quickCheckThreshold) {
      return "quick_check";
    }

    // Full analysis: large keyword set
    return "full_analysis";
  }

  /**
   * Run analysis with automatic intent detection.
   */
  async analyze(input: AnalysisInput): Promise<AnalysisResult> {
    const startTime = performance.now();
    const intent = this.detectIntent(input);

    log.info("Analysis started", {
      intent,
      keywordCount: input.keywords?.length ?? 0,
      seedCount: input.seedKeywords?.length ?? 0,
    });

    let result: AnalysisResult;

    if (intent === "quick_check") {
      result = await this.runQuickCheck(input, startTime);
    } else {
      result = await this.runFullAnalysis(input, startTime);
    }

    log.info("Analysis complete", {
      intent,
      durationMs: result.stats.durationMs,
      included: result.stats.included,
    });

    return result;
  }

  /**
   * Quick check: Direct classification without expansion or negative extraction.
   * Target: Complete in <30s.
   */
  private async runQuickCheck(
    input: AnalysisInput,
    startTime: number
  ): Promise<AnalysisResult> {
    const keywords = input.keywords ?? [];

    // Quick check skips negative association extraction for speed
    const { keywords: classified, stats } = await this.pipeline.classify(
      keywords,
      input.businessContext
    );

    return {
      intent: "quick_check",
      keywords: classified,
      stats: {
        totalInput: keywords.length,
        included: stats.included,
        excluded: stats.excluded,
        pass1Rate: stats.pass1Rate,
        durationMs: performance.now() - startTime,
      },
    };
  }

  /**
   * Full analysis: Expansion + negative extraction + classification.
   * Used for larger datasets or when seed expansion is needed.
   */
  private async runFullAnalysis(
    input: AnalysisInput,
    startTime: number
  ): Promise<AnalysisResult> {
    let keywords: string[];

    // Expand from seeds if provided
    if (input.seedKeywords && input.seedKeywords.length > 0) {
      if (!this.universeBuilder) {
        throw new Error("DataForSEO client required for seed expansion");
      }
      keywords = await this.universeBuilder.expand(
        input.seedKeywords,
        input.domain
      );
    } else {
      keywords = input.keywords ?? [];
    }

    // Extract negative associations for better filtering
    const negativeAssociations = await this.negativeExtractor.extract({
      businessName: input.businessContext.businessName,
      industry: input.businessContext.industry,
      services: input.businessContext.services,
      targetAudience: input.businessContext.targetAudience,
    });

    const context: BusinessContext = {
      ...input.businessContext,
      negativeAssociations,
    };

    // Run classification pipeline
    const { keywords: classified, stats } = await this.pipeline.classify(
      keywords,
      context
    );

    return {
      intent: "full_analysis",
      keywords: classified,
      stats: {
        totalInput: keywords.length,
        included: stats.included,
        excluded: stats.excluded,
        pass1Rate: stats.pass1Rate,
        durationMs: performance.now() - startTime,
      },
    };
  }
}

/**
 * Factory function for creating AdaptiveIntentRouter with environment config.
 */
export function createAdaptiveIntentRouter(
  config?: Partial<RouterConfig>
): AdaptiveIntentRouter {
  return new AdaptiveIntentRouter({
    geminiApiKey: process.env.GEMINI_API_KEY,
    claudeApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    ...config,
  });
}
