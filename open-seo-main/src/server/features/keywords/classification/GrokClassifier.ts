/**
 * GrokClassifier: Pass 1 high-volume keyword classifier using xAI's Grok 4.1.
 *
 * Cost-optimized at $0.20/1M input tokens for bulk classification.
 * Uses OpenAI SDK with xAI baseURL override.
 *
 * Features:
 * - Circuit breaker for graceful degradation
 * - Zod schema validation on responses
 * - Batching for large keyword sets (50 keywords per call)
 * - Negative association awareness for adjacent vertical filtering
 */

import OpenAI from "openai";
import { createCircuitBreaker, CircuitOpenError, type CircuitBreaker } from "@/server/features/scraping/resilience/CircuitBreaker";
import {
  ClassificationResponseSchema,
  type BusinessContext,
  type ClassificationItem,
} from "./types";
import { GROK_CONFIG, CLASSIFICATION_CONFIG } from "./config";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "GrokClassifier" });

export { CircuitOpenError };

export class GrokClassifier {
  private client: OpenAI;
  private circuit: CircuitBreaker;

  constructor(apiKey?: string) {
    const key = apiKey ?? process.env.XAI_API_KEY;
    if (!key) {
      throw new Error("XAI_API_KEY not configured");
    }

    this.client = new OpenAI({
      apiKey: key,
      baseURL: GROK_CONFIG.baseURL,
    });

    this.circuit = createCircuitBreaker("grok-classifier", {
      failureThreshold: 3,
      timeout: 60000,
    });
  }

  /**
   * Classify keywords against business context.
   * Returns classification decisions with confidence scores.
   *
   * @throws CircuitOpenError if circuit breaker is open
   * @throws Error on API failure or invalid response
   */
  async classify(
    keywords: string[],
    context: BusinessContext
  ): Promise<ClassificationItem[]> {
    if (!this.circuit.allowsRequest) {
      throw new CircuitOpenError("grok-classifier", 0);
    }

    // Handle empty input
    if (keywords.length === 0) {
      return [];
    }

    // Batch if needed
    if (keywords.length > CLASSIFICATION_CONFIG.BATCH_SIZE) {
      return this.classifyBatched(keywords, context);
    }

    try {
      const response = await this.client.chat.completions.create({
        model: GROK_CONFIG.model,
        messages: [
          { role: "system", content: this.buildSystemPrompt() },
          { role: "user", content: this.buildUserPrompt(keywords, context) },
        ],
        response_format: { type: "json_object" },
        max_tokens: GROK_CONFIG.maxTokens,
        temperature: GROK_CONFIG.temperature,
      });

      // Phase 91: Log xAI prompt caching metrics (auto-caching verification)
      const usage = response.usage;
      if (usage) {
        const promptTokensDetails = usage.prompt_tokens_details as
          | { cached_tokens?: number }
          | undefined;
        const cachedTokens = promptTokensDetails?.cached_tokens ?? 0;
        const totalPromptTokens = usage.prompt_tokens;

        if (cachedTokens > 0) {
          log.info("Grok cache hit", {
            cachedTokens,
            totalPromptTokens,
            savingsPercent: Math.round((cachedTokens / totalPromptTokens) * 100),
            keywordCount: keywords.length,
          });
        } else {
          log.debug("Grok cache miss", {
            totalPromptTokens,
            keywordCount: keywords.length,
          });
        }
      }

      const text = response.choices[0]?.message?.content || "";

      let jsonData: unknown;
      try {
        jsonData = JSON.parse(text);
      } catch {
        log.warn("Failed to parse Grok JSON response", { text: text.slice(0, 200) });
        this.circuit.recordFailure();
        throw new Error("Invalid JSON response from Grok");
      }

      const parsed = ClassificationResponseSchema.safeParse(jsonData);

      if (!parsed.success) {
        log.warn("Invalid Grok response schema", { error: parsed.error.message });
        this.circuit.recordFailure();
        throw new Error(`Invalid Grok response: ${parsed.error.message}`);
      }

      this.circuit.recordSuccess();
      return parsed.data.classifications;
    } catch (error) {
      // Don't double-count failures already recorded above
      if (error instanceof Error && !error.message.startsWith("Invalid")) {
        this.circuit.recordFailure();
      }
      throw error;
    }
  }

  /**
   * Classify large keyword sets in batches.
   */
  private async classifyBatched(
    keywords: string[],
    context: BusinessContext
  ): Promise<ClassificationItem[]> {
    const results: ClassificationItem[] = [];

    for (let i = 0; i < keywords.length; i += CLASSIFICATION_CONFIG.BATCH_SIZE) {
      const batch = keywords.slice(i, i + CLASSIFICATION_CONFIG.BATCH_SIZE);
      const batchResults = await this.classify(batch, context);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * System prompt for keyword classification.
   */
  private buildSystemPrompt(): string {
    return `You are an expert keyword classifier for Lithuanian e-commerce and B2B businesses.
Your task is to determine which keywords are relevant for the given business.

CRITICAL: A keyword that is semantically similar but contextually WRONG must be EXCLUDED.
Example: "embroidery services" is EXCLUDE for a company that BUYS embroidery, not SELLS it.

Return ONLY valid JSON matching this schema:
{
  "classifications": [
    {
      "keyword": "string",
      "include": true/false,
      "confidence": 0.0-1.0,
      "type": "product" | "long_tail" | "question" | "local" | "comparison" | null,
      "reasoning": "brief explanation"
    }
  ]
}`;
  }

  /**
   * User prompt with business context and keywords.
   */
  private buildUserPrompt(keywords: string[], context: BusinessContext): string {
    const negativeSection = context.negativeAssociations
      ? `
<negative-associations>
NOT services: ${context.negativeAssociations.notServices.join(", ") || "none specified"}
Competitors: ${context.negativeAssociations.competitors.join(", ") || "none specified"}
Adjacent verticals to EXCLUDE: ${context.negativeAssociations.adjacentVerticals.join(", ") || "none specified"}
Wrong intent signals: ${context.negativeAssociations.wrongIntent.join(", ") || "none specified"}
</negative-associations>`
      : "";

    return `<business-context>
Business: ${context.businessName}
Industry: ${context.industry}
Services they SELL: ${context.services.join(", ")}
Target audience: ${context.targetAudience}
${negativeSection}
</business-context>

<keywords-to-classify>
${keywords.map((k, i) => `${i + 1}. ${k}`).join("\n")}
</keywords-to-classify>

Classify each keyword. For confidence >= 0.85, the classification is final.
For confidence < 0.85, it will be reviewed by a more powerful model.`;
  }

  /**
   * Check if circuit breaker is currently open.
   */
  get isCircuitOpen(): boolean {
    return !this.circuit.allowsRequest;
  }

  /**
   * Reset circuit breaker to closed state.
   */
  resetCircuit(): void {
    this.circuit.reset();
  }
}
