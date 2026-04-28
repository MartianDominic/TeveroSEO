/**
 * Keyword Classification Prompt Builder
 *
 * Production utility for building and executing keyword classification prompts
 * against an LLM API. Designed for Lithuanian hair care e-commerce.
 *
 * Usage:
 *   const classifier = new KeywordClassifier(categories);
 *   const results = await classifier.classifyBatch(keywords);
 */

import * as fs from "fs";
import * as path from "path";

// ============================================================================
// Types
// ============================================================================

export interface Category {
  id: string;
  name: string;
  name_en: string;
  description: string;
  keywords_hint?: string;
  parent_category?: string | null;
}

export interface KeywordInput {
  id: string;
  term: string;
  search_volume: number;
  cpc?: number;
  competition?: number;
}

export interface ClassificationFlags {
  brand_keyword: boolean;
  informational_intent: boolean;
  multi_category: boolean;
  needs_review: boolean;
}

export interface SecondaryCategory {
  id: string;
  name: string;
  reason: string;
}

export interface ClassifiedKeyword {
  keyword_id: string;
  keyword: string;
  search_volume: number;
  primary_category: {
    id: string;
    name: string;
    name_en: string;
  };
  confidence: number;
  secondary_categories: SecondaryCategory[];
  reasoning_summary: string;
  flags: ClassificationFlags;
  morphological_root?: string;
}

export interface UnclassifiedKeyword {
  keyword_id: string;
  keyword: string;
  reason: string;
  suggested_action: "create_category" | "manual_review" | "ignore";
}

export interface ClassificationResult {
  batch_id: string;
  processed_at: string;
  model_version: string;
  statistics: {
    total_keywords: number;
    high_confidence: number;
    medium_confidence: number;
    low_confidence: number;
    needs_review: number;
    multi_category: number;
  };
  classifications: ClassifiedKeyword[];
  unclassified: UnclassifiedKeyword[];
}

export interface ClassifierConfig {
  batchSize: number;
  promptTemplatePath: string;
  retryAttempts: number;
  confidenceThresholds: {
    high: number;
    medium: number;
  };
}

// ============================================================================
// Prompt Builder
// ============================================================================

export class KeywordClassificationPromptBuilder {
  private template: string;
  private categories: Category[];

  constructor(templatePath: string, categories: Category[]) {
    this.template = fs.readFileSync(templatePath, "utf-8");
    this.categories = categories;
  }

  /**
   * Build the full prompt with categories and keywords injected
   */
  buildPrompt(keywords: KeywordInput[], batchId: string): string {
    const categoriesXml = this.buildCategoriesXml();
    const keywordsXml = this.buildKeywordsXml(keywords, batchId);

    return this.template
      .replace("{{CATEGORIES_PLACEHOLDER}}", categoriesXml)
      .replace("{{KEYWORDS_PLACEHOLDER}}", keywordsXml)
      .replace("{{BATCH_ID}}", batchId);
  }

  /**
   * Build XML for categories section
   */
  private buildCategoriesXml(): string {
    return this.categories
      .map(
        (cat) => `
    <category id="${this.escapeXml(cat.id)}">
      <name>${this.escapeXml(cat.name)}</name>
      <name_en>${this.escapeXml(cat.name_en)}</name_en>
      <description>${this.escapeXml(cat.description)}</description>
      ${cat.keywords_hint ? `<keywords_hint>${this.escapeXml(cat.keywords_hint)}</keywords_hint>` : ""}
      <parent_category>${cat.parent_category || "null"}</parent_category>
    </category>`
      )
      .join("\n");
  }

  /**
   * Build XML for keywords batch section
   */
  private buildKeywordsXml(keywords: KeywordInput[], batchId: string): string {
    return keywords
      .map(
        (kw) => `
    <keyword id="${this.escapeXml(kw.id)}">
      <term>${this.escapeXml(kw.term)}</term>
      <search_volume>${kw.search_volume}</search_volume>
      ${kw.cpc !== undefined ? `<cpc>${kw.cpc}</cpc>` : ""}
      ${kw.competition !== undefined ? `<competition>${kw.competition}</competition>` : ""}
    </keyword>`
      )
      .join("\n");
  }

  /**
   * Escape special XML characters
   */
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}

// ============================================================================
// Response Parser
// ============================================================================

