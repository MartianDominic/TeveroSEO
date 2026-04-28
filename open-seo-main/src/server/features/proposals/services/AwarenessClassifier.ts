/**
 * AwarenessClassifier - Schwartz awareness level classification.
 * Phase 43-06: Proposal Generation
 *
 * Classifies prospect awareness levels using Eugene Schwartz's framework
 * from "Breakthrough Advertising". Used to select appropriate hook strategies
 * and messaging angles for proposals.
 *
 * Levels:
 * 1. Unaware - Doesn't know they have a problem
 * 2. Problem-aware - Knows problem, not solutions
 * 3. Solution-aware - Knows solutions exist
 * 4. Product-aware - Knows your offer
 * 5. Most-aware - Ready to buy
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "AwarenessClassifier" });

// ES module workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROMPT_PATH = join(__dirname, "../prompts/awareness-classifier.xml");

export type AwarenessLevel =
  | "unaware"
  | "problem-aware"
  | "solution-aware"
  | "product-aware"
  | "most-aware";

export interface ClassificationResult {
  awarenessLevel: AwarenessLevel;
  confidence: number;
  signalsDetected: string[];
  hookStrategy: string;
  recommendedApproach: {
    openingAngle: string;
    primaryCialdini: string;
    objectionsToAddress: string[];
  };
  reasoning: string;
}

export interface ClassificationInput {
  domain: string;
  scrapeSummary?: string;
  initialInquiry?: string;
  leadSource?: string;
  conversationHistory?: string;
}

/**
 * Hook strategies for each awareness level.
 * Based on Schwartz's framework combined with Cialdini principles.
 */
const HOOK_STRATEGIES: Record<AwarenessLevel, string> = {
  unaware: "Lead with problem agitation - show what they're missing",
  "problem-aware":
    "Present SEO as THE solution - they know the problem, show the way out",
  "solution-aware":
    "Differentiate your methodology - explain why your approach is different",
  "product-aware":
    "Remove objections, build trust - address specific concerns",
  "most-aware":
    "Clear CTA, reduce friction - make it easy to say yes",
};

/**
 * Escape special characters in user input to prevent prompt injection.
 * Part of threat mitigation T-43-17.
 */
function escapeUserInput(input: string): string {
  return input
    .replace(/{{/g, "{ {")
    .replace(/}}/g, "} }")
    .replace(/<script/gi, "&lt;script")
    .replace(/<\/script/gi, "&lt;/script");
}

