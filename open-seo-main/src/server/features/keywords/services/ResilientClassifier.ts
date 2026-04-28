/**
 * ResilientClassifier: Keyword classifier with fallback cascade.
 *
 * Cascade order:
 * 1. Claude Sonnet (primary - highest quality)
 * 2. GPT-4o-mini (fallback - cost-effective)
 * 3. Rule-based heuristics (last resort - always available)
 *
 * Features:
 * - Circuit breaker per backend to prevent cascading failures
 * - Tracks which backend served each request (result.source)
 * - Logs all fallback events for monitoring
 * - Never throws - always returns a classification
 */

import { CircuitBreaker, CircuitOpenError } from "./CircuitBreaker";
import { createLogger } from "@/server/lib/logger";
import { anthropicClient, openaiClient, HttpError, TimeoutError } from "@/server/lib/http-client";

const log = createLogger({ module: "ResilientClassifier" });

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ClassifierBackend = "claude" | "openai" | "rules";

export interface ClassificationResult {
  /** The keyword that was classified */
  keyword: string;
  /** Primary category match */
  category: string;
  /** Confidence score 0-1 */
  confidence: number;
  /** Which backend produced this result */
  source: ClassifierBackend;
  /** Whether this was a fallback result */
  isFallback: boolean;
  /** Additional category matches (if any) */
  secondaryCategories?: string[];
  /** Raw reasoning from LLM (if available) */
  reasoning?: string;
}

