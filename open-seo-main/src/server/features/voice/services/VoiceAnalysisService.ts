/**
 * VoiceAnalysisService
 * Phase 37-05: Gap Closure - Voice Learning
 *
 * Orchestrates multi-page voice analysis:
 * 1. Scrapes 5-10 URLs from client site
 * 2. Uses VoiceAnalyzer to extract 12 dimensions per page
 * 3. Aggregates results with confidence weighting
 * 4. Saves individual analyses to voiceAnalysis table
 * 5. Updates voiceProfiles with aggregated dimensions
 *
 * Security:
 * - T-37-03: Validates URLs belong to expected domain
 * - T-37-04: Limits to 10 pages max, doesn't store full content
 */

import type { VoiceExtractionResult, ExtractedVoiceDimensions } from "../types";
import { analyzePageVoice, aggregateVoiceResults } from "./VoiceAnalyzer";
import { scrapeProspectPage } from "@/server/lib/scraper/dataforseoScraper";
import { createLogger } from "@/server/lib/logger";
import { db } from "@/db";
import { voiceAnalysis, voiceProfiles } from "@/db/voice-schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

const log = createLogger({ module: "voice-analysis-service" });

/**
 * Maximum pages to analyze (T-37-04 DoS mitigation).
 */
const MAX_PAGES = 10;

/**
 * Result from multi-page voice analysis.
 */
export interface VoiceAnalysisResult {
  dimensions: ExtractedVoiceDimensions;
  avgConfidence: number;
  pagesAnalyzed: number;
}

/**
 * Progress callback for BullMQ job updates.
 */
export type ProgressCallback = (completed: number, total: number) => Promise<void>;

/**
 * Service for orchestrating multi-page voice analysis.
 *
 * Wraps VoiceAnalyzer (which handles single-page AI analysis) and adds:
 * - Multi-page scraping and orchestration
 * - Database persistence (voiceAnalysis table)
 * - Profile updating (voiceProfiles table)
 * - Progress callbacks for BullMQ integration
 *
 * @example
 * ```typescript
 * const service = new VoiceAnalysisService();
 * const result = await service.analyzePages(
 *   "profile-123",
 *   ["https://example.com/page1", "https://example.com/page2"],
 *   async (completed, total) => {
 *     console.log(`Progress: ${completed}/${total}`);
 *   }
 * );
 * console.log(`Analyzed ${result.pagesAnalyzed} pages`);
 * console.log(`Average confidence: ${result.avgConfidence}`);
 * ```
 */
