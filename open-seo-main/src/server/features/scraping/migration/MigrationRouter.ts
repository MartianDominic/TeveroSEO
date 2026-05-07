/**
 * Migration Router
 * Phase 95-05: Migration & Monitoring
 *
 * Routes scraping requests to legacy or new implementation based on feature flags.
 * Handles all migration states: legacy, shadow, canary, rollout, migrated.
 */

import {
  loadMigrationFlagsCached,
  type MigrationState,
  type ScrapingFeature,
  shouldUseUnified,
  shouldUseNewForCanary,
  hasLegacyFallback,
} from "../config";
import { scrapingService, type ScrapeOptions, type ScrapeResult } from "../ScrapingService";
import { runShadow, runShadowAsync } from "./shadow-runner";
import { compareSingleScrape } from "./comparators";

// =============================================================================
// Types
// =============================================================================

/**
 * Legacy scraper function type.
 */
export type LegacyScraperFn<TResult> = (url: string, options?: unknown) => Promise<TResult>;

/**
 * Result transformation function.
 * Converts between legacy result format and ScrapeResult.
 */
export type ResultTransformer<TLegacy, TNew> = {
  legacyToNew: (legacy: TLegacy) => TNew;
  newToLegacy: (newResult: TNew) => TLegacy;
};

/**
 * Options for routing a request.
 */
export interface RouteOptions<TLegacyResult> {
  /** The feature making the request */
  feature: ScrapingFeature;
  /** URL to scrape */
  url: string;
  /** Legacy scraper function */
  legacyFn: () => Promise<TLegacyResult>;
  /** Options passed to ScrapingService */
  scrapeOptions?: ScrapeOptions;
  /** Transform functions between legacy and new result formats */
  transformer: ResultTransformer<TLegacyResult, ScrapeResult>;
  /** Comparison function for shadow mode */
  compareFn?: (legacy: TLegacyResult, newResult: TLegacyResult) => { match: boolean; differences: string[] };
  /** Run shadow in non-blocking mode */
  asyncShadow?: boolean;
}

// =============================================================================
// Migration Router
// =============================================================================

/**
 * Route a scraping request through the migration system.
 *
 * @param options Routing options
 * @returns Result in the legacy format (for backward compatibility)
 *
 * @example
 * ```typescript
 * const result = await routeRequest({
 *   feature: 'prospectAnalysis',
 *   url: 'https://example.com',
 *   legacyFn: () => scrapeWithDataForSEO(url),
 *   scrapeOptions: { includeHtml: true },
 *   transformer: {
 *     legacyToNew: (legacy) => ({ ...convertLegacyToNew(legacy) }),
 *     newToLegacy: (newResult) => ({ ...convertNewToLegacy(newResult) }),
 *   },
 *   compareFn: compareProspectScrape,
 * });
 * ```
 */
export async function routeRequest<TLegacyResult>(
  options: RouteOptions<TLegacyResult>
): Promise<TLegacyResult> {
  const flags = loadMigrationFlagsCached();
  const state = flags[options.feature];

  // Route based on migration state
  switch (state) {
    case "legacy":
      return options.legacyFn();

    case "shadow":
      return runShadowMode(options);

    case "canary":
      return runCanaryMode(options);

    case "rollout":
      return runRolloutMode(options);

    case "migrated":
      return runMigratedMode(options);

    default:
      // Fallback to legacy for unknown states
      console.warn(`[MigrationRouter] Unknown state "${state}" for ${options.feature}, using legacy`);
      return options.legacyFn();
  }
}

/**
 * Run in shadow mode: both implementations, return legacy.
 */
async function runShadowMode<TLegacyResult>(
  options: RouteOptions<TLegacyResult>
): Promise<TLegacyResult> {
  const { feature, url, legacyFn, scrapeOptions, transformer, compareFn, asyncShadow } = options;

  const newFn = async (): Promise<TLegacyResult> => {
    const newResult = await scrapingService.scrape(url, {
      ...scrapeOptions,
      feature,
    });
    return transformer.newToLegacy(newResult);
  };

  const defaultCompareFn = (legacy: TLegacyResult, newResult: TLegacyResult) => {
    // Default comparison: convert both to ScrapeResult and compare
    const legacyConverted = transformer.legacyToNew(legacy);
    const newConverted = transformer.legacyToNew(newResult);
    return compareSingleScrape(legacyConverted, newConverted);
  };

  const compareFunction = compareFn ?? defaultCompareFn;

  if (asyncShadow) {
    return runShadowAsync(feature, legacyFn, newFn, compareFunction, { url });
  }

  return runShadow(feature, legacyFn, newFn, compareFunction, { url });
}

/**
 * Run in canary mode: 10% new, 90% legacy.
 */
