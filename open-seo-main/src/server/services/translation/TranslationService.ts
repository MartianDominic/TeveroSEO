/**
 * Translation Service
 * Phase 55: Full Platform Internationalization (i18n)
 *
 * Gemini-powered translation service with caching for Lithuanian translations.
 * Features:
 * - Database caching for cost efficiency
 * - Workspace-specific overrides
 * - Placeholder preservation
 * - Quality scoring
 * - Rate-limited batch translation
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";
import { eq, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, translationCache, workspaceTranslationOverrides } from "@/db";
import {
  buildTranslationPrompt,
  buildUserPrompt,
  buildRetryPrompt,
} from "./prompts";
import type {
  TranslationRequest,
  TranslationResult,
  BatchTranslationResult,
  QualityMetrics,
} from "./types";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "translation-service" });

/** Gemini model version for cache tracking */
const GEMINI_MODEL = "gemini-1.5-pro";

/** Rate limit: 60 requests per minute for Gemini 1.5 Pro */
const RATE_LIMIT_DELAY_MS = 1000;

/** Maximum retry attempts for length constraint violations */
const MAX_RETRY_ATTEMPTS = 2;

/** Lithuanian diacritic characters for quality detection */
const LITHUANIAN_CHARS = /[ąčęėįšųūž]/i;

/**
 * Sleep utility for rate limiting.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Translation service with Gemini API integration and database caching.
 */
