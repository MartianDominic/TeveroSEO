/**
 * Voice Analysis Adapter
 * Phase 40-CORE-01: Migrate VoiceAnalysisService to ScrapingService
 *
 * Adapts the VoiceAnalysisService's scraping calls to use the unified
 * ScrapingService with TieredFetcher, caching, and cost tracking.
 */

import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapeResult, ScrapeOptions } from "../../ScrapingService";
import type { PageAnalysis } from "@/server/lib/audit/types";

/**
 * Input for voice analysis scraping.
 * Matches the parameters used by VoiceAnalysisService.analyzePages().
 */
export interface VoiceAnalysisInput {
  /** URL to scrape for voice analysis */
  url: string;
  /** Voice profile ID being analyzed */
  profileId: string;
  /** Expected domain for URL validation (T-37-03 security) */
  expectedDomain?: string;
}

/**
 * Output from voice analysis scraping.
 * Matches the legacy ScrapeResponse type from dataforseoScraper.
 */
export interface VoiceAnalysisOutput {
  /** Whether the scrape was successful */
  success: boolean;
  /** Analyzed page data (only present on success) */
  page?: PageAnalysis;
  /** Error message (only present on failure) */
  error?: string;
  /** Cost in cents for billing tracking */
  costCents: number;
}

/**
 * Adapter that bridges VoiceAnalysisService to ScrapingService.
 *
 * Key responsibilities:
 * - Convert voice analysis input to ScrapingService options
 * - Transform ScrapeResult to legacy VoiceAnalysisOutput format
 * - Compare outputs for shadow mode validation
 *
 * Migration path: legacy -> shadow -> canary -> rollout -> migrated
 */