async function runCanaryMode<TLegacyResult>(
  options: RouteOptions<TLegacyResult>
): Promise<TLegacyResult> {
  const { feature, url, legacyFn, scrapeOptions, transformer } = options;

  if (shouldUseNewForCanary()) {
    // Use new implementation (10% of requests)
    try {
      const newResult = await scrapingService.scrape(url, {
        ...scrapeOptions,
        feature,
      });
      return transformer.newToLegacy(newResult);
    } catch (error) {
      // Fallback to legacy on error
      console.warn(`[MigrationRouter] Canary failed for ${feature}, falling back to legacy:`, error);
      scrapingService.recordFallback();
      return legacyFn();
    }
  }

  // Use legacy implementation (90% of requests)
  return legacyFn();
}

/**
 * Run in rollout mode: 100% new with legacy fallback.
 */
async function runRolloutMode<TLegacyResult>(
  options: RouteOptions<TLegacyResult>
): Promise<TLegacyResult> {
  const { feature, url, legacyFn, scrapeOptions, transformer } = options;

  try {
    const newResult = await scrapingService.scrape(url, {
      ...scrapeOptions,
      feature,
    });
    return transformer.newToLegacy(newResult);
  } catch (error) {
    // Fallback to legacy on error
    console.warn(`[MigrationRouter] Rollout failed for ${feature}, falling back to legacy:`, error);
    scrapingService.recordFallback();
    return legacyFn();
  }
}

/**
 * Run in migrated mode: new only, no fallback.
 */
async function runMigratedMode<TLegacyResult>(
  options: RouteOptions<TLegacyResult>
): Promise<TLegacyResult> {
  const { feature, url, scrapeOptions, transformer } = options;

  const newResult = await scrapingService.scrape(url, {
    ...scrapeOptions,
    feature,
  });
  return transformer.newToLegacy(newResult);
}

// =============================================================================
// Batch Routing
// =============================================================================

/**
 * Options for routing a batch request.
 */
export interface BatchRouteOptions<TLegacyResult> {
  feature: ScrapingFeature;
  urls: string[];
  legacyBatchFn: (urls: string[]) => Promise<Map<string, TLegacyResult>>;
  scrapeOptions?: ScrapeOptions;
  transformer: ResultTransformer<TLegacyResult, ScrapeResult>;
  concurrency?: number;
}

/**
 * Route a batch scraping request through the migration system.
 */
export async function routeBatchRequest<TLegacyResult>(
  options: BatchRouteOptions<TLegacyResult>
): Promise<Map<string, TLegacyResult>> {
  const flags = loadMigrationFlagsCached();
  const state = flags[options.feature];

  // For batch operations, use simplified routing (no shadow mode)
  if (state === "legacy") {
    return options.legacyBatchFn(options.urls);
  }

  if (shouldUseUnified(state)) {
    try {
      const batchResult = await scrapingService.scrapeBatch(options.urls, {
        ...options.scrapeOptions,
        feature: options.feature,
        concurrency: options.concurrency,
      });

      // Convert results to legacy format
      const legacyResults = new Map<string, TLegacyResult>();
      for (const result of batchResult.results) {
        legacyResults.set(result.url, options.transformer.newToLegacy(result));
      }
      return legacyResults;
    } catch (error) {
      if (hasLegacyFallback(state)) {
        console.warn(`[MigrationRouter] Batch ${options.feature} failed, falling back to legacy:`, error);
        scrapingService.recordFallback();
        return options.legacyBatchFn(options.urls);
      }
      throw error;
    }
  }

  // Canary: just use legacy for batch (simpler)
  return options.legacyBatchFn(options.urls);
}

// =============================================================================
// Feature-Specific Helpers
// =============================================================================

/**
 * Check if a feature should use unified scraping.
 */
export function featureShouldUseUnified(feature: ScrapingFeature): boolean {
  const flags = loadMigrationFlagsCached();
  return shouldUseUnified(flags[feature]);
}

/**
 * Get the current migration state for a feature.
 */
export function getFeatureMigrationState(feature: ScrapingFeature): MigrationState {
  const flags = loadMigrationFlagsCached();
  return flags[feature];
}

/**
 * Get a summary of migration states for all features.
 */
export function getMigrationSummary(): Record<ScrapingFeature, { state: MigrationState; usingUnified: boolean }> {
  const flags = loadMigrationFlagsCached();
  const summary: Record<ScrapingFeature, { state: MigrationState; usingUnified: boolean }> = {} as Record<ScrapingFeature, { state: MigrationState; usingUnified: boolean }>;

  for (const feature of Object.keys(flags) as ScrapingFeature[]) {
    summary[feature] = {
      state: flags[feature],
      usingUnified: shouldUseUnified(flags[feature]),
    };
  }

  return summary;
}
