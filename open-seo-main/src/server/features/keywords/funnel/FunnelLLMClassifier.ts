/**
 * FunnelLLMClassifier: LLM-based fallback for low-confidence funnel classification.
 *
 * Uses Grok 4.1 for cost efficiency ($0.20/1M tokens).
 * Processes 100 keywords per batch call with XML prompt format.
 */

import OpenAI from "openai";
import { z } from "zod";
import { createCircuitBreaker, CircuitOpenError, type CircuitBreaker } from "@/server/features/scraping/resilience/CircuitBreaker";
import { createLogger } from "@/server/lib/logger";
import type { FunnelStage, FunnelClassification } from "./types";

const log = createLogger({ module: "FunnelLLMClassifier" });

export { CircuitOpenError };

// LLM response schema
const LLMClassificationSchema = z.object({
  keyword: z.string(),
  stage: z.enum(["bofu", "mofu", "tofu"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});

const LLMResponseSchema = z.object({
  classifications: z.array(LLMClassificationSchema),
});

// Configuration
const CONFIG = {
  baseURL: "https://api.x.ai/v1",
  model: "grok-4-1",
  maxTokens: 4096,
  temperature: 0.1,
  batchSize: 100,
};

export interface LLMClassifierConfig {
  apiKey?: string;
}

export class FunnelLLMClassifier {
  private client: OpenAI;
  private circuit: CircuitBreaker;

  constructor(config: LLMClassifierConfig = {}) {
    const key = config.apiKey ?? process.env.XAI_API_KEY;
    if (!key) {
      throw new Error("XAI_API_KEY not configured");
    }

    this.client = new OpenAI({
      apiKey: key,
      baseURL: CONFIG.baseURL,
    });

    this.circuit = createCircuitBreaker("funnel-llm-classifier", {
      failureThreshold: 3,
      timeout: 60000,
    });
  }

  /**
   * Classify keywords using LLM.
   * Batches keywords into groups of 100 for efficiency.
   */
  async classifyBatch(keywords: string[]): Promise<FunnelClassification[]> {
    if (!this.circuit.allowsRequest) {
      throw new CircuitOpenError("funnel-llm-classifier", 0);
    }

    if (keywords.length === 0) {
      return [];
    }

    // Batch if needed
    if (keywords.length > CONFIG.batchSize) {
      return this.classifyLargeBatch(keywords);
    }

    try {
      const response = await this.client.chat.completions.create({
        model: CONFIG.model,
        messages: [
          { role: "system", content: this.buildSystemPrompt() },
          { role: "user", content: this.buildUserPrompt(keywords) },
        ],
        response_format: { type: "json_object" },
        max_tokens: CONFIG.maxTokens,
        temperature: CONFIG.temperature,
      });

      const text = response.choices[0]?.message?.content || "";

      let jsonData: unknown;
      try {
        jsonData = JSON.parse(text);
      } catch {
        log.warn("Failed to parse LLM JSON response", { text: text.slice(0, 200) });
        this.circuit.recordFailure();
        throw new Error("Invalid JSON response from LLM");
      }

      const parsed = LLMResponseSchema.safeParse(jsonData);

      if (!parsed.success) {
        log.warn("Invalid LLM response schema", { error: parsed.error.message });
        this.circuit.recordFailure();
        throw new Error(`Invalid LLM response: ${parsed.error.message}`);
      }

      this.circuit.recordSuccess();

      // Convert to FunnelClassification format
      return parsed.data.classifications.map((c) => ({
        keyword: c.keyword,
        stage: c.stage as FunnelStage,
        confidence: c.confidence,
        signals: {
          patternMatch: false,
          patternType: null,
          dataForSeoIntent: null,
          businessContextBoost: false,
        },
        reasoning: `LLM: ${c.reasoning}`,
      }));
    } catch (error) {
      if (error instanceof Error && !error.message.startsWith("Invalid")) {
        this.circuit.recordFailure();
      }
      throw error;
    }
  }

  /**
   * Process large batches by splitting into chunks.
   */
  private async classifyLargeBatch(keywords: string[]): Promise<FunnelClassification[]> {
    const results: FunnelClassification[] = [];

    for (let i = 0; i < keywords.length; i += CONFIG.batchSize) {
      const batch = keywords.slice(i, i + CONFIG.batchSize);
      const batchResults = await this.classifyBatch(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * System prompt with funnel classification rubric.
   */
  private buildSystemPrompt(): string {
    return `You are an expert keyword funnel classifier for Lithuanian and English keywords.

Classify each keyword into ONE funnel stage:

<funnel-stages>
BOFU (Bottom of Funnel) - Ready to buy/book NOW:
- Purchase signals: pirkti, kaina, nuolaida, užsakyti
- Booking signals: registruotis, rezervuoti, skambinti
- Local/immediate: šalia manęs, dabar, šiandien
- Delivery: pristatymas, siuntimas
- Product specifics: dydis, spalva, garantija

MOFU (Middle of Funnel) - Comparing options:
- Best/top lists: geriausi, top 10, populiariausi
- Comparisons: palyginti, vs, skirtumai, privalumai/trūkumai
- Reviews: atsiliepimai, nuomonė, ar verta
- Selection: kaip pasirinkti, alternatyva

TOFU (Top of Funnel) - Just learning:
- Definitions: kas yra, kas tai, ką reiškia
- How-to: kaip veikia, kaip naudoti, instrukcija
- Why: kodėl, kam reikia, nauda
- Tips: patarimai, idėjos, klaidos
</funnel-stages>

Return ONLY valid JSON matching this schema:
{
  "classifications": [
    {
      "keyword": "string",
      "stage": "bofu" | "mofu" | "tofu",
      "confidence": 0.0-1.0,
      "reasoning": "brief explanation (max 20 words)"
    }
  ]
}`;
  }

  /**
   * User prompt with keywords to classify.
   */
  private buildUserPrompt(keywords: string[]): string {
    return `<keywords>
${keywords.map((k, i) => `${i + 1}. ${k}`).join("\n")}
</keywords>

Classify each keyword into bofu, mofu, or tofu.
Use confidence >= 0.85 for clear matches, 0.60-0.84 for reasonable guesses.`;
  }

  /**
   * Check if circuit breaker is open.
   */
  get isCircuitOpen(): boolean {
    return !this.circuit.allowsRequest;
  }

  /**
   * Reset circuit breaker.
   */
  resetCircuit(): void {
    this.circuit.reset();
  }
}

/**
 * Factory function.
 */
export function createFunnelLLMClassifier(
  config?: LLMClassifierConfig
): FunnelLLMClassifier {
  return new FunnelLLMClassifier(config);
}
