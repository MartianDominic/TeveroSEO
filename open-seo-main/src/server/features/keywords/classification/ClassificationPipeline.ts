/**
 * ClassificationPipeline: Two-pass classification cascade.
 *
 * Pass 1: Grok 4.1 (primary) or Gemini (fallback) - resolves ~80% at >=0.85 confidence
 * Pass 2: Claude Sonnet - handles remaining uncertain keywords
 *
 * Cost tracking is integrated to meter API usage per workspace.
 */

import { GrokClassifier } from "./GrokClassifier";
import { GeminiClassifier } from "./GeminiClassifier";
import { ResilientClassifier } from "../services/ResilientClassifier";
import { CLASSIFICATION_CONFIG } from "./config";
import type { BusinessContext, ClassifiedKeyword, ClassificationItem } from "./types";
import { createLogger } from "@/server/lib/logger";
import { getCostTracker } from "../services/CostTracker";
import { API_SERVICES, API_OPERATIONS, estimateTokens } from "@/db/api-costs-schema";

const log = createLogger({ module: "ClassificationPipeline" });

export interface ClassificationStats {
  totalInput: number;
  pass1Resolved: number;
  pass2Resolved: number;
  excluded: number;
  included: number;
  pass1Rate: number;
  /** Cost incurred in cents (optional, only if workspaceId provided) */
  costCents?: number;
}

export interface PipelineConfig {
  xaiApiKey?: string;
  geminiApiKey?: string;
  claudeApiKey?: string;
  openaiApiKey?: string;
  confidenceThreshold?: number;
}

/**
 * Classifier interface for Pass 1 classifiers (Grok/Gemini).
 */
interface Pass1Classifier {
  classify(keywords: string[], context: BusinessContext): Promise<ClassificationItem[]>;
  readonly isCircuitOpen: boolean;
  readonly name: string;
}

/**
 * Wrapper to add name property to classifiers.
 */
class NamedGrokClassifier implements Pass1Classifier {
  private classifier: GrokClassifier;
  readonly name = "grok";

  constructor(apiKey?: string) {
    this.classifier = new GrokClassifier(apiKey);
  }

  async classify(keywords: string[], context: BusinessContext): Promise<ClassificationItem[]> {
    return this.classifier.classify(keywords, context);
  }

  get isCircuitOpen(): boolean {
    return this.classifier.isCircuitOpen;
  }
}

class NamedGeminiClassifier implements Pass1Classifier {
  private classifier: GeminiClassifier;
  readonly name = "gemini";

  constructor(apiKey: string) {
    this.classifier = new GeminiClassifier(apiKey);
  }

  async classify(keywords: string[], context: BusinessContext): Promise<ClassificationItem[]> {
    return this.classifier.classify(keywords, context);
  }

  get isCircuitOpen(): boolean {
    return this.classifier.isCircuitOpen;
  }
}

export class ClassificationPipeline {
  /** Primary Pass 1 classifier (Grok for cost efficiency) */
  private primaryClassifier: Pass1Classifier | null;
  /** Fallback Pass 1 classifier (Gemini when Grok unavailable) */
  private fallbackClassifier: Pass1Classifier | null;
  /** Pass 2 classifier for uncertain keywords */
  private claude: ResilientClassifier;
  private confidenceThreshold: number;

  constructor(config: PipelineConfig) {
    // Primary: Grok ($0.20/1M tokens - most cost effective)
    this.primaryClassifier = config.xaiApiKey
      ? new NamedGrokClassifier(config.xaiApiKey)
      : null;

    // Fallback: Gemini (when Grok circuit is open or no xAI key)
    this.fallbackClassifier = config.geminiApiKey
      ? new NamedGeminiClassifier(config.geminiApiKey)
      : null;

    // Pass 2: Claude for uncertain keywords
    this.claude = new ResilientClassifier({
      claudeApiKey: config.claudeApiKey,
      openaiApiKey: config.openaiApiKey,
    });

    this.confidenceThreshold = config.confidenceThreshold ?? CLASSIFICATION_CONFIG.CONFIDENCE_THRESHOLD;

    log.info("Pipeline initialized", {
      hasPrimary: !!this.primaryClassifier,
      hasFallback: !!this.fallbackClassifier,
      threshold: this.confidenceThreshold,
    });
  }