export class TranslationService {
  private genAI: GoogleGenerativeAI;
  private model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY environment variable is required for translation service"
      );
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      generationConfig: {
        temperature: 0.3, // Lower temperature for consistent translations
        topP: 0.8,
        maxOutputTokens: 2048,
      },
    });
  }

  /**
   * Translate text from source to target language.
   *
   * Flow:
   * 1. Skip if same language
   * 2. Check cache
   * 3. Check workspace override
   * 4. Call Gemini API
   * 5. Validate and cache result
   */
  async translate(request: TranslationRequest): Promise<TranslationResult> {
    // Skip translation if source === target
    if (request.sourceLang === request.targetLang) {
      return {
        text: request.text,
        cached: false,
        confidence: 1.0,
      };
    }

    const sourceHash = this.buildSourceHash(request);

    // Check database cache
    const cached = await this.checkCache(
      sourceHash,
      request.targetLang,
      request.context.type,
      request.context.formality
    );

    if (cached) {
      await this.updateCacheStats(cached.id);
      return {
        text: cached.translatedText,
        cached: true,
        confidence: cached.qualityScore ?? 0.95,
        sourceHash,
      };
    }

    // Check workspace-specific override
    if (request.context.workspaceId) {
      const override = await this.checkWorkspaceOverride(request);
      if (override) {
        return {
          text: override,
          cached: true,
          confidence: 1.0,
          sourceHash,
        };
      }
    }

    // Build prompt and call Gemini
    const systemPrompt = buildTranslationPrompt(
      request.context,
      request.maxLength
    );
    const userPrompt = buildUserPrompt(request.text);

    let translation = await this.callGemini(systemPrompt, userPrompt);

    // Validate placeholder preservation
    if (request.preservePlaceholders !== false) {
      translation = this.validatePlaceholders(request.text, translation);
    }

    // Retry if translation exceeds maxLength
    if (request.maxLength && translation.length > request.maxLength) {
      translation = await this.retryWithShorter(
        translation,
        request.maxLength
      );
    }

    // Calculate quality score
    const qualityScore = this.calculateQualityScore(
      request.text,
      translation,
      request
    );

    // Cache the translation
    await this.cacheTranslation(
      sourceHash,
      request,
      translation,
      qualityScore
    );

    return {
      text: translation,
      cached: false,
      confidence: qualityScore,
      sourceHash,
    };
  }

  /**
   * Translate multiple texts in batch with rate limiting.
   *
   * @param requests - Array of translation requests
   * @returns Batch result with statistics
   */
  async translateBatch(
    requests: TranslationRequest[]
  ): Promise<BatchTranslationResult> {
    const startTime = Date.now();
    const results: TranslationResult[] = [];
    let totalCached = 0;
    let totalTranslated = 0;

    // Process in batches of 10 with rate limiting
    const batchSize = 10;

    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map((req) => this.translate(req))
      );

      for (const result of batchResults) {
        results.push(result);
        if (result.cached) {
          totalCached++;
        } else {
          totalTranslated++;
        }
      }

      // Rate limit: wait between batches if there are more
      if (i + batchSize < requests.length) {
        await sleep(RATE_LIMIT_DELAY_MS);
      }
    }

    return {
      results,
      totalCached,
      totalTranslated,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Build SHA256 hash of source text for cache lookup.
   * Includes context to differentiate same text with different contexts.
   */
  private buildSourceHash(request: TranslationRequest): string {
    const hashInput = [
      request.text,
      request.targetLang,
      request.context.type,
      request.context.formality,
    ].join("|");

    return createHash("sha256").update(hashInput).digest("hex").substring(0, 32);
  }

  /**
   * Check cache for existing translation.
   */
  private async checkCache(
    sourceHash: string,
    targetLang: string,
    contextType: string,
    formality: string
  ): Promise<typeof translationCache.$inferSelect | null> {
    const results = await db
      .select()
      .from(translationCache)
      .where(
        and(
          eq(translationCache.sourceHash, sourceHash),
          eq(translationCache.targetLang, targetLang),
          eq(translationCache.contextType, contextType),
          eq(translationCache.formality, formality)
        )
      )
      .limit(1);

    return results[0] ?? null;
  }

  /**
   * Update cache statistics (lastUsedAt, useCount).
   */
  private async updateCacheStats(cacheId: string): Promise<void> {
    await db
      .update(translationCache)
      .set({
        lastUsedAt: new Date(),
        useCount: sql`${translationCache.useCount} + 1`,
      })
      .where(eq(translationCache.id, cacheId));
  }

  /**
   * Check for workspace-specific translation override.
   */
  private async checkWorkspaceOverride(
    request: TranslationRequest
  ): Promise<string | null> {
    if (!request.context.workspaceId) return null;

    // Workspace overrides use message keys, not raw text
    // For now, we hash the text as a pseudo-key
    const messageKey = this.buildSourceHash(request);

    const results = await db
      .select()
      .from(workspaceTranslationOverrides)
      .where(
        and(
          eq(workspaceTranslationOverrides.workspaceId, request.context.workspaceId),
          eq(workspaceTranslationOverrides.messageKey, messageKey),
          eq(workspaceTranslationOverrides.language, request.targetLang)
        )
      )
      .limit(1);

    return results[0]?.customValue ?? null;
  }

  /**
   * Call Gemini API for translation.
   */
  private async callGemini(
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    const chat = this.model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. I will translate English text to Lithuanian following these rules." }] },
      ],
    });

    const result = await chat.sendMessage(userPrompt);
    return result.response.text().trim();
  }

  /**
   * Validate that all placeholders from source are preserved in translation.
   */
  validatePlaceholders(source: string, translation: string): string {
    // Match various placeholder patterns
    const placeholderRegex = /\{\{?\w+\}?\}|%[sdf]|\{[0-9]+\}/g;
    const sourcePlaceholders = source.match(placeholderRegex) || [];

    // Check all placeholders exist in translation
    for (const ph of sourcePlaceholders) {
      if (!translation.includes(ph)) {
        // Log warning - placeholder was lost
        console.warn(
          `[TranslationService] Placeholder ${ph} missing in translation, source may need review`
        );
      }
    }

    return translation;
  }

  /**
   * Retry translation with explicit length constraints.
   */
  private async retryWithShorter(
    originalTranslation: string,
    maxLength: number
  ): Promise<string> {
    let translation = originalTranslation;
    let attempts = 0;

    while (translation.length > maxLength && attempts < MAX_RETRY_ATTEMPTS) {
      const retryPrompt = buildRetryPrompt(translation, maxLength);
      translation = await this.callGemini("", retryPrompt);
      attempts++;
    }

    // If still too long, truncate with ellipsis as last resort
    if (translation.length > maxLength) {
      translation = translation.substring(0, maxLength - 3) + "...";
    }

    return translation;
  }

  /**
   * Calculate quality score based on various metrics.
   *
   * Score components:
   * - Length ratio (Lithuanian typically 20-40% longer)
   * - Placeholder preservation
   * - Lithuanian character presence
   * - Length constraint satisfaction
   */
  calculateQualityScore(
    source: string,
    translation: string,
    request: TranslationRequest
  ): number {
    const metrics = this.getQualityMetrics(source, translation, request);

    let score = 0.5; // Base score

    // Length ratio check (Lithuanian is typically longer)
    // Ideal ratio is 1.2-1.4x for Lithuanian
    if (metrics.lengthRatio >= 1.0 && metrics.lengthRatio <= 1.6) {
      score += 0.2;
    } else if (metrics.lengthRatio >= 0.8 && metrics.lengthRatio <= 2.0) {
      score += 0.1;
    }

    // Placeholder preservation (critical)
    if (metrics.placeholdersPreserved) {
      score += 0.2;
    }

    // Lithuanian character presence (indicates real translation)
    if (metrics.hasLithuanianChars) {
      score += 0.1;
    }

    // Length constraint satisfaction
    if (metrics.withinLengthLimit) {
      score += 0.05;
    } else if (request.maxLength) {
      score -= 0.1; // Penalty for exceeding length
    }

    // Clamp to 0-1 range
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get detailed quality metrics for a translation.
   */
  private getQualityMetrics(
    source: string,
    translation: string,
    request: TranslationRequest
  ): QualityMetrics {
    // Check placeholder preservation
    const placeholderRegex = /\{\{?\w+\}?\}|%[sdf]|\{[0-9]+\}/g;
    const sourcePlaceholders = source.match(placeholderRegex) || [];
    const placeholdersPreserved = sourcePlaceholders.every((ph) =>
      translation.includes(ph)
    );

    return {
      lengthRatio: translation.length / Math.max(source.length, 1),
      placeholdersPreserved,
      hasLithuanianChars: LITHUANIAN_CHARS.test(translation),
      withinLengthLimit: request.maxLength
        ? translation.length <= request.maxLength
        : true,
    };
  }

  /**
   * Cache a translation result to database.
   */
  private async cacheTranslation(
    sourceHash: string,
    request: TranslationRequest,
    translation: string,
    qualityScore: number
  ): Promise<void> {
    try {
      await db.insert(translationCache).values({
        id: nanoid(),
        sourceHash,
        sourceText: request.text,
        sourceLang: request.sourceLang,
        targetLang: request.targetLang,
        translatedText: translation,
        contextType: request.context.type,
        formality: request.context.formality,
        translator: GEMINI_MODEL,
        modelVersion: GEMINI_MODEL,
        qualityScore,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastUsedAt: new Date(),
        useCount: 1,
      });
    } catch (error) {
      // Ignore duplicate key errors (race condition with concurrent requests)
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes("duplicate key")) {
        log.error("Cache insert failed", error instanceof Error ? error : new Error(errorMessage));
      }
    }
  }
}

// Singleton instance
let translationServiceInstance: TranslationService | null = null;

/**
 * Get the singleton TranslationService instance.
 * Lazily initializes on first call.
 */
export function getTranslationService(): TranslationService {
  if (!translationServiceInstance) {
    translationServiceInstance = new TranslationService();
  }
  return translationServiceInstance;
}
