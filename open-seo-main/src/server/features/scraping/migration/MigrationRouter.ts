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
import { migrationLogger } from "../logging";
import type { ConsumerAdapter } from "./adapters/types";

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
 * Supports two patterns:
 * 1. Standard: url + transformer (explicit transformers)
 * 2. Adapter: input + adapter (adapter handles transformations)
 */
export interface RouteOptions<TLegacyResult, TInput = unknown> {
  /** The feature making the request */
  feature: ScrapingFeature;
  /** Legacy scraper function */
  legacyFn: () => Promise<TLegacyResult>;
  /** Run shadow in non-blocking mode */
  asyncShadow?: boolean;

  // Standard pattern (url + transformer)
  /** URL to scrape (standard pattern) */
  url?: string;
  /** Options passed to ScrapingService (standard pattern) */
  scrapeOptions?: ScrapeOptions;
  /** Transform functions between legacy and new result formats (standard pattern) */
  transformer?: ResultTransformer<TLegacyResult, ScrapeResult>;
  /** Comparison function for shadow mode (standard pattern) */
  compareFn?: (legacy: TLegacyResult, newResult: TLegacyResult) => { match: boolean; differences: string[] };

  // Adapter pattern (input + adapter)
  /** Input data for adapter (adapter pattern) */
  input?: TInput;
  /** Consumer adapter for transformations (adapter pattern) */
  adapter?: ConsumerAdapter<TInput, TLegacyResult>;
}

// =============================================================================
// Migration Router
// =============================================================================

/**
 * Resolved options for internal routing functions.
 * Always has url, scrapeOptions, and transformer resolved from either pattern.
 */
interface ResolvedRouteOptions<TLegacyResult> {
  feature: ScrapingFeature;
  url: string;
  legacyFn: () => Promise<TLegacyResult>;
  scrapeOptions: ScrapeOptions;
  transformer: ResultTransformer<TLegacyResult, ScrapeResult>;
  compareFn?: (legacy: TLegacyResult, newResult: TLegacyResult) => { match: boolean; differences: string[] };
  asyncShadow?: boolean;
}

/**
 * Resolve RouteOptions to always have url, scrapeOptions, and transformer.
 * Handles both standard pattern (url + transformer) and adapter pattern (input + adapter).
 */
function resolveOptions<TLegacyResult, TInput>(
  options: RouteOptions<TLegacyResult, TInput>
): ResolvedRouteOptions<TLegacyResult> {
  const { feature, legacyFn, asyncShadow, compareFn } = options;

  if (options.adapter && options.input !== undefined) {
    const { adapter, input } = options;
    const scrapeOpts = adapter.toScrapeOptions(input);
    const { url, ...restOpts } = scrapeOpts;

    return {
      feature,
      url,
      legacyFn,
      scrapeOptions: restOpts,
      transformer: {
        legacyToNew: (legacy) => legacy as unknown as ScrapeResult,
        newToLegacy: (newResult) => adapter.toConsumerOutput(newResult, input),
      },
      compareFn: compareFn ?? ((legacy, adapted) => {
        const result = adapter.compareOutputs(legacy, adapted);
        return { match: result.match, differences: result.differences.map(d => d.field) };
      }),
      asyncShadow,
    };
  }

  if (!options.url || !options.transformer) {
    throw new Error('RouteOptions must have either (url + transformer) or (input + adapter)');
  }

  return {
    feature,
    url: options.url,
    legacyFn,
    scrapeOptions: options.scrapeOptions ?? {},
    transformer: options.transformer,
    compareFn,
    asyncShadow,
  };
}

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
export async function routeRequest<TLegacyResult, TInput = unknown>(
  options: RouteOptions<TLegacyResult, TInput>
): Promise<TLegacyResult> {
  const flags = loadMigrationFlagsCached();
  const state = flags[options.feature];

  // Route based on migration state
  switch (state) {
    case "legacy":
      return options.legacyFn();

    case "shadow": {
      const resolved = resolveOptions(options);
      return runShadowMode(resolved);
    }

    case "canary": {
      const resolved = resolveOptions(options);
      return runCanaryMode(resolved);
    }

    case "rollout": {
      const resolved = resolveOptions(options);
      return runRolloutMode(resolved);
    }

    case "migrated": {
      const resolved = resolveOptions(options);
      return runMigratedMode(resolved);
    }

    default:
      // Fallback to legacy for unknown states
      migrationLogger.warn({ feature: options.feature, state }, 'Unknown migration state, using legacy');
      return options.legacyFn();
  }
}

/**
 * Run in shadow mode: both implementations, return legacy.
 */
async function runShadowMode<TLegacyResult>(
  options: ResolvedRouteOptions<TLegacyResult>
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
  options: ResolvedRouteOptions<TLegacyResult>
): Promise<TLegacyResult> {
  const { feature, url, legacyFn, scrapeOptions, transformer } = options;

  if (shouldUseNewForCanary()) {
    try {
      const newResult = await scrapingService.scrape(url, {
        ...scrapeOptions,
        feature,
      });
      return transformer.newToLegacy(newResult);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      migrationLogger.warn({ feature, error: err.message }, 'Canary failed, falling back to legacy');
      scrapingService.recordFallback();
      return legacyFn();
    }
  }

  return legacyFn();
}

/**
 * Run in rollout mode: 100% new with legacy fallback.
 */
async function runRolloutMode<TLegacyResult>(
  options: ResolvedRouteOptions<TLegacyResult>
): Promise<TLegacyResult> {
  const { feature, url, legacyFn, scrapeOptions, transformer } = options;

  try {
    const newResult = await scrapingService.scrape(url, {
      ...scrapeOptions,
      feature,
    });
    return transformer.newToLegacy(newResult);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    migrationLogger.warn({ feature, error: err.message }, 'Rollout failed, falling back to legacy');
    scrapingService.recordFallback();
    return legacyFn();
  }
}

/**
 * Run in migrated mode: new only, no fallback.
 */
async function runMigratedMode<TLegacyResult>(
  options: ResolvedRouteOptions<TLegacyResult>
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
        const err = error instanceof Error ? error : new Error(String(error));
        migrationLogger.warn({ feature: options.feature, error: err.message }, 'Batch failed, falling back to legacy');
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