  /**
   * Classify keywords using the two-pass cascade.
   *
   * @param keywords - Keywords to classify
   * @param context - Business context for classification decisions
   * @param workspaceId - Optional workspace ID for cost tracking
   */
  async classify(
    keywords: string[],
    context: BusinessContext,
    workspaceId?: string
  ): Promise<{ keywords: ClassifiedKeyword[]; stats: ClassificationStats }> {
    const stats: ClassificationStats = {
      totalInput: keywords.length,
      pass1Resolved: 0,
      pass2Resolved: 0,
      excluded: 0,
      included: 0,
      pass1Rate: 0,
      costCents: 0,
    };

    if (keywords.length === 0) {
      return { keywords: [], stats };
    }

    // Select Pass 1 classifier: Grok (primary) -> Gemini (fallback) -> defaults
    const pass1Classifier = this.selectPass1Classifier();
    let pass1Results: ClassificationItem[];
    let pass1Service: string | null = null;

    if (pass1Classifier) {
      try {
        pass1Results = await pass1Classifier.classify(keywords, context);
        pass1Service = pass1Classifier.name;
        log.info(`Pass 1 (${pass1Service}) complete`, { count: pass1Results.length });

        // Track cost if workspace provided
        if (workspaceId) {
          const inputText = this.estimatePass1InputText(keywords, context);
          const outputText = JSON.stringify(pass1Results);
          await this.trackCost(
            workspaceId,
            pass1Service as "grok" | "gemini",
            inputText,
            outputText,
            stats
          );
        }
      } catch (error) {
        log.warn(`${pass1Classifier.name} failed, trying fallback`, { error });

        // Try fallback if primary failed
        const fallback = this.getFallbackClassifier(pass1Classifier.name);
        if (fallback && !fallback.isCircuitOpen) {
          try {
            pass1Results = await fallback.classify(keywords, context);
            pass1Service = fallback.name;
            log.info(`Pass 1 fallback (${pass1Service}) complete`, { count: pass1Results.length });

            if (workspaceId) {
              const inputText = this.estimatePass1InputText(keywords, context);
              const outputText = JSON.stringify(pass1Results);
              await this.trackCost(
                workspaceId,
                pass1Service as "grok" | "gemini",
                inputText,
                outputText,
                stats
              );
            }
          } catch (fallbackError) {
            log.warn("Fallback also failed, using defaults", { fallbackError });
            pass1Results = this.createDefaultClassifications(keywords);
          }
        } else {
          pass1Results = this.createDefaultClassifications(keywords);
        }
      }
    } else {
      log.info("No Pass 1 classifier available, using defaults");
      pass1Results = this.createDefaultClassifications(keywords);
    }

    // Separate resolved vs uncertain
    const resolved: ClassifiedKeyword[] = [];
    const uncertain: string[] = [];

    for (const result of pass1Results) {
      if (result.confidence >= this.confidenceThreshold) {
        resolved.push({
          ...result,
          pass: 1,
        });
        stats.pass1Resolved++;
        if (result.include) {
          stats.included++;
        } else {
          stats.excluded++;
        }
      } else {
        uncertain.push(result.keyword);
      }
    }

    log.info("Pass 1 results", {
      resolved: resolved.length,
      uncertain: uncertain.length,
      threshold: this.confidenceThreshold,
      service: pass1Service,
    });

    // Pass 2: Claude Sonnet for uncertain keywords
    if (uncertain.length > 0) {
      const categories = context.services;
      const pass2Results = await this.claude.classifyBatch(uncertain, categories);

      for (const result of pass2Results) {
        const isIncluded = result.confidence >= 0.5;
        resolved.push({
          keyword: result.keyword,
          include: isIncluded,
          confidence: result.confidence,
          type: null,
          reasoning: result.reasoning || "",
          pass: 2,
        });
        stats.pass2Resolved++;
        if (isIncluded) {
          stats.included++;
        } else {
          stats.excluded++;
        }
      }

      // Track Pass 2 cost
      if (workspaceId) {
        const inputText = uncertain.join("\n") + JSON.stringify(categories);
        const outputText = JSON.stringify(pass2Results);
        await this.trackCost(workspaceId, "claude", inputText, outputText, stats);
      }

      log.info("Pass 2 (Claude) complete", { count: pass2Results.length });
    }

    stats.pass1Rate = stats.totalInput > 0
      ? (stats.pass1Resolved / stats.totalInput) * 100
      : 0;

    // Filter to included keywords only for output
    const included = resolved.filter((k) => k.include);

    return { keywords: included, stats };
  }

