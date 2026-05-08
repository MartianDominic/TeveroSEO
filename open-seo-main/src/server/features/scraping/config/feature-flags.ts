/**
 * Feature Flags for Scraping Migration
 * Phase 95-05: Migration & Monitoring
 *
 * Controls gradual migration of 6 scraping consumers from legacy DataForSEO-only
 * to the unified TieredFetcher + CacheManager infrastructure.
 *
 * Migration states:
 * - legacy: Use old implementation only
 * - shadow: Run both, log differences, return legacy result
 * - canary: 10% new, 90% legacy
 * - rollout: 100% new, legacy as fallback on error
 * - migrated: New only, legacy code can be removed
 */

// =============================================================================
// Types
// =============================================================================

/**
 * Migration state for a feature.
 */
export type MigrationState =
  | "legacy" // Use old implementation only
  | "shadow" // Run both, log differences, return legacy result
  | "canary" // 10% new, 90% legacy
  | "rollout" // 100% new, legacy as fallback on error
  | "migrated"; // New only, legacy code removed

/**
 * Feature flag configuration for all scraping consumers.
 */
export interface ScrapingMigrationFlags {
  /** Enable unified scraping for prospect analysis (4 pages/op) */
  prospectAnalysis: MigrationState;

  /** Enable unified scraping for content briefs / SerpAnalyzer (5 pages/op) */
  contentBriefs: MigrationState;

  /** Enable unified scraping for SERP content analysis (5 pages/op) */
  serpContent: MigrationState;

  /** Enable unified scraping for competitor spy (~100 keywords/domain) */
  competitorSpy: MigrationState;

  /** Enable unified scraping for hybrid crawler (up to 10K pages) */
  hybridCrawler: MigrationState;

  /** Enable unified scraping for site audits (up to 10K pages) */
  siteAudits: MigrationState;

  /** Enable unified scraping for volume refresh worker (keyword metrics) */
  volumeRefresh: MigrationState;

  /** Enable unified scraping for crawl workflow (site audit crawl phase) */
  crawlWorkflow: MigrationState;

  /** Enable unified cost tracking for SERP API calls (SerpAnalyzer) */
  serpApi: MigrationState;
}

/**
 * Feature names as a type for type-safe lookups.
 */
export type ScrapingFeature = keyof ScrapingMigrationFlags;

/**
 * Migration order by risk/volume (lowest first).
 */
export const MIGRATION_ORDER: ScrapingFeature[] = [
  "prospectAnalysis", // Day 1-2: 4 pages/op, low risk
  "contentBriefs", // Day 2-3: 5 pages/op, low risk
  "serpContent", // Day 3: 5 pages/op, low risk
  "serpApi", // Day 3: SERP API cost tracking, low risk
  "competitorSpy", // Day 3-4: variable, medium risk
  "volumeRefresh", // Day 4: keyword metrics, medium risk
  "hybridCrawler", // Day 4-5: 10K pages, high risk
  "crawlWorkflow", // Day 5-6: site audit crawl, high risk
  "siteAudits", // Day 6-7: 10K pages, highest risk
];

/**
 * Environment variable names for each feature flag.
 */
export const FLAG_ENV_VARS: Record<ScrapingFeature, string> = {
  prospectAnalysis: "SCRAPING_PROSPECT_ANALYSIS",
  contentBriefs: "SCRAPING_CONTENT_BRIEFS",
  serpContent: "SCRAPING_SERP_CONTENT",
  serpApi: "SCRAPING_SERP_API",
  competitorSpy: "SCRAPING_COMPETITOR_SPY",
  hybridCrawler: "SCRAPING_HYBRID_CRAWLER",
  siteAudits: "SCRAPING_SITE_AUDITS",
  volumeRefresh: "SCRAPING_VOLUME_REFRESH",
  crawlWorkflow: "SCRAPING_CRAWL_WORKFLOW",
};

// =============================================================================
// Default Configuration
// =============================================================================

/**
 * Default flags - all start at legacy mode for safe rollout.
 */
export const DEFAULT_FLAGS: Readonly<ScrapingMigrationFlags> = {
  prospectAnalysis: "legacy",
  contentBriefs: "legacy",
  serpContent: "legacy",
  serpApi: "legacy",
  competitorSpy: "legacy",
  hybridCrawler: "legacy",
  siteAudits: "legacy",
  volumeRefresh: "legacy",
  crawlWorkflow: "legacy",
};

/**
 * All valid migration states.
 */
export const VALID_MIGRATION_STATES: readonly MigrationState[] = [
  "legacy",
  "shadow",
  "canary",
  "rollout",
  "migrated",
];

// =============================================================================
// Flag Utilities
// =============================================================================

/**
 * Check if a value is a valid migration state.
 */
export function isValidMigrationState(value: unknown): value is MigrationState {
  return (
    typeof value === "string" &&
    VALID_MIGRATION_STATES.includes(value as MigrationState)
  );
}

/**
 * Check if a feature should use the new unified scraping.
 */
export function shouldUseUnified(state: MigrationState): boolean {
  return state === "rollout" || state === "migrated";
}

/**
 * Check if a feature should run shadow comparison.
 */
export function shouldRunShadow(state: MigrationState): boolean {
  return state === "shadow";
}

/**
 * Check if a feature is in canary mode.
 */
export function isCanaryMode(state: MigrationState): boolean {
  return state === "canary";
}

/**
 * Check if a feature has completed migration.
 */
export function isMigrated(state: MigrationState): boolean {
  return state === "migrated";
}

/**
 * Check if legacy fallback is available.
 */
export function hasLegacyFallback(state: MigrationState): boolean {
  return state !== "migrated";
}

/**
 * Get the percentage of requests that should use the new implementation.
 */
export function getNewImplementationPercentage(state: MigrationState): number {
  switch (state) {
    case "legacy":
      return 0;
    case "shadow":
      return 0; // Shadow runs both but returns legacy
    case "canary":
      return 10;
    case "rollout":
    case "migrated":
      return 100;
  }
}

/**
 * Determine if this request should use new implementation based on canary percentage.
 */
export function shouldUseNewForCanary(): boolean {
  return Math.random() < 0.1; // 10% canary
}
