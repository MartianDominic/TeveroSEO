/**
 * Volume Refresh Adapter
 * Phase 40 Gap MIG-01: Consumer Migration Wiring
 *
 * Adapts volume-refresh-processor's DataForSEO Labs API calls to use unified
 * cost tracking and migration infrastructure. Unlike other adapters that handle
 * HTML scraping, this adapter handles keyword volume API calls.
 *
 * Note: VolumeRefresh uses DataForSEO Labs API (keywords_data/google_ads/search_volume/live),
 * not web scraping. This adapter provides unified cost tracking and migration state support.
 */

import type { ConsumerAdapter, ComparisonResult } from "./types";
import type { ScrapeResult, ScrapeOptions } from "../../ScrapingService";
import type { ScrapingFeature } from "../../config";

// =============================================================================
// Types
// =============================================================================

/**
 * Input type for volume refresh operations.
 * Matches volume-refresh-processor's expected input format.
 */
export interface VolumeRefreshInput {
  /** Keywords to fetch volume data for */
  keywords: string[];
  /** DataForSEO location code (default: 2440 for Lithuania) */
  locationCode?: number;
  /** DataForSEO language code (default: "lt") */
  languageCode?: string;
  /** Prospect ID for attribution */
  prospectId?: string;
  /** Who triggered the refresh */
  triggeredBy?: string;
  /** Job ID for cost tracking */
  jobId?: string;
  /** Client ID for cost tracking */
  clientId?: string;
  /** Workspace ID for cost tracking */
  workspaceId?: string;
}

/**
 * Keyword metrics from DataForSEO Labs API.
 */
export interface KeywordMetrics {
  keyword: string;
  searchVolume: number | null;
  cpc: number | null;
  competition: number | null;
}

/**
 * Output type for volume refresh operations.
 * Matches volume-refresh-processor's response format.
 */
export interface VolumeRefreshOutput {
  /** Whether the API call was successful */
  success: boolean;
  /** Keyword metrics from DataForSEO */
  metrics: KeywordMetrics[];
  /** Number of keywords processed */
  keywordsProcessed: number;
  /** Number of keywords that failed/skipped */
  keywordsSkipped: number;
  /** Estimated cost in USD */
  costUsd: number;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Error message if failed */
  error?: string;
  /** Timestamp of the refresh */
  refreshedAt: Date;
}

// =============================================================================
// Cost Constants
// =============================================================================

/** Cost per DataForSEO Labs API request */
const COST_PER_REQUEST_USD = 0.15;

/** Cost per keyword in Labs API (search volume endpoint) */
const COST_PER_KEYWORD_USD = 0.0001;

// =============================================================================
// Adapter Implementation
// =============================================================================

/**
 * Adapter that bridges volume-refresh-processor to unified migration infrastructure.
 *
 * Key responsibilities:
 * - Convert volume refresh input to scrape options (for cost tracking)
 * - Transform API results to legacy output format
 * - Compare outputs for shadow mode validation
 *
 * Migration path: legacy -> shadow -> canary -> rollout -> migrated
 *
 * Note: Unlike HTML scraping adapters, this adapter doesn't actually use the
 * ScrapingService for fetching. Instead, it provides:
 * - Feature flag support for gradual migration
 * - Cost tracking integration via DfsCostTracker
 * - Shadow comparison for validation during migration
 */
