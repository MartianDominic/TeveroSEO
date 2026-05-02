/**
 * ClassificationPipeline: Two-pass classification cascade.
 *
 * Pass 1: Grok 4.1 (or Gemini fallback) - resolves ~80% at >=0.85 confidence
 * Pass 2: Claude Sonnet - handles remaining uncertain keywords
 */

import { GeminiClassifier } from "./GeminiClassifier";
import { ResilientClassifier } from "../services/ResilientClassifier";
import { CLASSIFICATION_CONFIG } from "./config";
import type { BusinessContext, ClassifiedKeyword, ClassificationItem } from "./types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "ClassificationPipeline" });

export interface ClassificationStats {
  totalInput: number;
  pass1Resolved: number;
  pass2Resolved: number;
  excluded: number;
  included: number;
  pass1Rate: number;
}

export interface PipelineConfig {
  xaiApiKey?: string;
  geminiApiKey?: string;
  claudeApiKey?: string;
  openaiApiKey?: string;
  confidenceThreshold?: number;
}

export class ClassificationPipeline {
  private gemini: GeminiClassifier | null;
  private claude: ResilientClassifier;
  private confidenceThreshold: number;

  constructor(config: PipelineConfig) {
    this.gemini = config.geminiApiKey ? new GeminiClassifier(config.geminiApiKey) : null;
    this.claude = new ResilientClassifier({
      claudeApiKey: config.claudeApiKey,
      openaiApiKey: config.openaiApiKey,
    });
    this.confidenceThreshold = config.confidenceThreshold ?? CLASSIFICATION_CONFIG.CONFIDENCE_THRESHOLD;
  }

  async classify(
    keywords: string[],
    context: BusinessContext
  ): Promise<{ keywords: ClassifiedKeyword[]; stats: ClassificationStats }> {
    const stats: ClassificationStats = {
      totalInput: keywords.length,
      pass1Resolved: 0,
      pass2Resolved: 0,
      excluded: 0,
      included: 0,
      pass1Rate: 0,
    };

    if (keywords.length === 0) {
      return { keywords: [], stats };
    }

    // Pass 1: Gemini (or fallback to default response)
    let pass1Results: ClassificationItem[];

    if (this.gemini && !this.gemini.isCircuitOpen) {
      try {
        pass1Results = await this.gemini.classify(keywords, context);
        log.info("Pass 1 (Gemini) complete", { count: pass1Results.length });
      } catch (error) {
        log.warn("Gemini failed, using default classifications", { error });
        pass1Results = this.createDefaultClassifications(keywords);
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

      log.info("Pass 2 (Claude) complete", { count: pass2Results.length });
    }

    stats.pass1Rate = stats.totalInput > 0
      ? (stats.pass1Resolved / stats.totalInput) * 100
      : 0;

    // Filter to included keywords only for output
    const included = resolved.filter((k) => k.include);

    return { keywords: included, stats };
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

  getCircuitStates(): { gemini: boolean; claude: { claude: string; openai: string } } {
    return {
      gemini: this.gemini?.isCircuitOpen ?? true,
      claude: this.claude.getCircuitStates(),
    };
  }
}

export function createClassificationPipeline(): ClassificationPipeline {
  return new ClassificationPipeline({
    geminiApiKey: process.env.GEMINI_API_KEY,
    claudeApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
  });
}
