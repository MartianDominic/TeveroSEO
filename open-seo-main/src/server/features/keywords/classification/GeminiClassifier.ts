/**
 * GeminiClassifier: Pass 1 fallback classifier using Gemini 2.5 Flash Lite.
 *
 * Used when Grok circuit breaker is open.
 */

import { z } from "zod";
import { CircuitBreaker, CircuitOpenError } from "../services/CircuitBreaker";
import {
  ClassificationResponseSchema,
  type BusinessContext,
  type ClassificationItem,
} from "./types";
import { GEMINI_CONFIG, CLASSIFICATION_CONFIG } from "./config";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "GeminiClassifier" });

export class GeminiClassifier {
  private apiKey: string;
  private circuit: CircuitBreaker;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.circuit = new CircuitBreaker({
      name: "gemini-classifier",
      failureThreshold: 3,
      resetTimeout: 60000,
    });
  }

  async classify(
    keywords: string[],
    context: BusinessContext
  ): Promise<ClassificationItem[]> {
    if (!this.circuit.allowsRequest) {
      throw new CircuitOpenError("gemini-classifier");
    }

    if (keywords.length > CLASSIFICATION_CONFIG.BATCH_SIZE) {
      return this.classifyBatched(keywords, context);
    }

    try {
      const prompt = this.buildPrompt(keywords, context);
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_CONFIG.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: GEMINI_CONFIG.maxTokens,
              temperature: GEMINI_CONFIG.temperature,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        log.warn("Gemini API error", { status: response.status, error: errorText.slice(0, 200) });
        this.circuit.recordFailure();
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      const parsed = ClassificationResponseSchema.safeParse(JSON.parse(text));

      if (!parsed.success) {
        log.warn("Invalid Gemini response", { error: parsed.error.message });
        this.circuit.recordFailure();
        throw new Error(`Invalid Gemini response: ${parsed.error.message}`);
      }

      this.circuit.recordSuccess();
      return parsed.data.classifications;
    } catch (error) {
      // Only record failure if not already recorded above (avoid double-counting)
      // Errors with "Invalid Gemini response" or "Gemini API error" were already counted
      if (
        error instanceof Error &&
        !error.message.startsWith("Invalid Gemini response") &&
        !error.message.startsWith("Gemini API error")
      ) {
        this.circuit.recordFailure();
      }
      throw error;
    }
  }

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

  private buildPrompt(keywords: string[], context: BusinessContext): string {
    const negativeSection = context.negativeAssociations
      ? `
NOT services: ${context.negativeAssociations.notServices.join(", ")}
Adjacent verticals to EXCLUDE: ${context.negativeAssociations.adjacentVerticals.join(", ")}`
      : "";

    return `You are an expert keyword classifier for Lithuanian e-commerce and B2B businesses.

<business-context>
Business: ${context.businessName}
Industry: ${context.industry}
Services: ${context.services.join(", ")}
Target: ${context.targetAudience}
${negativeSection}
</business-context>

<keywords>
${keywords.map((k, i) => `${i + 1}. ${k}`).join("\n")}
</keywords>

Return JSON: {"classifications": [{"keyword": "...", "include": true/false, "confidence": 0.0-1.0, "type": "product"|"long_tail"|"question"|"local"|"comparison"|null, "reasoning": "..."}]}`;
  }

  get isCircuitOpen(): boolean {
    return !this.circuit.allowsRequest;
  }

  resetCircuit(): void {
    this.circuit.reset();
  }
}

export { CircuitOpenError };