export const volumeRefreshAdapter: ConsumerAdapter<VolumeRefreshInput, VolumeRefreshOutput> = {
  feature: "volumeRefresh" as ScrapingFeature,

  /**
   * Convert volume refresh input to scrape options.
   *
   * Note: This generates a synthetic URL for cost tracking purposes.
   * The actual API call is made by volume-refresh-processor.
   */
  toScrapeOptions(input: VolumeRefreshInput): ScrapeOptions & { url: string } {
    // Generate synthetic URL for tracking (not actually fetched)
    const keywordCount = input.keywords.length;
    const syntheticUrl = `labs://search-volume/batch?count=${keywordCount}&location=${input.locationCode ?? 2440}`;

    return {
      url: syntheticUrl,
      feature: "volumeRefresh",
      clientId: input.clientId,
      // Volume refresh doesn't need HTML parsing
      includeHtml: false,
      includeParsedData: false,
      includeCwv: false,
    };
  },

  /**
   * Convert ScrapeResult to VolumeRefreshOutput.
   *
   * Note: In practice, volume refresh doesn't use ScrapeResult directly.
   * This method exists for interface compliance and shadow comparison.
   */
  toConsumerOutput(result: ScrapeResult, input: VolumeRefreshInput): VolumeRefreshOutput {
    // Parse keyword count from the synthetic URL or use input
    const keywordCount = input.keywords.length;

    if (!result.success) {
      return {
        success: false,
        metrics: [],
        keywordsProcessed: 0,
        keywordsSkipped: keywordCount,
        costUsd: result.estimatedCostUsd,
        processingTimeMs: result.responseTimeMs,
        error: result.error ?? "Volume refresh failed",
        refreshedAt: new Date(),
      };
    }

    // For shadow mode, we simulate metrics from the scrape result
    // In practice, metrics come from the DataForSEO Labs API response
    const simulatedMetrics: KeywordMetrics[] = input.keywords.map((keyword) => ({
      keyword,
      searchVolume: null,
      cpc: null,
      competition: null,
    }));

    return {
      success: true,
      metrics: simulatedMetrics,
      keywordsProcessed: keywordCount,
      keywordsSkipped: 0,
      costUsd: calculateCost(keywordCount),
      processingTimeMs: result.responseTimeMs,
      refreshedAt: new Date(),
    };
  },

  /**
   * Compare legacy and new outputs for shadow mode validation.
   *
   * Key comparisons:
   * - Success status must match
   * - Keyword counts should match
   * - Cost should be within 10% tolerance
   * - Metrics values compared with tolerance for API variance
   */
  compareOutputs(legacy: VolumeRefreshOutput, adapted: VolumeRefreshOutput): ComparisonResult {
    const differences: Array<{ field: string; legacy: unknown; new: unknown }> = [];

    // Compare success status
    if (legacy.success !== adapted.success) {
      differences.push({
        field: "success",
        legacy: legacy.success,
        new: adapted.success,
      });
    }

    // Compare keywords processed count
    if (legacy.keywordsProcessed !== adapted.keywordsProcessed) {
      differences.push({
        field: "keywordsProcessed",
        legacy: legacy.keywordsProcessed,
        new: adapted.keywordsProcessed,
      });
    }

    // Compare keywords skipped count
    if (legacy.keywordsSkipped !== adapted.keywordsSkipped) {
      differences.push({
        field: "keywordsSkipped",
        legacy: legacy.keywordsSkipped,
        new: adapted.keywordsSkipped,
      });
    }

    // Compare cost (10% tolerance for different calculation methods)
    const costDiff = Math.abs(legacy.costUsd - adapted.costUsd);
    const costThreshold = Math.max(legacy.costUsd, adapted.costUsd) * 0.1;
    if (costDiff > costThreshold && costDiff > 0.01) {
      differences.push({
        field: "costUsd",
        legacy: legacy.costUsd,
        new: adapted.costUsd,
      });
    }

    // Compare metrics if both succeeded
    if (legacy.success && adapted.success) {
      const legacyKeywords = new Set(legacy.metrics.map((m) => m.keyword.toLowerCase()));
      const adaptedKeywords = new Set(adapted.metrics.map((m) => m.keyword.toLowerCase()));

      // Check for missing keywords in either direction
      const missingInAdapted = [...legacyKeywords].filter((k) => !adaptedKeywords.has(k));
      const missingInLegacy = [...adaptedKeywords].filter((k) => !legacyKeywords.has(k));

      if (missingInAdapted.length > 0) {
        differences.push({
          field: "metrics.missingKeywords",
          legacy: missingInAdapted,
          new: [],
        });
      }

      if (missingInLegacy.length > 0) {
        differences.push({
          field: "metrics.extraKeywords",
          legacy: [],
          new: missingInLegacy,
        });
      }

      // Compare search volume values (with 20% tolerance for API variance)
      for (const legacyMetric of legacy.metrics) {
        const adaptedMetric = adapted.metrics.find(
          (m) => m.keyword.toLowerCase() === legacyMetric.keyword.toLowerCase()
        );

        if (adaptedMetric && legacyMetric.searchVolume !== null && adaptedMetric.searchVolume !== null) {
          const volumeDiff = Math.abs(legacyMetric.searchVolume - adaptedMetric.searchVolume);
          const volumeThreshold = Math.max(legacyMetric.searchVolume, adaptedMetric.searchVolume) * 0.2;

          if (volumeDiff > volumeThreshold && volumeDiff > 10) {
            differences.push({
              field: `metrics.${legacyMetric.keyword}.searchVolume`,
              legacy: legacyMetric.searchVolume,
              new: adaptedMetric.searchVolume,
            });
          }
        }
      }
    }

    // Compare error messages if both failed (categorize error type)
    if (!legacy.success && !adapted.success) {
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

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate estimated cost for a volume refresh batch.
 */
function calculateCost(keywordCount: number): number {
  // One request per batch + per-keyword cost
  return COST_PER_REQUEST_USD + keywordCount * COST_PER_KEYWORD_USD;
}

/**
 * Classify error messages into categories for comparison.
 * Helps match errors that may have different wording but same meaning.
 */
function classifyError(error: string): string {
  const errorLower = error.toLowerCase();

  if (errorLower.includes("timeout") || errorLower.includes("timed out")) {
    return "timeout";
  }
  if (errorLower.includes("rate") || errorLower.includes("limit") || errorLower.includes("429")) {
    return "rate_limit";
  }
  if (errorLower.includes("auth") || errorLower.includes("401") || errorLower.includes("403")) {
    return "auth_error";
  }
  if (errorLower.includes("api") || errorLower.includes("dataforseo")) {
    return "api_error";
  }
  if (errorLower.includes("network") || errorLower.includes("connection")) {
    return "network_error";
  }
  if (errorLower.includes("invalid") || errorLower.includes("validation")) {
    return "validation_error";
  }

  return "unknown";
}

/**
 * Create VolumeRefreshOutput from DataForSEO Labs API response.
 *
 * This function is used by volume-refresh-processor to convert raw API response
 * to the standardized VolumeRefreshOutput format.
 */
export function createVolumeRefreshOutput(params: {
  keywords: string[];
  apiResponse: Array<{
    keyword: string;
    search_volume?: number;
    cpc?: number;
    competition?: number;
  }>;
  processingTimeMs: number;
  error?: string;
}): VolumeRefreshOutput {
  const { keywords, apiResponse, processingTimeMs, error } = params;

  if (error) {
    return {
      success: false,
      metrics: [],
      keywordsProcessed: 0,
      keywordsSkipped: keywords.length,
      costUsd: COST_PER_REQUEST_USD, // Still charged for failed request
      processingTimeMs,
      error,
      refreshedAt: new Date(),
    };
  }

  const metricsMap = new Map(
    apiResponse.map((r) => [
      r.keyword.toLowerCase(),
      {
        keyword: r.keyword,
        searchVolume: r.search_volume ?? null,
        cpc: r.cpc ?? null,
        competition: r.competition ?? null,
      },
    ])
  );

  const metrics: KeywordMetrics[] = [];
  let keywordsSkipped = 0;

  for (const keyword of keywords) {
    const metric = metricsMap.get(keyword.toLowerCase());
    if (metric) {
      metrics.push(metric);
    } else {
      keywordsSkipped++;
    }
  }

  return {
    success: true,
    metrics,
    keywordsProcessed: metrics.length,
    keywordsSkipped,
    costUsd: calculateCost(keywords.length),
    processingTimeMs,
    refreshedAt: new Date(),
  };
}

/**
 * Create a VolumeRefreshAdapter instance for custom configuration.
 */
export function createVolumeRefreshAdapter(): ConsumerAdapter<VolumeRefreshInput, VolumeRefreshOutput> {
  return { ...volumeRefreshAdapter };
}
