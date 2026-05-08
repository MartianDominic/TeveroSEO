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
// Constants
// =============================================================================

/**
 * Default canary percentage (10%) for backward compatibility.
 */
const DEFAULT_CANARY_PERCENT = 10;

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

  /** Enable unified scraping for voice analysis (5-10 pages/op) */
  voiceAnalysis: MigrationState;
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
  "voiceAnalysis", // Day 3: 5-10 pages/op, low risk (similar to contentBriefs)
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
  competitorSpy: "SCRAPING_COMPETITOR_SPY",
  hybridCrawler: "SCRAPING_HYBRID_CRAWLER",
  siteAudits: "SCRAPING_SITE_AUDITS",
  volumeRefresh: "SCRAPING_VOLUME_REFRESH",
  crawlWorkflow: "SCRAPING_CRAWL_WORKFLOW",
  voiceAnalysis: "SCRAPING_VOICE_ANALYSIS",
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
  competitorSpy: "legacy",
  hybridCrawler: "legacy",
  siteAudits: "legacy",
  volumeRefresh: "legacy",
  crawlWorkflow: "legacy",
  voiceAnalysis: "legacy",
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
 * Get the canary percentage for a feature.
 *
 * Supports two levels of configuration:
 * 1. Per-feature override: SCRAPING_CANARY_PERCENT_<FEATURE> (e.g., SCRAPING_CANARY_PERCENT_VOICE_ANALYSIS=20)
 * 2. Global setting: SCRAPING_CANARY_PERCENT (e.g., SCRAPING_CANARY_PERCENT=15)
 * 3. Default: 10% (backward compatible)
 *
 * @param feature - Optional feature name for feature-specific override
 * @returns Canary percentage (0-100)
 */
export function getCanaryPercent(feature?: ScrapingFeature): number {
  // Try feature-specific override first
  if (feature) {
    const featureEnvKey = `SCRAPING_CANARY_PERCENT_${feature.replace(/([A-Z])/g, "_$1").toUpperCase()}`;
    const featurePercent = process.env[featureEnvKey];
    if (featurePercent !== undefined && featurePercent !== "") {
      const parsed = parseInt(featurePercent, 10);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
        return parsed;
      }
      // Log warning for invalid per-feature value but continue to global fallback
      console.warn(
        `[feature-flags] Invalid ${featureEnvKey}="${featurePercent}" (must be 0-100), falling back to global/default`
      );
    }
  }

  // Fall back to global setting
  const globalPercent = process.env.SCRAPING_CANARY_PERCENT;
  if (globalPercent !== undefined && globalPercent !== "") {
    const parsed = parseInt(globalPercent, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      return parsed;
    }
    // Log warning for invalid global value but continue to default
    console.warn(
      `[feature-flags] Invalid SCRAPING_CANARY_PERCENT="${globalPercent}" (must be 0-100), using default ${DEFAULT_CANARY_PERCENT}%`
    );
  }

  return DEFAULT_CANARY_PERCENT;
}

/**
 * Validate canary configuration at startup.
 * Logs warnings for any invalid values but does not throw.
 */
export function validateCanaryConfig(): void {
  const globalPercent = process.env.SCRAPING_CANARY_PERCENT;
  if (globalPercent !== undefined && globalPercent !== "") {
    const parsed = parseInt(globalPercent, 10);
    if (isNaN(parsed) || parsed < 0 || parsed > 100) {
      console.warn(
        `[feature-flags] SCRAPING_CANARY_PERCENT="${globalPercent}" is invalid (must be 0-100). Using default ${DEFAULT_CANARY_PERCENT}%.`
      );
    }
  }

  // Check all feature-specific overrides
  const features: ScrapingFeature[] = Object.keys(FLAG_ENV_VARS) as ScrapingFeature[];
  for (const feature of features) {
    const featureEnvKey = `SCRAPING_CANARY_PERCENT_${feature.replace(/([A-Z])/g, "_$1").toUpperCase()}`;
    const featurePercent = process.env[featureEnvKey];
    if (featurePercent !== undefined && featurePercent !== "") {
      const parsed = parseInt(featurePercent, 10);
      if (isNaN(parsed) || parsed < 0 || parsed > 100) {
        console.warn(
          `[feature-flags] ${featureEnvKey}="${featurePercent}" is invalid (must be 0-100). Will use global/default.`
        );
      }
    }
  }
}

/**
 * Get the percentage of requests that should use the new implementation.
 *
 * @param state - The migration state of the feature
 * @param feature - Optional feature name for feature-specific canary percentage
 * @returns Percentage (0-100) of requests to route to new implementation
 */
export function getNewImplementationPercentage(
  state: MigrationState,
  feature?: ScrapingFeature
): number {
  switch (state) {
    case "legacy":
      return 0;
    case "shadow":
      return 0; // Shadow runs both but returns legacy
    case "canary":
      return getCanaryPercent(feature);
    case "rollout":
    case "migrated":
      return 100;
  }
}

/**
 * Determine if this request should use new implementation based on canary percentage.
 *
 * @param feature - Optional feature name for feature-specific canary percentage
 * @returns true if this request should use the new implementation
 */
export function shouldUseNewForCanary(feature?: ScrapingFeature): boolean {
  const percent = getCanaryPercent(feature);
  return Math.random() < percent / 100;
}
