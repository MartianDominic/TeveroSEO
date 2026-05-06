/**
 * QualityGateService - Phase 92 On-Page SEO Mastery
 *
 * Implements 7 primary quality gates (T5-01 to T5-07) using hybrid embedding + LLM approach.
 *
 * Gates:
 * - T5-01: Reddit Test - Would content survive scrutiny on r/[vertical]?
 * - T5-02: Information Gain - Does content add unique value vs SERP?
 * - T5-03: Prove-It Details - Are claims backed by evidence?
 * - T5-04: Not For You Block - Audience qualification present?
 * - T5-05: QDD Vulnerability - Is this just another me-too result?
 * - T5-06: Thin Content - Word count meets vertical minimum?
 * - T5-07: Fluff Detection - Filler content and weasel words
 *
 * Requirements:
 * - OPM-07: Reddit Test evaluates content specificity using embedding similarity
 * - OPM-08: Information Gain compares content against SERP competitors
 * - OPM-09: Prove-It Details checks claim-evidence pairing
 * - OPM-10: LLM fallback for borderline cases with Zod validation
 */

import OpenAI from "openai";
import { z } from "zod";

import {
  CircuitBreaker,
  CircuitOpenError,
} from "@/server/features/keywords/services/CircuitBreaker";
import {
  getEmbeddingService,
  cosineSimilarity,
} from "@/server/features/keywords/services/EmbeddingService";
import {
  extractEntities,
  stripPII,
  calculateEvidenceDensity,
} from "../utils";
import type { GateResult, Vertical } from "../types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "QualityGateService" });

// ============================================================================
// Zod Schemas for LLM Response Validation
// ============================================================================

/**
 * Schema for Reddit Test LLM response.
 */
const RedditTestResponseSchema = z.object({
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  reasoning: z.string(),
  specificExamples: z.array(z.string()).optional(),
});

/**
 * Schema for Prove-It Details LLM response.
 */
const ProveItResponseSchema = z.object({
  score: z.number().min(0).max(100),
  claimCount: z.number(),
  provenClaims: z.number(),
  unprovenClaims: z.array(z.string()),
  reasoning: z.string(),
});

// ============================================================================
// Constants
// ============================================================================

/**
 * Similarity thresholds for embedding-based evaluation.
 */
const SIMILARITY_PASS = 0.85;
const SIMILARITY_FAIL = 0.70;

/**
 * Minimum word counts by vertical.
 * YMYL verticals require more comprehensive content.
 */
const MIN_WORD_COUNTS: Record<Vertical, number> = {
  healthcare: 800,
  legal: 800,
  financial: 800,
  ecommerce: 300,
  saas: 500,
  real_estate: 400,
  home_services: 400,
  hospitality: 400,
  education: 600,
  professional: 500,
  manufacturing: 500,
  nonprofit: 500,
  general: 400,
};

/**
 * Fluff phrases to detect (instant quality reduction).
 */
const FLUFF_PHRASES = [
  "it goes without saying",
  "needless to say",
  "as you probably know",
  "in today's digital age",
  "in the world of",
  "when it comes to",
  "at the end of the day",
  "the fact of the matter",
  "all things considered",
  "in other words",
  "simply put",
];

/**
 * Weasel words that weaken claims.
 */
const WEASEL_WORDS = [
  "may",
  "might",
  "could potentially",
  "possibly",
  "perhaps",
  "some experts",
  "many believe",
  "most people",
  "relatively",
  "fairly",
  "somewhat",
  "quite",
  "tends to",
  "seems to",
  "appears to",
];

// ============================================================================
// Configuration
// ============================================================================

/**
 * Quality gate service configuration.
 */
export interface QualityGateConfig {
  /** Enable LLM fallback for borderline embedding cases */
  enableLLMFallback: boolean;
  /** Execution tier: basic (free checks), standard (+embedding), full (+SERP) */
  tier: "basic" | "standard" | "full";
}

const DEFAULT_CONFIG: QualityGateConfig = {
  enableLLMFallback: true,
  tier: "standard",
};