export const voiceAnalysisAdapter: ConsumerAdapter<VoiceAnalysisInput, VoiceAnalysisOutput> = {
  feature: "voiceAnalysis",

  toScrapeOptions(input: VoiceAnalysisInput): ScrapeOptions & { url: string } {
    return {
      url: input.url,
      feature: "voiceAnalysis",
      // Voice analysis needs full HTML for content extraction
      includeHtml: true,
      // Include parsed data for word count, headings, etc.
      includeParsedData: true,
      // Don't need CWV for voice analysis
      includeCwv: false,
      // Voice analysis is typically a background operation, use standard tier
      // Let TieredFetcher select optimal tier based on domain learning
    };
  },

  toConsumerOutput(result: ScrapeResult, _input: VoiceAnalysisInput): VoiceAnalysisOutput {
    if (!result.success) {
      return {
        success: false,
        error: result.error ?? "Scrape failed",
        costCents: Math.round(result.estimatedCostUsd * 100),
      };
    }

    // Construct PageAnalysis from ScrapeResult
    // The unified ScrapingService returns parsedData which we map to PageAnalysis
    const page: PageAnalysis = {
      url: result.url,
      statusCode: result.statusCode ?? 200,
      redirectUrl: null, // Not available in ScrapeResult directly
      responseTimeMs: result.responseTimeMs,

      // Head metadata - map from parsedData
      title: result.parsedData?.title ?? "",
      metaDescription: result.parsedData?.metaDescription ?? "",
      canonical: result.parsedData?.canonical ?? null,
      robotsMeta: null, // Not parsed by ScrapingService
      ogTitle: null,
      ogDescription: null,
      ogImage: null,

      // Headings - map h1/h2 arrays to h1s format
      h1s: result.parsedData?.h1 ?? [],
      headingOrder: [], // Would need full HTML parsing

      // Content
      wordCount: result.parsedData?.wordCount ?? 0,

      // Images - map format (both use src/alt but with different nullability)
      images: (result.parsedData?.images ?? []).map(img => ({
        src: img.src ?? null,
        alt: img.alt ?? null,
      })),

      // Links - extract just URLs from the link objects
      internalLinks: (result.parsedData?.internalLinks ?? []).map(link => link.url),
      externalLinks: (result.parsedData?.externalLinks ?? []).map(link => link.url),

      // Structured data
      hasStructuredData: false, // Not parsed by ScrapingService

      // Hreflang
      hreflangTags: [],
    };

    return {
      success: true,
      page,
      costCents: Math.round(result.estimatedCostUsd * 100),
    };
  },

  compareOutputs(legacy: VoiceAnalysisOutput, adapted: VoiceAnalysisOutput): ComparisonResult {
    const differences: ComparisonResult["differences"] = [];

    // Compare success status
    if (legacy.success !== adapted.success) {
      differences.push({
        field: "success",
        legacy: legacy.success,
        new: adapted.success,
      });
    }

    // Only compare page data if both succeeded
    if (legacy.success && adapted.success && legacy.page && adapted.page) {
      // Word count comparison (allow 10% variance for HTML parsing differences)
      const legacyWordCount = legacy.page.wordCount ?? 0;
      const adaptedWordCount = adapted.page.wordCount ?? 0;
      const wordCountDiff = Math.abs(legacyWordCount - adaptedWordCount);
      const wordCountThreshold = Math.max(legacyWordCount * 0.1, 50);

      if (wordCountDiff > wordCountThreshold) {
        differences.push({
          field: "wordCount",
          legacy: legacyWordCount,
          new: adaptedWordCount,
        });
      }

      // Title comparison (should be exact or very close)
      if (legacy.page.title !== adapted.page.title) {
        // Allow minor whitespace differences
        const normalizedLegacy = legacy.page.title?.trim() ?? "";
        const normalizedAdapted = adapted.page.title?.trim() ?? "";
        if (normalizedLegacy !== normalizedAdapted) {
          differences.push({
            field: "title",
            legacy: legacy.page.title,
            new: adapted.page.title,
          });
        }
      }

      // Status code comparison
      if (legacy.page.statusCode !== adapted.page.statusCode) {
        differences.push({
          field: "statusCode",
          legacy: legacy.page.statusCode,
          new: adapted.page.statusCode,
        });
      }

      // H1 count comparison (important for voice analysis)
      const legacyH1Count = legacy.page.h1s?.length ?? 0;
      const adaptedH1Count = adapted.page.h1s?.length ?? 0;
      if (legacyH1Count !== adaptedH1Count) {
        differences.push({
          field: "h1Count",
          legacy: legacyH1Count,
          new: adaptedH1Count,
        });
      }
    }

    // Compare error messages (only if both failed)
    if (!legacy.success && !adapted.success) {
      // Errors can differ in wording but should indicate same failure type
      const legacyErrorType = classifyError(legacy.error ?? "");
      const adaptedErrorType = classifyError(adapted.error ?? "");
      if (legacyErrorType !== adaptedErrorType) {
        differences.push({
          field: "errorType",
          legacy: legacyErrorType,
          new: adaptedErrorType,
        });
      }
    }

    return {
      match: differences.length === 0,
      differences,
    };
  },
};

/**
 * Classify error messages into categories for comparison.
 * Helps match errors that may have different wording but same meaning.
 */
function classifyError(error: string): string {
  const errorLower = error.toLowerCase();

  if (errorLower.includes("timeout") || errorLower.includes("timed out")) {
    return "timeout";
  }
  if (errorLower.includes("404") || errorLower.includes("not found")) {
    return "not_found";
  }
  if (errorLower.includes("403") || errorLower.includes("forbidden") || errorLower.includes("blocked")) {
    return "blocked";
  }
  if (errorLower.includes("500") || errorLower.includes("server error")) {
    return "server_error";
  }
  if (errorLower.includes("dns") || errorLower.includes("resolve")) {
    return "dns_error";
  }
  if (errorLower.includes("ssl") || errorLower.includes("certificate")) {
    return "ssl_error";
  }
  if (errorLower.includes("connection") || errorLower.includes("network")) {
    return "connection_error";
  }
  if (errorLower.includes("ssrf") || errorLower.includes("private") || errorLower.includes("localhost")) {
    return "ssrf_blocked";
  }

  return "unknown";
}
