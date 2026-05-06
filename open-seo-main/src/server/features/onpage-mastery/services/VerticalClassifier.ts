/**
 * VerticalClassifier: Heuristic-first page classification with LLM fallback.
 * Phase 92-01: Database Schema + VerticalClassifier
 *
 * Cost-optimized classification that skips LLM for 90%+ of pages:
 * 1. Check Schema.org types (confidence 0.95)
 * 2. Check URL patterns (confidence 0.90)
 * 3. Check YMYL keywords (confidence 0.70)
 * 4. LLM fallback for uncertain cases
 *
 * Features:
 * - Circuit breaker for graceful degradation
 * - Zod schema validation on LLM responses
 * - 90-day caching by domain + path pattern
 */

import OpenAI from "openai";
import * as cheerio from "cheerio";
import {
  CircuitBreaker,
  CircuitOpenError,
} from "@/server/features/keywords/services/CircuitBreaker";
import { createLogger } from "@/server/lib/logger";
import { db, verticalClassifications } from "@/db";
import { eq, and, gt } from "drizzle-orm";
import {
  type Classification,
  type ClassificationMethod,
  type Vertical,
  type VerticalClassifierConfig,
  ClassificationResponseSchema,
  SCHEMA_TO_VERTICAL,
  URL_PATTERNS,
  YMYL_KEYWORDS,
  isYmylVertical,
  DEFAULT_CLASSIFIER_CONFIG,
} from "../types";

const log = createLogger({ module: "VerticalClassifier" });

// Export for external use
export { CircuitOpenError };

// Grok configuration for vertical classification
const GROK_CONFIG = {
  baseURL: "https://api.x.ai/v1",
  model: "grok-4-1-fast-reasoning",
  maxTokens: 500,
  temperature: 0.1,
};

/**
 * VerticalClassifier service.
 * Classifies pages into 12 verticals with YMYL detection.
 */
export class VerticalClassifier {
  private client: OpenAI;
  private circuit: CircuitBreaker;
  private config: VerticalClassifierConfig;

  constructor(config: Partial<VerticalClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CLASSIFIER_CONFIG, ...config };

    const apiKey = config.apiKey ?? process.env.XAI_API_KEY;
    if (!apiKey) {
      throw new Error("XAI_API_KEY not configured");
    }

    this.client = new OpenAI({
      apiKey,
      baseURL: GROK_CONFIG.baseURL,
    });

