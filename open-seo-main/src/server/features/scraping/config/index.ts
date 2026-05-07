/**
 * Scraping Config Module
 * Phase 95: Unified Scraping Infrastructure
 *
 * Exports for proxy configuration and migration feature flags.
 */

// =============================================================================
// Proxy Configuration
// =============================================================================

export {
  // Schemas
  GeonodeConfigSchema,
  WebshareConfigSchema,
  // Types
  type GeonodeConfig,
  type WebshareConfig,
  type ProxyConfig,
  // Functions
  loadProxyConfig,
  getProxyConfig,
  getRequiredProxyConfig,
  reloadProxyConfig,
} from "./proxy-config";

// =============================================================================
// Feature Flags (Plan 95-05)
// =============================================================================

export {
  // Types
  type MigrationState,
  type ScrapingMigrationFlags,
  type ScrapingFeature,
  // Constants
  DEFAULT_FLAGS,
  VALID_MIGRATION_STATES,
  MIGRATION_ORDER,
  FLAG_ENV_VARS,
  // Utilities
  isValidMigrationState,
  shouldUseUnified,
  shouldRunShadow,
  isCanaryMode,
  isMigrated,
  hasLegacyFallback,
  getNewImplementationPercentage,
  shouldUseNewForCanary,
} from "./feature-flags";

// =============================================================================
// Flag Loader (Plan 95-05)
// =============================================================================

export {
  // Core loading
  loadMigrationFlags,
  loadMigrationFlagsCached,
  getFeatureFlag,
  reloadFlags,
  clearFlagCache,
  // Override support
  setFlagOverride,
  clearFlagOverride,
  clearAllFlagOverrides,
  getFeatureFlagWithOverride,
  loadMigrationFlagsWithOverrides,
  // Diagnostics
  getFlagStatus,
  allFeaturesAt,
  countByState,
  getMigrationProgress,
  type FlagStatus,
} from "./flags-loader";