export class AwarenessClassifier {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Classify prospect's awareness level using AI (Claude).
   * Uses the awareness-classifier.xml prompt template.
   */
  async classify(input: ClassificationInput): Promise<ClassificationResult> {
    let promptTemplate: string;
    try {
      promptTemplate = readFileSync(PROMPT_PATH, "utf-8");
    } catch (error) {
      log.error(
        "Failed to read prompt template",
        error instanceof Error ? error : new Error(String(error)),
        { path: PROMPT_PATH }
      );
      throw new Error("Failed to load awareness classifier prompt");
    }

    // Escape user input to prevent injection (T-43-17)
    const safeInput = {
      domain: escapeUserInput(input.domain),
      scrapeSummary: input.scrapeSummary
        ? escapeUserInput(input.scrapeSummary)
        : "N/A",
      initialInquiry: input.initialInquiry
        ? escapeUserInput(input.initialInquiry)
        : "N/A",
      leadSource: input.leadSource
        ? escapeUserInput(input.leadSource)
        : "unknown",
      conversationHistory: input.conversationHistory
        ? escapeUserInput(input.conversationHistory)
        : "N/A",
    };

    const prompt = promptTemplate
      .replace(/{{DOMAIN}}/g, safeInput.domain)
      .replace(/{{SCRAPE_SUMMARY}}/g, safeInput.scrapeSummary)
      .replace(/{{INQUIRY_TEXT}}/g, safeInput.initialInquiry)
      .replace(/{{LEAD_SOURCE}}/g, safeInput.leadSource)
      .replace(/{{CONVERSATION_NOTES}}/g, safeInput.conversationHistory);

    log.info("Classifying prospect awareness", { domain: input.domain });

    const response = await this.anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type");
    }

    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      log.warn("No JSON found in AI response", {
        response: content.text.slice(0, 200),
      });
      throw new Error("No JSON found in response");
    }

    const result = JSON.parse(jsonMatch[0]);

    log.info("Awareness classification complete", {
      domain: input.domain,
      level: result.awareness_level,
      confidence: result.confidence,
    });

    return {
      awarenessLevel: result.awareness_level as AwarenessLevel,
      confidence: result.confidence,
      signalsDetected: result.signals_detected,
      hookStrategy: result.hook_strategy,
      recommendedApproach: {
        openingAngle: result.recommended_approach.opening_angle,
        primaryCialdini: result.recommended_approach.primary_cialdini,
        objectionsToAddress: result.recommended_approach.objections_to_address,
      },
      reasoning: result.reasoning,
    };
  }

  /**
   * Quick classification without AI (rule-based).
   * Use for initial screening before full AI classification.
   * Useful for high-volume processing or when AI is unavailable.
   */
  quickClassify(input: ClassificationInput): AwarenessLevel {
    const inquiry = (input.initialInquiry || "").toLowerCase();

    // Most-aware signals (highest priority)
    if (
      inquiry.includes("pasiulym") || // proposal in Lithuanian (handles pasiulymas, pasiulyma, pasiulymą)
      inquiry.includes("pasiūlym") || // with diacritics
      inquiry.includes("proposal") ||
      inquiry.includes("quote") ||
      inquiry.includes("kaina") || // price in Lithuanian
      inquiry.includes("sutartis") // contract in Lithuanian
    ) {
      return "most-aware";
    }

    // Product-aware signals
    if (
      inquiry.includes("compare") ||
      inquiry.includes("palyginti") || // compare in Lithuanian
      inquiry.includes("other agencies") ||
      inquiry.includes("kitos agentūros") ||
      inquiry.includes("why you") ||
      inquiry.includes("kodėl jus") ||
      inquiry.includes("konkurentai") // competitors in Lithuanian
    ) {
      return "product-aware";
    }

    // Solution-aware signals
    if (
      inquiry.includes("seo") ||
      inquiry.includes("optimiz") ||
      inquiry.includes("search engine") ||
      inquiry.includes("google rank") ||
      inquiry.includes("paieškos") || // search in Lithuanian
      inquiry.includes("norime optimizuoti") // want to optimize in Lithuanian
    ) {
      return "solution-aware";
    }

    // Problem-aware signals
    if (
      inquiry.includes("traffic") ||
      inquiry.includes("visitors") ||
      inquiry.includes("lankytoj") || // visitors in Lithuanian (handles lankytojai, lankytoju)
      inquiry.includes("sales down") ||
      inquiry.includes("not found") ||
      inquiry.includes("nerandame") || // can't find in Lithuanian
      inquiry.includes("mažai") // few/little in Lithuanian
    ) {
      return "problem-aware";
    }

    // Default to unaware
    return "unaware";
  }

  /**
   * Get the recommended hook strategy for a given awareness level.
   * Static method for use without full classification.
   */
  static getHookStrategyForLevel(level: AwarenessLevel): string {
    return HOOK_STRATEGIES[level];
  }
}

// Lazy singleton to avoid instantiation during import (for testing)
let _instance: AwarenessClassifier | null = null;

export function getAwarenessClassifier(): AwarenessClassifier {
  if (!_instance) {
    _instance = new AwarenessClassifier();
  }
  return _instance;
}

// Re-export for convenience (lazy instantiation)
export const awarenessClassifier = {
  classify: (input: ClassificationInput) => getAwarenessClassifier().classify(input),
  quickClassify: (input: ClassificationInput) => getAwarenessClassifier().quickClassify(input),
};