    this.circuit = new CircuitBreaker({
      name: "vertical-classifier",
      failureThreshold: 3,
      resetTimeout: 60000,
    });
  }

  /**
   * Classify a page by heuristics, with LLM fallback if needed.
   * Uses 90-day caching by domain + path pattern.
   *
   * @param domain - Domain name (e.g., "example.com")
   * @param path - URL path (e.g., "/products/widget")
   * @param html - Page HTML content
   * @param clientId - Client ID for cache scoping
   * @returns Classification result
   */
  async classify(
    domain: string,
    path: string,
    html: string,
    clientId: string
  ): Promise<Classification> {
    const pathPattern = this.extractPathPattern(path);

    // 1. Check database cache first
    const cached = await this.getCachedClassification(domain, pathPattern, clientId);
    if (cached) {
      log.debug("Cache hit for vertical classification", {
        domain,
        pathPattern,
        vertical: cached.vertical,
      });
      return cached;
    }

    // 2. Run heuristic classification
    const heuristic = this.classifyHeuristic(html, path);
    if (heuristic && heuristic.confidence >= this.config.heuristicThreshold) {
      log.debug("Heuristic classification successful", {
        domain,
        pathPattern,
        vertical: heuristic.vertical,
        method: heuristic.method,
        confidence: heuristic.confidence,
      });
      await this.cacheClassification(domain, pathPattern, clientId, heuristic);
      return heuristic;
    }

    // 3. LLM fallback for uncertain cases
    log.debug("Falling back to LLM classification", {
      domain,
      pathPattern,
      heuristicConfidence: heuristic?.confidence ?? 0,
    });
    const llmResult = await this.classifyLLM(html, path);
    await this.cacheClassification(domain, pathPattern, clientId, llmResult);
    return llmResult;
  }

  /**
   * Classify page using heuristics (Schema.org, URL patterns, keywords).
   * Returns null if no confident match found.
   */
  classifyHeuristic(html: string, url: string): Classification | null {
    // 1. Schema.org detection (highest confidence: 0.95)
    const schemaResult = this.detectSchemaOrg(html);
    if (schemaResult) {
      return schemaResult;
    }

    // 2. URL pattern detection (confidence: 0.90)
    const urlResult = this.detectUrlPattern(url);
    if (urlResult) {
      return urlResult;
    }

    // 3. YMYL keyword detection (lower confidence: 0.70)
    const keywordResult = this.detectYmylKeywords(html);
    if (keywordResult) {
      return keywordResult;
    }

    return null;
  }

  /**
   * Classify page using LLM (Grok 4.1 Fast).
   * Uses circuit breaker for graceful degradation.
   *
   * @throws CircuitOpenError if circuit breaker is open
   */
  async classifyLLM(html: string, url: string): Promise<Classification> {
    if (!this.circuit.allowsRequest) {
      throw new CircuitOpenError("vertical-classifier");
    }

    try {
      const $ = cheerio.load(html);

      // Extract key page signals for classification
      const title = $("title").text().trim().slice(0, 200);
      const h1 = $("h1").first().text().trim().slice(0, 200);
      const metaDesc = $('meta[name="description"]').attr("content")?.slice(0, 300) || "";
      const bodyText = this.extractBodyText($).slice(0, 500);

      const response = await this.client.chat.completions.create({
        model: GROK_CONFIG.model,
        messages: [
          { role: "system", content: this.buildSystemPrompt() },
          {
            role: "user",
            content: this.buildUserPrompt(url, title, h1, metaDesc, bodyText),
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: GROK_CONFIG.maxTokens,
        temperature: GROK_CONFIG.temperature,
      });

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

      const vertical = parsed.data.vertical;
      return {
        vertical,
        confidence: parsed.data.confidence,
        isYmyl: isYmylVertical(vertical),
        method: "llm" as ClassificationMethod,
      };
    } catch (error) {
      // Don't double-count failures already recorded above
      if (error instanceof Error && !error.message.startsWith("Invalid")) {
        this.circuit.recordFailure();
      }
      throw error;
    }
  }

  /**
   * Extract path pattern from URL path.
   * Converts specific IDs to wildcards for cache reuse.
   *
   * Examples:
   * - /product/123 -> /product/*
   * - /blog/2024/01/my-post -> /blog/*
   * - /about -> /about
   */
  extractPathPattern(path: string): string {
    // Normalize path
    let normalized = path.replace(/\/+$/, ""); // Remove trailing slashes
    if (!normalized) normalized = "/";

    // Split into segments
    const segments = normalized.split("/").filter(Boolean);
    if (segments.length === 0) return "/";

    // Keep first segment, wildcard the rest if they look like IDs
    const patternSegments = segments.map((seg, idx) => {
      if (idx === 0) return seg; // Keep first segment

      // Detect ID-like segments (numbers, UUIDs, slugs with numbers)
      if (/^\d+$/.test(seg)) return "*"; // Pure number
      if (/^[a-f0-9-]{36}$/i.test(seg)) return "*"; // UUID
      if (/^\d{4}$/.test(seg)) return "*"; // Year
      if (/^\d{2}$/.test(seg) && idx > 0) return "*"; // Month/day

      return seg;
    });

    // Collapse consecutive wildcards
    const collapsed: string[] = [];
    for (const seg of patternSegments) {
      if (seg === "*" && collapsed[collapsed.length - 1] === "*") continue;
      collapsed.push(seg);
    }

    return "/" + collapsed.join("/");
  }

  /**
   * Detect Schema.org types from JSON-LD scripts.
   */
  private detectSchemaOrg(html: string): Classification | null {
    try {
      const $ = cheerio.load(html);
      const scripts = $('script[type="application/ld+json"]');

      for (let i = 0; i < scripts.length; i++) {
        const content = $(scripts[i]).html();
        if (!content) continue;

        try {
          const data = JSON.parse(content);
          const types = this.extractSchemaTypes(data);

          for (const type of types) {
            const vertical = SCHEMA_TO_VERTICAL[type];
            if (vertical) {
              return {
                vertical,
                confidence: 0.95,
                isYmyl: isYmylVertical(vertical),
                method: "schema" as ClassificationMethod,
              };
            }
          }
        } catch {
          // Invalid JSON, skip this script
          continue;
        }
      }
    } catch (error) {
      log.debug("Schema.org detection failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  }

  /**
   * Extract @type values from Schema.org data (handles arrays and nested objects).
   */
  private extractSchemaTypes(data: unknown): string[] {
    const types: string[] = [];

    if (Array.isArray(data)) {
      for (const item of data) {
        types.push(...this.extractSchemaTypes(item));
      }
    } else if (typeof data === "object" && data !== null) {
      const obj = data as Record<string, unknown>;
      if (obj["@type"]) {
        if (typeof obj["@type"] === "string") {
          types.push(obj["@type"]);
        } else if (Array.isArray(obj["@type"])) {
          types.push(...obj["@type"].filter((t): t is string => typeof t === "string"));
        }
      }
      // Check @graph
      if (obj["@graph"] && Array.isArray(obj["@graph"])) {
        types.push(...this.extractSchemaTypes(obj["@graph"]));
      }
    }

    return types;
  }

  /**
   * Detect vertical from URL patterns.
   */
  private detectUrlPattern(url: string): Classification | null {
    for (const [pattern, vertical] of URL_PATTERNS) {
      if (pattern.test(url)) {
        return {
          vertical,
          confidence: 0.9,
          isYmyl: isYmylVertical(vertical),
          method: "url-pattern" as ClassificationMethod,
        };
      }
    }
    return null;
  }

  /**
   * Detect YMYL vertical from body text keywords.
   */
  private detectYmylKeywords(html: string): Classification | null {
    const $ = cheerio.load(html);
    const bodyText = this.extractBodyText($).toLowerCase();

    for (const [verticalKey, pattern] of Object.entries(YMYL_KEYWORDS)) {
      if (pattern.test(bodyText)) {
        const vertical = verticalKey as Vertical;
        return {
          vertical,
          confidence: 0.7,
          isYmyl: true,
          method: "keyword" as ClassificationMethod,
        };
      }
    }

    return null;
  }

  /**
   * Extract body text from HTML, excluding scripts and styles.
   */
  private extractBodyText($: cheerio.CheerioAPI): string {
    const $clone = $.root().clone();
    const $body = cheerio.load($clone.html() ?? "");
    $body("script, style, noscript, nav, header, footer").remove();
    return $body("body").text().replace(/\s+/g, " ").trim();
  }

  /**
   * Get cached classification from database.
   */
  private async getCachedClassification(
    domain: string,
    pathPattern: string,
    clientId: string
  ): Promise<Classification | null> {
    try {
      const now = new Date();
      const results = await db
        .select()
        .from(verticalClassifications)
        .where(
          and(
            eq(verticalClassifications.clientId, clientId),
            eq(verticalClassifications.domain, domain),
            eq(verticalClassifications.pathPattern, pathPattern),
            gt(verticalClassifications.expiresAt, now)
          )
        )
        .limit(1);

      if (results.length === 0) return null;

      const cached = results[0];
      return {
        vertical: cached.vertical as Vertical,
        confidence: cached.confidence,
        isYmyl: cached.isYmyl,
        method: cached.method as ClassificationMethod,
      };
    } catch (error) {
      log.warn("Cache lookup failed", {
        domain,
        pathPattern,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Cache classification in database.
   */
  private async cacheClassification(
    domain: string,
    pathPattern: string,
    clientId: string,
    classification: Classification
  ): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = new Date(
        now.getTime() + this.config.cacheTtlDays * 24 * 60 * 60 * 1000
      );

      await db.insert(verticalClassifications).values({
        clientId,
        domain,
        pathPattern,
        vertical: classification.vertical,
        confidence: classification.confidence,
        isYmyl: classification.isYmyl,
        method: classification.method,
        cachedAt: now,
        expiresAt,
      });
    } catch (error) {
      // Log but don't fail - caching is optimization, not critical path
      log.warn("Cache write failed", {
        domain,
        pathPattern,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Build system prompt for LLM classification.
   */
  private buildSystemPrompt(): string {
    return `You are an expert at classifying web pages into business verticals.

Given page content, classify it into exactly one of these 13 verticals:
- healthcare: Medical services, clinics, health information
- legal: Law firms, legal services, legal information
- financial: Banks, investment, insurance, financial advice
- ecommerce: Online stores, product pages, shopping
- saas: Software as a service, web applications
- real_estate: Property listings, real estate agents
- home_services: Plumbers, electricians, contractors
- hospitality: Hotels, restaurants, travel
- education: Schools, courses, training
- professional: Consulting, marketing agencies
- manufacturing: Factories, industrial products
- nonprofit: Charities, NGOs, foundations
- general: Cannot determine or doesn't fit above categories

Return ONLY valid JSON with this exact structure:
{
  "vertical": "<vertical_name>",
  "confidence": <0.0-1.0>,
  "reasoning": "<brief explanation>"
}`;
  }

  /**
   * Build user prompt with page content.
   */
  private buildUserPrompt(
    url: string,
    title: string,
    h1: string,
    metaDesc: string,
    bodyText: string
  ): string {
    return `Classify this page:

URL: ${url}
Title: ${title}
H1: ${h1}
Meta Description: ${metaDesc}
Content Preview: ${bodyText}

Return the classification JSON.`;
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

// Singleton instance
let _instance: VerticalClassifier | null = null;

/**
 * Get singleton VerticalClassifier instance.
 * Creates instance on first call with default config.
 *
 * @throws Error if XAI_API_KEY is not configured
 */
export function getVerticalClassifierService(): VerticalClassifier {
  if (!_instance) {
    _instance = new VerticalClassifier();
  }
  return _instance;
}

/**
 * Reset singleton instance (for testing).
 */
export function resetVerticalClassifierService(): void {
  _instance = null;
}