  /**
   * Select the best available Pass 1 classifier.
   * Prefers Grok (cheapest) if available and circuit is closed.
   */
  private selectPass1Classifier(): Pass1Classifier | null {
    // Try primary (Grok) first
    if (this.primaryClassifier && !this.primaryClassifier.isCircuitOpen) {
      return this.primaryClassifier;
    }

    // Fall back to Gemini
    if (this.fallbackClassifier && !this.fallbackClassifier.isCircuitOpen) {
      log.info("Primary classifier unavailable, using fallback", {
        primaryCircuitOpen: this.primaryClassifier?.isCircuitOpen ?? true,
      });
      return this.fallbackClassifier;
    }

    return null;
  }

  /**
   * Get fallback classifier for a given primary classifier name.
   */
  private getFallbackClassifier(primaryName: string): Pass1Classifier | null {
    if (primaryName === "grok" && this.fallbackClassifier) {
      return this.fallbackClassifier;
    }
    // If Gemini was primary and failed, no fallback
    return null;
  }

  /**
   * Estimate input text size for cost calculation.
   */
  private estimatePass1InputText(keywords: string[], context: BusinessContext): string {
    return keywords.join("\n") + JSON.stringify(context);
  }

  /**
   * Track API cost for a classification call.
   */
  private async trackCost(
    workspaceId: string,
    service: "grok" | "gemini" | "claude",
    inputText: string,
    outputText: string,
    stats: ClassificationStats
  ): Promise<void> {
    try {
      const costTracker = getCostTracker();
      const inputTokens = estimateTokens(inputText);
      const outputTokens = estimateTokens(outputText);

      await costTracker.record({
        workspaceId,
        service: API_SERVICES[service.toUpperCase() as keyof typeof API_SERVICES],
        operation: API_OPERATIONS.CLASSIFY,
        inputTokens,
        outputTokens,
      });

      // Update stats with cost
      const { calculateCostCents } = await import("@/db/api-costs-schema");
      const costCents = calculateCostCents(
        inputTokens,
        outputTokens,
        API_SERVICES[service.toUpperCase() as keyof typeof API_SERVICES]
      );
      stats.costCents = (stats.costCents ?? 0) + costCents;
    } catch (error) {
      // Don't fail classification if cost tracking fails
      log.warn("Failed to track cost", { error, workspaceId, service });
    }
  }

  private createDefaultClassifications(keywords: string[]): ClassificationItem[] {
    return keywords.map((keyword) => ({
      keyword,
      include: true,
      confidence: 0.5,
      type: null,
      reasoning: "No classifier available - default include",
    }));
  }

  /**
   * Get circuit breaker states for all classifiers.
   */
  getCircuitStates(): {
    grok: boolean;
    gemini: boolean;
    claude: { claude: string; openai: string };
  } {
    return {
      grok: this.primaryClassifier?.isCircuitOpen ?? true,
      gemini: this.fallbackClassifier?.isCircuitOpen ?? true,
      claude: this.claude.getCircuitStates(),
    };
  }
}

/**
 * Factory function for creating ClassificationPipeline with environment config.
 * Uses Grok as primary (cheapest) and Gemini as fallback.
 */
export function createClassificationPipeline(): ClassificationPipeline {
  return new ClassificationPipeline({
    xaiApiKey: process.env.XAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    claudeApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
  });
}