export class ClassificationResponseParser {
  /**
   * Parse JSON response from LLM
   * Handles common issues like markdown code blocks, trailing commas
   */
  parseResponse(response: string): ClassificationResult {
    // Extract JSON from potential markdown code blocks
    let jsonStr = response;

    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Clean up common JSON issues
    jsonStr = jsonStr
      .trim()
      // Remove trailing commas before ] or }
      .replace(/,(\s*[}\]])/g, "$1")
      // Fix unescaped newlines in strings (rare but happens)
      .replace(/(?<!\\)\n(?=[^"]*"[^"]*$)/gm, "\\n");

    try {
      const parsed = JSON.parse(jsonStr) as ClassificationResult;
      return this.validateAndNormalize(parsed);
    } catch (error) {
      throw new Error(
        `Failed to parse classification response: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Validate response structure and normalize data
   */
  private validateAndNormalize(
    result: ClassificationResult
  ): ClassificationResult {
    // Ensure required fields exist
    if (!result.classifications) {
      result.classifications = [];
    }
    if (!result.unclassified) {
      result.unclassified = [];
    }
    if (!result.statistics) {
      result.statistics = this.calculateStatistics(result);
    }

    // Normalize confidence scores to [0, 1]
    result.classifications = result.classifications.map((c) => ({
      ...c,
      confidence: Math.max(0, Math.min(1, c.confidence)),
    }));

    // Recalculate statistics to ensure accuracy
    result.statistics = this.calculateStatistics(result);

    return result;
  }

  /**
   * Calculate statistics from classifications
   */
  private calculateStatistics(result: ClassificationResult) {
    const classifications = result.classifications;
    return {
      total_keywords:
        classifications.length + (result.unclassified?.length || 0),
      high_confidence: classifications.filter((c) => c.confidence >= 0.85)
        .length,
      medium_confidence: classifications.filter(
        (c) => c.confidence >= 0.7 && c.confidence < 0.85
      ).length,
      low_confidence: classifications.filter((c) => c.confidence < 0.7).length,
      needs_review: classifications.filter((c) => c.flags.needs_review).length,
      multi_category: classifications.filter((c) => c.flags.multi_category)
        .length,
    };
  }
}

// ============================================================================
// Main Classifier Class
// ============================================================================

export class KeywordClassifier {
  private promptBuilder: KeywordClassificationPromptBuilder;
  private responseParser: ClassificationResponseParser;
  private config: ClassifierConfig;

  constructor(categories: Category[], config?: Partial<ClassifierConfig>) {
    this.config = {
      batchSize: 50,
      promptTemplatePath: path.join(
        __dirname,
        "keyword-classification-prompt.xml"
      ),
      retryAttempts: 3,
      confidenceThresholds: {
        high: 0.85,
        medium: 0.7,
      },
      ...config,
    };

    this.promptBuilder = new KeywordClassificationPromptBuilder(
      this.config.promptTemplatePath,
      categories
    );
    this.responseParser = new ClassificationResponseParser();
  }

  /**
   * Classify a batch of keywords
   * Override sendToLLM in subclass to integrate with your LLM provider
   */
  async classifyBatch(keywords: KeywordInput[]): Promise<ClassificationResult> {
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const prompt = this.promptBuilder.buildPrompt(keywords, batchId);

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await this.sendToLLM(prompt);
        return this.responseParser.parseResponse(response);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `Classification attempt ${attempt} failed: ${lastError.message}`
        );

        if (attempt < this.config.retryAttempts) {
          // Exponential backoff
          await this.sleep(1000 * Math.pow(2, attempt - 1));
        }
      }
    }

    throw new Error(
      `Classification failed after ${this.config.retryAttempts} attempts: ${lastError?.message}`
    );
  }

  /**
   * Process keywords in batches
   */
  async classifyAll(
    keywords: KeywordInput[]
  ): Promise<ClassificationResult[]> {
    const batches: KeywordInput[][] = [];

    for (let i = 0; i < keywords.length; i += this.config.batchSize) {
      batches.push(keywords.slice(i, i + this.config.batchSize));
    }

    const results: ClassificationResult[] = [];

    for (const batch of batches) {
      const result = await this.classifyBatch(batch);
      results.push(result);
    }

    return results;
  }

  /**
   * Merge multiple batch results into one
   */
  mergeResults(results: ClassificationResult[]): ClassificationResult {
    const merged: ClassificationResult = {
      batch_id: `merged_${Date.now()}`,
      processed_at: new Date().toISOString(),
      model_version: results[0]?.model_version || "classifier_v1",
      statistics: {
        total_keywords: 0,
        high_confidence: 0,
        medium_confidence: 0,
        low_confidence: 0,
        needs_review: 0,
        multi_category: 0,
      },
      classifications: [],
      unclassified: [],
    };

    for (const result of results) {
      merged.classifications.push(...result.classifications);
      merged.unclassified.push(...result.unclassified);

      merged.statistics.total_keywords += result.statistics.total_keywords;
      merged.statistics.high_confidence += result.statistics.high_confidence;
      merged.statistics.medium_confidence += result.statistics.medium_confidence;
      merged.statistics.low_confidence += result.statistics.low_confidence;
      merged.statistics.needs_review += result.statistics.needs_review;
      merged.statistics.multi_category += result.statistics.multi_category;
    }

    return merged;
  }

  /**
   * Override this method to integrate with your LLM provider
   * (Anthropic, OpenAI, etc.)
   */
  protected async sendToLLM(prompt: string): Promise<string> {
    throw new Error(
      "sendToLLM must be implemented by subclass. " +
        "Override this method to integrate with your LLM provider."
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Example LLM Integration (Anthropic)
// ============================================================================

/**
 * Example implementation for Anthropic Claude API
 * Requires: @anthropic-ai/sdk
 */
export class AnthropicKeywordClassifier extends KeywordClassifier {
  private anthropic: any; // Anthropic client
  private model: string;

  constructor(
    categories: Category[],
    apiKey: string,
    config?: Partial<ClassifierConfig> & { model?: string }
  ) {
    super(categories, config);

    // Dynamic import pattern - user must have @anthropic-ai/sdk installed
    const Anthropic = require("@anthropic-ai/sdk");
    this.anthropic = new Anthropic({ apiKey });
    this.model = config?.model || "claude-sonnet-4-20250514";
  }

  protected async sendToLLM(prompt: string): Promise<string> {
    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    // Extract text content from response
    const textContent = response.content.find(
      (block: any) => block.type === "text"
    );
    if (!textContent) {
      throw new Error("No text content in LLM response");
    }

    return textContent.text;
  }
}

// ============================================================================
// Lithuanian Morphology Helpers
// ============================================================================

/**
 * Common Lithuanian hair care keyword patterns
 * Useful for pre-processing and post-validation
 */
export const LITHUANIAN_PATTERNS = {
  // Genitive + Nominative (most common product pattern)
  PRODUCT_PATTERN: /^(plaukų|galvos\s+odos)\s+(.+)$/i,

  // Dative (for X purpose)
  PURPOSE_PATTERN: /^(.+)\s+(plaukams|galvai)$/i,

  // Infinitive (action verbs)
  ACTION_PATTERN:
    /^(kaip|kodėl|ar)\s+.*(dažyti|plauti|tvarkyti|gydyti|stiprinti)/i,

  // Price/purchase intent
  TRANSACTIONAL_INTENT: /\b(kaina|kainos|pirkti|užsisakyti|pigiai|nuolaida)\b/i,

  // Informational intent
  INFORMATIONAL_INTENT: /^(kaip|kodėl|ar|kas|koks|kur)\b/i,

  // Common hair care terms (normalized forms)
  NORMALIZED_TERMS: {
    // Hair dye variations
    "plaukų dažai": ["plaukų dažų", "plaukų dažais", "dažyti plaukus", "plaukų dažymas"],
    // Shampoo variations
    šampūnas: ["šampūno", "šampūnų", "šampūnu"],
    // Conditioner variations
    kondicionierius: ["kondicionieriaus", "kondicionierių", "kondicionieriai"],
    // Mask variations
    kaukė: ["kaukės", "kaukę", "kaukių"],
    // Treatment variations
    gydymas: ["gydymo", "gydymui", "gydyti"],
  },
};

/**
 * Normalize Lithuanian keyword to base form
 * Simple heuristic - a full implementation would use a proper lemmatizer
 */
export function normalizeLithuanianKeyword(keyword: string): string {
  let normalized = keyword.toLowerCase().trim();

  // Check known normalized forms
  for (const [base, variants] of Object.entries(
    LITHUANIAN_PATTERNS.NORMALIZED_TERMS
  )) {
    for (const variant of variants) {
      if (normalized.includes(variant)) {
        normalized = normalized.replace(variant, base);
      }
    }
  }

  return normalized;
}

/**
 * Detect search intent from Lithuanian keyword
 */
export function detectIntent(
  keyword: string
): "transactional" | "informational" | "navigational" | "commercial" {
  const lower = keyword.toLowerCase();

  if (LITHUANIAN_PATTERNS.TRANSACTIONAL_INTENT.test(lower)) {
    return "transactional";
  }

  if (LITHUANIAN_PATTERNS.INFORMATIONAL_INTENT.test(lower)) {
    return "informational";
  }

  // Brand-only keywords (no generic terms) = navigational
  const genericTerms = [
    "plaukų",
    "šampūnas",
    "kondicionierius",
    "kaukė",
    "dažai",
  ];
  const hasGenericTerm = genericTerms.some((term) => lower.includes(term));
  if (!hasGenericTerm && lower.split(" ").length <= 2) {
    return "navigational";
  }

  return "commercial";
}