// ============================================================================
// QualityGateService
// ============================================================================

/**
 * Service for evaluating content quality using 7 primary gates.
 *
 * Uses a hybrid approach:
 * - Rule-based checks for simple patterns (free)
 * - Embedding similarity for semantic analysis (cheap)
 * - LLM fallback for borderline cases (expensive, used sparingly)
 */
export class QualityGateService {
  private readonly client: OpenAI;
  private readonly circuit: CircuitBreaker;
  private readonly config: QualityGateConfig;

  constructor(apiKey?: string, config?: Partial<QualityGateConfig>) {
    const key = apiKey ?? process.env.XAI_API_KEY;
    if (!key) {
      throw new Error("XAI_API_KEY not configured");
    }

    this.client = new OpenAI({
      apiKey: key,
      baseURL: "https://api.x.ai/v1",
    });

    this.circuit = new CircuitBreaker({
      name: "quality-gate",
      failureThreshold: 3,
      resetTimeout: 60000,
    });

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    };
  }

  // ==========================================================================
  // T5-01: Reddit Test
  // ==========================================================================

  /**
   * T5-01: Reddit Test
   *
   * Evaluates if content would survive scrutiny on r/[vertical] without being
   * criticized for vagueness or lack of expertise.
   *
   * @param content - Content to evaluate
   * @param vertical - Industry vertical for context
   * @returns GateResult with pass/fail and score
   */
  async evaluateRedditTest(
    content: string,
    vertical: Vertical
  ): Promise<GateResult> {
    const wordCount = content.split(/\s+/).length;

    // Skip for very short content
    if (wordCount < 100) {
      return {
        passed: true,
        score: 100,
        message: "Content too short for Reddit Test",
        method: "rule",
        confidence: "high",
      };
    }

    // Strip PII before any embedding/LLM calls
    const sanitizedContent = stripPII(content);

    // Generate embedding for content
    const embeddingService = getEmbeddingService();
    const contentEmbedding = await embeddingService.embedQuery(
      sanitizedContent.slice(0, 5000)
    );

    // Get reference embeddings for vertical (high-quality examples)
    const references = await this.getReferenceEmbeddings(
      "reddit-quality",
      vertical
    );

    if (references.length === 0) {
      // No references available, use LLM directly
      return this.evaluateRedditTestWithLLM(sanitizedContent, vertical);
    }

    // Calculate max similarity
    const similarities = references.map((ref) =>
      cosineSimilarity(contentEmbedding, ref)
    );
    const maxSimilarity = Math.max(...similarities);

    // Three-tier decision
    if (maxSimilarity >= SIMILARITY_PASS) {
      return {
        passed: true,
        score: maxSimilarity * 100,
        message:
          "Content demonstrates specificity and expertise expected by domain communities",
        method: "embedding",
        confidence: "high",
        embeddingSimilarity: maxSimilarity,
      };
    } else if (maxSimilarity <= SIMILARITY_FAIL) {
      return {
        passed: false,
        score: maxSimilarity * 100,
        message: "Content is generic and would be criticized for lack of specificity",
        method: "embedding",
        confidence: "high",
        embeddingSimilarity: maxSimilarity,
      };
    } else if (this.config.enableLLMFallback) {
      // Borderline: LLM fallback
      const llmResult = await this.evaluateRedditTestWithLLM(
        sanitizedContent,
        vertical
      );
      return {
        ...llmResult,
        method: "llm-fallback",
        embeddingSimilarity: maxSimilarity,
      };
    } else {
      // No LLM fallback, use conservative threshold
      return {
        passed: maxSimilarity >= 0.75,
        score: maxSimilarity * 100,
        message:
          maxSimilarity >= 0.75
            ? "Content passes borderline threshold"
            : "Content may lack specificity (borderline, LLM fallback disabled)",
        method: "embedding",
        confidence: "medium",
        embeddingSimilarity: maxSimilarity,
      };
    }
  }

  /**
   * Evaluate Reddit Test using LLM when embedding analysis is inconclusive.
   */
  private async evaluateRedditTestWithLLM(
    content: string,
    vertical: Vertical
  ): Promise<GateResult> {
    if (!this.circuit.allowsRequest) {
      throw new CircuitOpenError("quality-gate");
    }

    try {
      const prompt = `Evaluate if this ${vertical} content would survive scrutiny on r/${vertical} without being criticized for vagueness or lack of expertise. Score 0-100.

Content (first 2000 chars):
${content.slice(0, 2000)}

Criteria:
- Specific examples, numbers, or case studies
- Domain expertise signals
- Avoids generic advice
- Includes contrarian or nuanced takes
- Not AI-generated slop

Return JSON: { "score": number, "passed": boolean, "reasoning": string, "specificExamples": string[] }`;

      const response = await this.client.chat.completions.create({
        model: "grok-4-1-fast-reasoning",
        messages: [
          {
            role: "system",
            content:
              "You evaluate content quality for SEO. Return only valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 300,
        temperature: 0.3,
      });

      const text = response.choices[0]?.message?.content || "";
      let jsonData: unknown;

      try {
        jsonData = JSON.parse(text);
      } catch {
        this.circuit.recordFailure();
        throw new Error(`Invalid JSON response from LLM: ${text.slice(0, 100)}`);
      }

      const parsed = RedditTestResponseSchema.safeParse(jsonData);

      if (!parsed.success) {
        this.circuit.recordFailure();
        throw new Error(`Invalid LLM response: ${parsed.error.message}`);
      }

      this.circuit.recordSuccess();

      return {
        passed: parsed.data.passed,
        score: parsed.data.score,
        message: parsed.data.reasoning,
        method: "llm",
        confidence: "medium",
      };
    } catch (error) {
      // Don't double-count failures already recorded
      if (
        error instanceof Error &&
        !error.message.startsWith("Invalid") &&
        !(error instanceof CircuitOpenError)
      ) {
        this.circuit.recordFailure();
      }
      throw error;
    }
  }

  // ==========================================================================
  // T5-02: Information Gain vs SERP
  // ==========================================================================

  /**
   * T5-02: Information Gain vs SERP
   *
   * Evaluates if content adds unique value compared to existing SERP results.
   *
   * @param content - Content to evaluate
   * @param serpContent - Array of competitor content from SERP
   * @returns GateResult with information gain score
   */
  async evaluateInformationGain(
    content: string,
    serpContent: string[]
  ): Promise<GateResult> {
    if (serpContent.length === 0) {
      return {
        passed: true,
        score: 100,
        message: "No SERP content provided for comparison",
        method: "rule",
        confidence: "low",
      };
    }

    const embeddingService = getEmbeddingService();
    const sanitizedContent = stripPII(content);

    const contentEmbedding = await embeddingService.embedQuery(
      sanitizedContent.slice(0, 5000)
    );

    // Calculate average similarity with SERP content
    const serpEmbeddings = await embeddingService.embedPassages(
      serpContent.slice(0, 5).map((s) => s.slice(0, 3000))
    );

    const avgSimilarity =
      serpEmbeddings.reduce(
        (sum, emb) => sum + cosineSimilarity(contentEmbedding, emb),
        0
      ) / serpEmbeddings.length;

    // Information gain = 1 - similarity (lower similarity = more unique)
    const informationGain = 1 - avgSimilarity;
    const score = informationGain * 100;

    return {
      passed: informationGain >= 0.4, // At least 40% unique
      score,
      message:
        informationGain >= 0.4
          ? `Content provides ${Math.round(informationGain * 100)}% unique information`
          : `Content too similar to existing SERP results (${Math.round((1 - informationGain) * 100)}% overlap)`,
      method: "embedding",
      confidence: "high",
      embeddingSimilarity: avgSimilarity,
    };
  }

  // ==========================================================================
  // T5-03: Prove-It Details
  // ==========================================================================

  /**
   * T5-03: Prove-It Details
   *
   * Evaluates if every claim is backed by evidence in the same paragraph.
   *
   * @param content - Content to evaluate
   * @param vertical - Industry vertical for context
   * @returns GateResult with evidence density score
   */
  async evaluateProveItDetails(
    content: string,
    vertical: Vertical
  ): Promise<GateResult> {
    const evidenceDensity = calculateEvidenceDensity(content);
    const entities = extractEntities(content);

    // Evidence every 200 words = density of 1.0
    // We want at least 1 evidence per 200 words
    const wordCount = content.split(/\s+/).length;
    const requiredEvidence = wordCount / 200;

    // Basic rule-based evaluation
    if (evidenceDensity >= requiredEvidence * 0.8) {
      return {
        passed: true,
        score: Math.min(100, (evidenceDensity / requiredEvidence) * 100),
        message: `Evidence density: ${evidenceDensity.toFixed(1)} per 200 words (target: ${requiredEvidence.toFixed(1)})`,
        method: "rule",
        confidence: "high",
      };
    }

    // For YMYL content, use LLM for deeper analysis
    if (
      ["healthcare", "legal", "financial"].includes(vertical) &&
      this.config.enableLLMFallback
    ) {
      return this.evaluateProveItWithLLM(stripPII(content), vertical);
    }

    return {
      passed: false,
      score: (evidenceDensity / requiredEvidence) * 100,
      message: `Insufficient evidence: ${evidenceDensity.toFixed(1)} per 200 words (need ${requiredEvidence.toFixed(1)})`,
      method: "rule",
      confidence: "high",
    };
  }

  /**
   * Evaluate Prove-It Details using LLM for YMYL verticals.
   */
  private async evaluateProveItWithLLM(
    content: string,
    vertical: Vertical
  ): Promise<GateResult> {
    if (!this.circuit.allowsRequest) {
      throw new CircuitOpenError("quality-gate");
    }

    try {
      const prompt = `Analyze this ${vertical} content for claim-evidence pairing. Identify claims without proof.

Content (first 2000 chars):
${content.slice(0, 2000)}

For each claim, check if proof is in the SAME paragraph (not later).
Proof types: statistics, sources, examples, data, citations.

Return JSON: { "score": number (0-100), "claimCount": number, "provenClaims": number, "unprovenClaims": string[], "reasoning": string }`;

      const response = await this.client.chat.completions.create({
        model: "grok-4-1-fast-reasoning",
        messages: [
          {
            role: "system",
            content:
              "You analyze content for evidence-backed claims. Return only valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
        temperature: 0.3,
      });

      const text = response.choices[0]?.message?.content || "";
      let jsonData: unknown;

      try {
        jsonData = JSON.parse(text);
      } catch {
        this.circuit.recordFailure();
        throw new Error(`Invalid JSON response from LLM: ${text.slice(0, 100)}`);
      }

      const parsed = ProveItResponseSchema.safeParse(jsonData);

      if (!parsed.success) {
        this.circuit.recordFailure();
        throw new Error(`Invalid LLM response: ${parsed.error.message}`);
      }

      this.circuit.recordSuccess();

      return {
        passed: parsed.data.score >= 70,
        score: parsed.data.score,
        message: `${parsed.data.provenClaims}/${parsed.data.claimCount} claims backed by evidence`,
        method: "llm",
        confidence: "medium",
      };
    } catch (error) {
      if (
        error instanceof Error &&
        !error.message.startsWith("Invalid") &&
        !(error instanceof CircuitOpenError)
      ) {
        this.circuit.recordFailure();
      }
      throw error;
    }
  }

  // ==========================================================================
  // T5-04: Not For You Block
  // ==========================================================================

  /**
   * T5-04: Not For You Block
   *
   * Checks for audience qualification statements that help readers self-select.
   *
   * @param content - Content to evaluate
   * @returns GateResult with qualification presence
   */
  evaluateNotForYou(content: string): GateResult {
    const patterns = [
      /this (guide|article|post) is (for|not for)/i,
      /if you('re| are) (looking for|not interested in)/i,
      /this is (best suited|not suitable) for/i,
      /you should (read this if|skip this if)/i,
      /prerequisites?:/i,
      /who this is for/i,
    ];

    const hasNotForYou = patterns.some((p) => p.test(content));

    return {
      passed: true, // This is a bonus, not a requirement
      score: hasNotForYou ? 100 : 70,
      message: hasNotForYou
        ? "Content includes audience qualification"
        : "Consider adding 'who this is for' section",
      method: "rule",
      confidence: "high",
    };
  }

  // ==========================================================================
  // T5-05: QDD Vulnerability
  // ==========================================================================

  /**
   * T5-05: QDD Vulnerability
   *
   * Query Deserves Diversity - checks if content is too similar to existing SERP results.
   *
   * @param content - Content to evaluate
   * @param serpContent - Array of competitor content from SERP
   * @returns GateResult with vulnerability assessment
   */
  async evaluateQDDVulnerability(
    content: string,
    serpContent: string[]
  ): Promise<GateResult> {
    if (serpContent.length === 0) {
      return {
        passed: true,
        score: 100,
        message: "No SERP content provided for QDD check",
        method: "rule",
        confidence: "low",
      };
    }

    const embeddingService = getEmbeddingService();
    const sanitizedContent = stripPII(content);

    const contentEmbedding = await embeddingService.embedQuery(
      sanitizedContent.slice(0, 5000)
    );

    const serpEmbeddings = await embeddingService.embedPassages(
      serpContent.slice(0, 10).map((s) => s.slice(0, 3000))
    );

    // Check similarity to each SERP result
    const similarities = serpEmbeddings.map((emb) =>
      cosineSimilarity(contentEmbedding, emb)
    );
    const maxSimilarity = Math.max(...similarities);

    // If too similar to any single SERP result, vulnerable to QDD
    const isVulnerable = maxSimilarity > 0.9;

    return {
      passed: !isVulnerable,
      score: (1 - maxSimilarity) * 100,
      message: isVulnerable
        ? `Content too similar to existing SERP result (${Math.round(maxSimilarity * 100)}% match)`
        : "Content provides unique angle",
      method: "embedding",
      confidence: "high",
      embeddingSimilarity: maxSimilarity,
    };
  }

  // ==========================================================================
  // T5-06: Thin Content Detection
  // ==========================================================================

  /**
   * T5-06: Thin Content Detection
   *
   * Checks if word count meets vertical-specific minimum threshold.
   *
   * @param content - Content to evaluate
   * @param vertical - Industry vertical for context
   * @returns GateResult with word count assessment
   */
  evaluateThinContent(content: string, vertical: Vertical): GateResult {
    const wordCount = content
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    const minWords = MIN_WORD_COUNTS[vertical] || 400;
    const passed = wordCount >= minWords;

    return {
      passed,
      score: Math.min(100, (wordCount / minWords) * 100),
      message: passed
        ? `Word count ${wordCount} meets ${vertical} minimum (${minWords})`
        : `Thin content: ${wordCount} words (need ${minWords} for ${vertical})`,
      method: "rule",
      confidence: "high",
    };
  }

  // ==========================================================================
  // T5-07: Fluff Detection
  // ==========================================================================

  /**
   * T5-07: Fluff Detection
   *
   * Identifies filler content and weasel words that weaken content quality.
   *
   * @param content - Content to evaluate
   * @returns GateResult with fluff density assessment
   */
  evaluateFluffDetection(content: string): GateResult {
    const lowerContent = content.toLowerCase();

    // Count fluff phrases
    let fluffCount = 0;
    for (const phrase of FLUFF_PHRASES) {
      const matches = (lowerContent.match(new RegExp(phrase, "gi")) || [])
        .length;
      fluffCount += matches;
    }

    // Count weasel words
    let weaselCount = 0;
    for (const word of WEASEL_WORDS) {
      const matches = (
        lowerContent.match(new RegExp(`\\b${word}\\b`, "gi")) || []
      ).length;
      weaselCount += matches;
    }

    const wordCount = content.split(/\s+/).length;
    const fluffDensity = ((fluffCount + weaselCount) / wordCount) * 1000; // Per 1000 words

    const passed = fluffDensity < 10; // Less than 10 fluff items per 1000 words

    return {
      passed,
      score: Math.max(0, 100 - fluffDensity * 5),
      message: passed
        ? `Low fluff density: ${fluffDensity.toFixed(1)} per 1000 words`
        : `High fluff density: ${fluffDensity.toFixed(1)} per 1000 words (${fluffCount} phrases, ${weaselCount} weasel words)`,
      method: "rule",
      confidence: "high",
    };
  }

  // ==========================================================================
  // Combined Evaluation
  // ==========================================================================

  /**
   * Run all quality gates and return combined result.
   *
   * @param content - Content to evaluate
   * @param vertical - Industry vertical for context
   * @param serpContent - Optional SERP content for comparison checks
   * @returns Combined evaluation result
   */
  async evaluateAll(
    content: string,
    vertical: Vertical,
    serpContent: string[] = []
  ): Promise<{
    overallScore: number;
    passed: boolean;
    results: Record<string, GateResult>;
    blockingFailures: string[];
  }> {
    const results: Record<string, GateResult> = {};
    const blockingFailures: string[] = [];

    // Tier A: Free checks (always run)
    results["T5-04"] = this.evaluateNotForYou(content);
    results["T5-06"] = this.evaluateThinContent(content, vertical);
    results["T5-07"] = this.evaluateFluffDetection(content);

    // Check for blocking failures
    if (!results["T5-06"].passed) {
      blockingFailures.push("T5-06");
    }

    // Tier B: Embedding checks (standard+)
    if (this.config.tier !== "basic") {
      results["T5-01"] = await this.evaluateRedditTest(content, vertical);
      results["T5-03"] = await this.evaluateProveItDetails(content, vertical);

      if (!results["T5-01"].passed && results["T5-01"].score < 50) {
        blockingFailures.push("T5-01");
      }
      if (!results["T5-03"].passed && results["T5-03"].score < 30) {
        blockingFailures.push("T5-03");
      }
    }

    // Tier C: SERP comparison checks (full only)
    if (this.config.tier === "full" && serpContent.length > 0) {
      results["T5-02"] = await this.evaluateInformationGain(content, serpContent);
      results["T5-05"] = await this.evaluateQDDVulnerability(
        content,
        serpContent
      );

      if (!results["T5-02"].passed && results["T5-02"].score < 40) {
        blockingFailures.push("T5-02");
      }
    }

    // Calculate overall score (weighted average)
    const scores = Object.values(results).map((r) => r.score);
    const overallScore =
      scores.reduce((a, b) => a + b, 0) / scores.length;

    return {
      overallScore,
      passed: blockingFailures.length === 0 && overallScore >= 70,
      results,
      blockingFailures,
    };
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get reference embeddings for quality comparison.
   * Placeholder - would load from database in production.
   *
   * @param type - Reference type (e.g., "reddit-quality")
   * @param vertical - Industry vertical
   * @returns Array of reference embeddings
   */
  private async getReferenceEmbeddings(
    type: string,
    vertical: Vertical
  ): Promise<Float32Array[]> {
    // In production, load from database table with curated high-quality examples
    // For now, return empty to trigger LLM fallback
    return [];
  }

  /**
   * Check if circuit breaker is open.
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

// ============================================================================
// Singleton Pattern
// ============================================================================

let _service: QualityGateService | null = null;

/**
 * Get singleton QualityGateService instance.
 *
 * @param config - Optional configuration override
 * @returns QualityGateService instance
 */
export function getQualityGateService(
  config?: Partial<QualityGateConfig>
): QualityGateService {
  if (!_service) {
    _service = new QualityGateService(undefined, config);
  }
  return _service;
}

/**
 * Reset singleton for testing.
 */
export function resetQualityGateService(): void {
  _service = null;
}

// Export error type for consumers
export { CircuitOpenError };