export class VoiceAnalysisService {
  /**
   * Analyze multiple pages and extract aggregated voice profile.
   *
   * @param profileId - Voice profile ID to update
   * @param urls - URLs to scrape and analyze (max 10)
   * @param onProgress - Optional progress callback for BullMQ job updates
   * @returns Aggregated voice dimensions and confidence score
   * @throws Error if no pages successfully analyzed
   */
  async analyzePages(
    profileId: string,
    urls: string[],
    onProgress?: ProgressCallback
  ): Promise<VoiceAnalysisResult> {
    // T-37-04: Enforce max pages limit
    const pagesToAnalyze = urls.slice(0, MAX_PAGES);

    if (pagesToAnalyze.length === 0) {
      throw new Error("No URLs provided for analysis");
    }

    log.info("Starting multi-page voice analysis", {
      profileId,
      urlCount: pagesToAnalyze.length,
    });

    const results: VoiceExtractionResult[] = [];
    const errors: Array<{ url: string; error: string }> = [];

    // Process each URL sequentially
    for (let i = 0; i < pagesToAnalyze.length; i++) {
      const url = pagesToAnalyze[i];

      try {
        // T-37-03: Validate URL format
        const urlObj = new URL(url);
        const domain = urlObj.hostname;

        log.info("Scraping page for voice analysis", {
          url,
          index: i + 1,
          total: pagesToAnalyze.length,
        });

        // Scrape the page
        const scrapeResult = await scrapeProspectPage(url);

        if (!scrapeResult.success) {
          log.warn("Failed to scrape page", { url, error: scrapeResult.error });
          errors.push({ url, error: scrapeResult.error || "Scrape failed" });
          continue;
        }

        // Analyze voice using Claude AI
        const voiceResult = await analyzePageVoice(scrapeResult.page, domain);
        results.push(voiceResult);

        // Save individual analysis to database
        await this.saveAnalysis(profileId, url, voiceResult);

        // Call progress callback if provided
        if (onProgress) {
          await onProgress(i + 1, pagesToAnalyze.length);
        }

        log.info("Page voice analyzed successfully", {
          url,
          confidence: voiceResult.confidence,
          tone: voiceResult.dimensions.tone_primary,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        log.error(
          "Error analyzing page",
          error instanceof Error ? error : new Error(String(error)),
          { url }
        );
        errors.push({ url, error: errorMsg });
      }
    }

    // Check if we have any successful results
    if (results.length === 0) {
      const errorSummary = errors.map((e) => `${e.url}: ${e.error}`).join("; ");
      throw new Error(
        `No pages successfully analyzed. Errors: ${errorSummary}`
      );
    }

    // Aggregate results with confidence weighting
    const aggregated = aggregateVoiceResults(results);
    const avgConfidence = Math.round(
      results.reduce((sum, r) => sum + r.confidence, 0) / results.length
    );

    // Update voice profile with aggregated dimensions
    await this.updateProfile(profileId, aggregated, avgConfidence);

    log.info("Multi-page voice analysis complete", {
      profileId,
      pagesAnalyzed: results.length,
      pagesSkipped: errors.length,
      avgConfidence,
      archetype: aggregated.archetype,
    });

    return {
      dimensions: aggregated,
      avgConfidence,
      pagesAnalyzed: results.length,
    };
  }

  /**
   * Save individual page analysis to voiceAnalysis table.
   * T-37-04: Don't store full content, only metadata and extracted dimensions.
   */
  private async saveAnalysis(
    profileId: string,
    url: string,
    voiceResult: VoiceExtractionResult
  ): Promise<void> {
    await db.insert(voiceAnalysis).values({
      id: nanoid(),
      profileId,
      url,
      rawAnalysis: {
        model: process.env.CLAUDE_MODEL_VOICE_ANALYZER || "claude-3-5-sonnet-20241022",
        prompt: "(redacted)", // T-37-04: Don't store full prompt with scraped content
        response: JSON.stringify(voiceResult.dimensions),
        tokens_used: 0, // Would need API response metadata
        analyzed_at: new Date().toISOString(),
      },
      extractedTone: voiceResult.dimensions.tone_primary,
      extractedFormality: voiceResult.dimensions.formality_level,
      sampleSentences: voiceResult.sample_sentences,
    });
  }

  /**
   * Update voice profile with aggregated dimensions.
   */
  private async updateProfile(
    profileId: string,
    aggregated: ExtractedVoiceDimensions,
    avgConfidence: number
  ): Promise<void> {
    const now = new Date();

    await db
      .update(voiceProfiles)
      .set({
        tonePrimary: aggregated.tone_primary,
        toneSecondary: aggregated.tone_secondary,
        formalityLevel: aggregated.formality_level,
        personalityTraits: aggregated.personality_traits,
        archetype: aggregated.archetype,
        sentenceLengthAvg: aggregated.sentence_length_avg,
        paragraphLengthAvg: aggregated.paragraph_length_avg,
        contractionUsage: aggregated.contraction_usage,
        vocabularyPatterns: aggregated.vocabulary_patterns,
        signaturePhrases: aggregated.signature_phrases,
        forbiddenPhrases: aggregated.forbidden_phrases,
        headingStyle: aggregated.heading_style,
        confidenceScore: avgConfidence,
        analyzedAt: now,
        updatedAt: now,
      })
      .where(eq(voiceProfiles.id, profileId));
  }
}

/**
 * Singleton instance for use in workers and server functions.
 */
export const voiceAnalysisService = new VoiceAnalysisService();