export interface ClassifierConfig {
  /** Claude API key (optional if using OpenAI fallback only) */
  claudeApiKey?: string;
  /** OpenAI API key (optional if using Claude only) */
  openaiApiKey?: string;
  /** Circuit breaker config for Claude */
  claudeCircuit?: { failureThreshold?: number; resetTimeout?: number };
  /** Circuit breaker config for OpenAI */
  openaiCircuit?: { failureThreshold?: number; resetTimeout?: number };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule-based classifier (always available)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rule-based heuristic classifier for Lithuanian e-commerce keywords.
 * Uses pattern matching and keyword overlap - not as accurate as LLM but never fails.
 */
export class RuleBasedClassifier {
  /**
   * Domain-specific patterns for Lithuanian hair care keywords.
   * Maps patterns to categories with confidence weights.
   */
  private static readonly PATTERNS: ReadonlyArray<{
    pattern: RegExp;
    category: string;
    confidence: number;
  }> = [
    // Product types
    { pattern: /šampūn/i, category: "Šampūnai", confidence: 0.9 },
    { pattern: /kondicion/i, category: "Kondicionieriai", confidence: 0.9 },
    { pattern: /kauk[eė]/i, category: "Kaukės", confidence: 0.85 },
    { pattern: /aliej/i, category: "Aliejai", confidence: 0.85 },
    { pattern: /serum/i, category: "Serumai", confidence: 0.85 },
    { pattern: /purški[kl]/i, category: "Purškikliai", confidence: 0.8 },
    { pattern: /balzam/i, category: "Balzamai", confidence: 0.85 },
    { pattern: /losjon/i, category: "Losjonai", confidence: 0.8 },
    { pattern: /daž/i, category: "Plaukų dažai", confidence: 0.85 },
    { pattern: /gel/i, category: "Geliai", confidence: 0.7 },
    { pattern: /vašk/i, category: "Vaškai", confidence: 0.8 },
    { pattern: /put[ao]/i, category: "Putos", confidence: 0.75 },

    // Hair types/conditions
    { pattern: /riebi/i, category: "Riebiems plaukams", confidence: 0.8 },
    { pattern: /saus/i, category: "Sausiems plaukams", confidence: 0.8 },
    { pattern: /dažyt/i, category: "Dažytiems plaukams", confidence: 0.85 },
    { pattern: /pažeist/i, category: "Pažeistiems plaukams", confidence: 0.8 },
    { pattern: /garbanot/i, category: "Garbanotas", confidence: 0.8 },
    { pattern: /plon/i, category: "Ploniems plaukams", confidence: 0.75 },
    { pattern: /normal/i, category: "Normaliems plaukams", confidence: 0.7 },

    // Actions/treatments
    { pattern: /stiprin/i, category: "Stiprinimas", confidence: 0.8 },
    { pattern: /drėkin/i, category: "Drėkinimas", confidence: 0.8 },
    { pattern: /atstat/i, category: "Atstatymas", confidence: 0.8 },
    { pattern: /apsaug/i, category: "Apsauga", confidence: 0.75 },
    { pattern: /formav/i, category: "Formavimas", confidence: 0.75 },

    // Brands (common Lithuanian market)
    { pattern: /loreal|l'oreal/i, category: "L'Oréal", confidence: 0.95 },
    { pattern: /wella/i, category: "Wella", confidence: 0.95 },
    { pattern: /schwarzkopf/i, category: "Schwarzkopf", confidence: 0.95 },
    { pattern: /matrix/i, category: "Matrix", confidence: 0.95 },
    { pattern: /kerastase|kérastase/i, category: "Kérastase", confidence: 0.95 },
    { pattern: /redken/i, category: "Redken", confidence: 0.95 },
  ];

  classify(keyword: string, availableCategories: string[]): ClassificationResult {
    const keywordLower = keyword.toLowerCase();
    const matches: Array<{ category: string; confidence: number }> = [];

    // Check against patterns
    for (const { pattern, category, confidence } of RuleBasedClassifier.PATTERNS) {
      if (pattern.test(keywordLower)) {
        // Check if this category (or similar) exists in available categories
        const matchedCategory = this.findBestCategoryMatch(category, availableCategories);
        if (matchedCategory) {
          matches.push({ category: matchedCategory, confidence });
        }
      }
    }

    // Fallback: check for direct word overlap with categories
    if (matches.length === 0) {
      for (const category of availableCategories) {
        const categoryWords = category.toLowerCase().split(/\s+/);
        const keywordWords = keywordLower.split(/\s+/);

        const overlap = categoryWords.filter((w) => keywordWords.some((kw) => kw.includes(w) || w.includes(kw)));

        if (overlap.length > 0) {
          const confidence = Math.min(0.6, 0.3 * overlap.length);
          matches.push({ category, confidence });
        }
      }
    }

    // Sort by confidence and take best match
    matches.sort((a, b) => b.confidence - a.confidence);

    if (matches.length > 0) {
      const best = matches[0];
      return {
        keyword,
        category: best.category,
        confidence: best.confidence,
        source: "rules",
        isFallback: false,
        secondaryCategories: matches.slice(1, 4).map((m) => m.category),
        reasoning: `Rule-based match using pattern/overlap analysis`,
      };
    }

    // No match found - return "Uncategorized" with low confidence
    return {
      keyword,
      category: availableCategories[0] || "Uncategorized",
      confidence: 0.1,
      source: "rules",
      isFallback: false,
      reasoning: "No pattern match found, defaulting to first category",
    };
  }

  /**
   * Find best matching category from available categories using fuzzy matching.
   */
  private findBestCategoryMatch(targetCategory: string, availableCategories: string[]): string | null {
    const targetLower = targetCategory.toLowerCase();

    // Exact match
    const exact = availableCategories.find((c) => c.toLowerCase() === targetLower);
    if (exact) return exact;

    // Contains match
    const contains = availableCategories.find(
      (c) => c.toLowerCase().includes(targetLower) || targetLower.includes(c.toLowerCase()),
    );
    if (contains) return contains;

    // Word overlap
    const targetWords = targetLower.split(/\s+/);
    for (const category of availableCategories) {
      const categoryWords = category.toLowerCase().split(/\s+/);
      if (targetWords.some((tw) => categoryWords.some((cw) => tw.includes(cw) || cw.includes(tw)))) {
        return category;
      }
    }

    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM Classifier Interfaces
// ─────────────────────────────────────────────────────────────────────────────

interface LLMClassificationResponse {
  category: string;
  confidence: number;
  secondaryCategories?: string[];
  reasoning?: string;
}

/**
 * Claude classifier implementation.
 * Uses Claude Sonnet for highest quality Lithuanian keyword classification.
 * Configured with 120s timeout for LLM responses.
 */
class ClaudeClassifier {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async classify(keyword: string, categories: string[]): Promise<LLMClassificationResponse> {
    const prompt = this.buildPrompt(keyword, categories);

    try {
      const data = await anthropicClient.post<{
        content: Array<{ type: string; text: string }>;
      }>(
        "/v1/messages",
        {
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [{ role: "user", content: prompt }],
        },
        {
          headers: {
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
          },
          timeout: 120000, // 120 second timeout for LLM
          retries: 1, // Limited retries for expensive API
        },
      );

      const text = data.content[0]?.text || "";
      return this.parseResponse(text, categories);
    } catch (error) {
      if (error instanceof HttpError) {
        throw new Error(`Claude API error: ${error.status} - ${error.body.slice(0, 200)}`);
      }
      if (error instanceof TimeoutError) {
        throw new Error(`Claude API timeout after ${error.timeoutMs}ms`);
      }
      throw error;
    }
  }

  private buildPrompt(keyword: string, categories: string[]): string {
    return `You are a Lithuanian e-commerce keyword classifier. Classify the following keyword into the most appropriate category.

Keyword: "${keyword}"

Available categories:
${categories.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Respond in JSON format:
{
  "category": "exact category name from the list",
  "confidence": 0.0-1.0,
  "secondaryCategories": ["optional", "additional", "matches"],
  "reasoning": "brief explanation in English"
}

Consider Lithuanian morphology - keywords may be in different cases (nominative, genitive, dative, etc.).
Match based on semantic meaning, not just string similarity.`;
  }

  private parseResponse(text: string, categories: string[]): LLMClassificationResponse {
    try {
      // Extract JSON from response (may be wrapped in markdown)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");

      const parsed = JSON.parse(jsonMatch[0]) as {
        category?: string;
        confidence?: number;
        secondaryCategories?: string[];
        reasoning?: string;
      };

      // Validate category is in the list
      const category = categories.find((c) => c.toLowerCase() === (parsed.category || "").toLowerCase()) ||
        categories[0] ||
        "Uncategorized";

      return {
        category,
        confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
        secondaryCategories: parsed.secondaryCategories,
        reasoning: parsed.reasoning,
      };
    } catch {
      log.warn("Failed to parse Claude response", { text: text.slice(0, 200) });
      return {
        category: categories[0] || "Uncategorized",
        confidence: 0.3,
        reasoning: "Parse error - using default",
      };
    }
  }
}

/**
 * OpenAI classifier implementation (GPT-4o-mini).
 * Cost-effective fallback with good Lithuanian support.
 * Configured with 120s timeout for LLM responses.
 */
class OpenAIClassifier {
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async classify(keyword: string, categories: string[]): Promise<LLMClassificationResponse> {
    const prompt = this.buildPrompt(keyword, categories);

    try {
      const data = await openaiClient.post<{
        choices: Array<{ message: { content: string } }>;
      }>(
        "/v1/chat/completions",
        {
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
          response_format: { type: "json_object" },
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
          timeout: 120000, // 120 second timeout for LLM
          retries: 1, // Limited retries for expensive API
        },
      );

      const text = data.choices[0]?.message?.content || "";
      return this.parseResponse(text, categories);
    } catch (error) {
      if (error instanceof HttpError) {
        throw new Error(`OpenAI API error: ${error.status} - ${error.body.slice(0, 200)}`);
      }
      if (error instanceof TimeoutError) {
        throw new Error(`OpenAI API timeout after ${error.timeoutMs}ms`);
      }
      throw error;
    }
  }

  private buildPrompt(keyword: string, categories: string[]): string {
    return `Classify this Lithuanian e-commerce keyword into the most appropriate category.

Keyword: "${keyword}"

Categories:
${categories.map((c, i) => `${i + 1}. ${c}`).join("\n")}

Return JSON:
{
  "category": "exact category from list",
  "confidence": 0.0-1.0,
  "secondaryCategories": ["optional matches"],
  "reasoning": "brief explanation"
}`;
  }

  private parseResponse(text: string, categories: string[]): LLMClassificationResponse {
    try {
      const parsed = JSON.parse(text) as {
        category?: string;
        confidence?: number;
        secondaryCategories?: string[];
        reasoning?: string;
      };

      const category = categories.find((c) => c.toLowerCase() === (parsed.category || "").toLowerCase()) ||
        categories[0] ||
        "Uncategorized";

      return {
        category,
        confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5,
        secondaryCategories: parsed.secondaryCategories,
        reasoning: parsed.reasoning,
      };
    } catch {
      log.warn("Failed to parse OpenAI response", { text: text.slice(0, 200) });
      return {
        category: categories[0] || "Uncategorized",
        confidence: 0.3,
        reasoning: "Parse error - using default",
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ResilientClassifier
// ─────────────────────────────────────────────────────────────────────────────

export class ResilientClassifier {
  private readonly claude: ClaudeClassifier | null;
  private readonly openai: OpenAIClassifier | null;
  private readonly rules: RuleBasedClassifier;

  private readonly claudeCircuit: CircuitBreaker;
  private readonly openaiCircuit: CircuitBreaker;

  constructor(config: ClassifierConfig = {}) {
    // Initialize LLM classifiers if API keys provided
    this.claude = config.claudeApiKey ? new ClaudeClassifier(config.claudeApiKey) : null;

    this.openai = config.openaiApiKey ? new OpenAIClassifier(config.openaiApiKey) : null;

    // Rule-based classifier is always available
    this.rules = new RuleBasedClassifier();

    // Initialize circuit breakers
    this.claudeCircuit = new CircuitBreaker({
      name: "claude-classifier",
      failureThreshold: config.claudeCircuit?.failureThreshold ?? 3,
      resetTimeout: config.claudeCircuit?.resetTimeout ?? 60000,
    });

    this.openaiCircuit = new CircuitBreaker({
      name: "openai-classifier",
      failureThreshold: config.openaiCircuit?.failureThreshold ?? 5,
      resetTimeout: config.openaiCircuit?.resetTimeout ?? 120000,
    });
  }

  /**
   * Classify a keyword into the most appropriate category.
   * Uses fallback cascade: Claude -> GPT-4o-mini -> Rules
   *
   * @param keyword - The keyword to classify
   * @param categories - Available categories to match against
   * @returns Classification result with source indicator
   */
  async classify(keyword: string, categories: string[]): Promise<ClassificationResult> {
    // Validate inputs
    if (!keyword || keyword.trim().length === 0) {
      return {
        keyword: keyword || "",
        category: categories[0] || "Uncategorized",
        confidence: 0,
        source: "rules",
        isFallback: false,
        reasoning: "Empty keyword provided",
      };
    }

    if (categories.length === 0) {
      return {
        keyword,
        category: "Uncategorized",
        confidence: 0,
        source: "rules",
        isFallback: false,
        reasoning: "No categories provided",
      };
    }

    // Try Claude first (if configured and circuit closed)
    if (this.claude && this.claudeCircuit.allowsRequest) {
      try {
        const result = await this.claude.classify(keyword, categories);
        this.claudeCircuit.recordSuccess();

        log.debug("Claude classification succeeded", {
          keyword,
          category: result.category,
          confidence: result.confidence,
        });

        return {
          keyword,
          category: result.category,
          confidence: result.confidence,
          source: "claude",
          isFallback: false,
          secondaryCategories: result.secondaryCategories,
          reasoning: result.reasoning,
        };
      } catch (error) {
        this.claudeCircuit.recordFailure();
        log.warn("Claude classification failed, trying fallback", {
          keyword,
          error: error instanceof Error ? error.message : String(error),
          circuitState: this.claudeCircuit.currentState,
        });
      }
    } else if (this.claude && !this.claudeCircuit.allowsRequest) {
      log.debug("Claude circuit open, skipping", {
        keyword,
        circuitState: this.claudeCircuit.currentState,
      });
    }

    // Try OpenAI fallback (if configured and circuit closed)
    if (this.openai && this.openaiCircuit.allowsRequest) {
      try {
        const result = await this.openai.classify(keyword, categories);
        this.openaiCircuit.recordSuccess();

        log.info("OpenAI fallback succeeded", {
          keyword,
          category: result.category,
          confidence: result.confidence,
        });

        return {
          keyword,
          category: result.category,
          confidence: result.confidence,
          source: "openai",
          isFallback: true,
          secondaryCategories: result.secondaryCategories,
          reasoning: result.reasoning,
        };
      } catch (error) {
        this.openaiCircuit.recordFailure();
        log.warn("OpenAI classification failed, using rules", {
          keyword,
          error: error instanceof Error ? error.message : String(error),
          circuitState: this.openaiCircuit.currentState,
        });
      }
    } else if (this.openai && !this.openaiCircuit.allowsRequest) {
      log.debug("OpenAI circuit open, skipping", {
        keyword,
        circuitState: this.openaiCircuit.currentState,
      });
    }

    // Last resort: rule-based classification
    log.info("Using rule-based classification", { keyword });
    const result = this.rules.classify(keyword, categories);
    return {
      ...result,
      isFallback: this.claude !== null || this.openai !== null,
    };
  }

  /**
   * Classify multiple keywords in batch.
   * Returns results in same order as input keywords.
   */
  async classifyBatch(keywords: string[], categories: string[]): Promise<ClassificationResult[]> {
    // Process in parallel with concurrency limit
    const results: ClassificationResult[] = [];
    const batchSize = 5; // Limit concurrent API calls

    for (let i = 0; i < keywords.length; i += batchSize) {
      const batch = keywords.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map((kw) => this.classify(kw, categories)));
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Get current circuit breaker states for monitoring.
   */
  getCircuitStates(): { claude: string; openai: string } {
    return {
      claude: this.claudeCircuit.currentState,
      openai: this.openaiCircuit.currentState,
    };
  }

  /**
   * Reset all circuit breakers (for testing/recovery).
   */
  resetCircuits(): void {
    this.claudeCircuit.reset();
    this.openaiCircuit.reset();
    log.info("All classifier circuits reset");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a ResilientClassifier with environment-based configuration.
 */
export function createResilientClassifier(): ResilientClassifier {
  return new ResilientClassifier({
    claudeApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
  });
}
