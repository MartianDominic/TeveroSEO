/**
 * Migration Utilities for TieredFetcher
 * Phase 95: Unified Scraping Infrastructure
 *
 * Provides backward-compatible adapters, shadow mode testing,
 * and migration routing for migrating existing crawlers
 * to the new TieredFetcher system.
 */

// =============================================================================
// Backward-Compatible Adapters (Plan 95-01)
// =============================================================================

export {
  // Adapters
  TieredCrawlerAdapter,
  UniversalCrawlerAdapter,
  // Convenience functions
  fetchPageWithTiered,
  crawlUrlWithTiered,
  // Types for HybridCrawler compatibility
  type HybridCrawlResult,
  type HybridCrawlOptions,
  // Types for UniversalCrawler compatibility
  type UniversalCrawlResult,
  type UniversalCrawlOptions,
  type PageData,
} from "./TieredFetcherMigration";

// =============================================================================
// Shadow Mode (Plan 95-05)
// =============================================================================

export {
  // Core shadow runner
  runShadow,
  runShadowAsync,
  // Logging
  logShadowComparison,
  getShadowComparisonLogs,
  getShadowStats,
  clearShadowLogs,
  // Types
  type ShadowComparison,
  type ShadowResult,
  type ShadowComparisonLog,
  type CompareFunction,
} from "./shadow-runner";

// =============================================================================
// Comparators (Plan 95-05)
// =============================================================================

export {
  // Single page comparators
  compareSingleScrape,
  compareParsedData,
  // Multi-page comparators
  compareProspectScrape,
  compareSerpContent,
  compareBatchResults,
  // Types
  type MultiPageScrapeResult,
  type SerpContentAnalysis,
  type ComparisonResult,
} from "./comparators";

// =============================================================================
// Migration Router (Plan 95-05)
// =============================================================================

export {
  // Core routing
  routeRequest,
  routeBatchRequest,
  // Helpers
  featureShouldUseUnified,
  getFeatureMigrationState,
  getMigrationSummary,
  // Types
  type LegacyScraperFn,
  type ResultTransformer,
  type RouteOptions,
  type BatchRouteOptions,
} from "./MigrationRouter";
