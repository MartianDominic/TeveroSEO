/**
 * Feature Flag Loader
 * Phase 95-05: Migration & Monitoring
 *
 * Loads migration flags from environment variables with database fallback.
 * Provides caching to avoid repeated lookups.
 */

import type {
  ScrapingMigrationFlags,
  MigrationState,
  ScrapingFeature,
} from "./feature-flags";
import {
  DEFAULT_FLAGS,
  FLAG_ENV_VARS,
  isValidMigrationState,
} from "./feature-flags";

// =============================================================================
// Environment-Based Loading
// =============================================================================

/**
 * Get a single flag from environment variable.
 */
function getEnvFlag(key: string, defaultValue: MigrationState): MigrationState {
  const value = process.env[key];
  if (!value) return defaultValue;

  const normalized = value.toLowerCase().trim();
  return isValidMigrationState(normalized) ? normalized : defaultValue;
}

/**
 * Load all migration flags from environment variables.
 * Falls back to defaults for any missing or invalid values.
 */
export function loadMigrationFlags(): ScrapingMigrationFlags {
  return {
    prospectAnalysis: getEnvFlag(
      FLAG_ENV_VARS.prospectAnalysis,
      DEFAULT_FLAGS.prospectAnalysis
    ),
    contentBriefs: getEnvFlag(
      FLAG_ENV_VARS.contentBriefs,
      DEFAULT_FLAGS.contentBriefs
    ),
    serpContent: getEnvFlag(
      FLAG_ENV_VARS.serpContent,
      DEFAULT_FLAGS.serpContent
    ),
    competitorSpy: getEnvFlag(
      FLAG_ENV_VARS.competitorSpy,
      DEFAULT_FLAGS.competitorSpy
    ),
    hybridCrawler: getEnvFlag(
      FLAG_ENV_VARS.hybridCrawler,
      DEFAULT_FLAGS.hybridCrawler
    ),
    siteAudits: getEnvFlag(FLAG_ENV_VARS.siteAudits, DEFAULT_FLAGS.siteAudits),
  };
}

/**
 * Get a specific feature flag.
 */
export function getFeatureFlag(feature: ScrapingFeature): MigrationState {
  return getEnvFlag(FLAG_ENV_VARS[feature], DEFAULT_FLAGS[feature]);
}

// =============================================================================
// Cached Flag Loading
// =============================================================================

let cachedFlags: ScrapingMigrationFlags | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Load flags with caching to avoid repeated environment variable reads.
 * Cache TTL is 30 seconds to allow near-instant rollback via env var changes.
 */
export function loadMigrationFlagsCached(): ScrapingMigrationFlags {
  const now = Date.now();

  if (cachedFlags && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedFlags;
  }

  cachedFlags = loadMigrationFlags();
  cacheTimestamp = now;

  return cachedFlags;
}

/**
 * Clear the flag cache (useful for testing or instant rollback).
 */
export function clearFlagCache(): void {
  cachedFlags = null;
  cacheTimestamp = 0;
}

/**
 * Force reload flags from environment.
 */
export function reloadFlags(): ScrapingMigrationFlags {
  clearFlagCache();
  return loadMigrationFlagsCached();
}

// =============================================================================
// Flag Override Support
// =============================================================================

/**
 * In-memory overrides for testing or runtime configuration.
 * Takes precedence over environment variables.
 */
const flagOverrides: Partial<ScrapingMigrationFlags> = {};

/**
 * Set a runtime override for a feature flag.
 * Useful for testing or emergency rollback without restart.
 */
export function setFlagOverride(
  feature: ScrapingFeature,
  state: MigrationState
): void {
  flagOverrides[feature] = state;
  clearFlagCache(); // Ensure next load picks up the override
}

/**
 * Clear a runtime override for a feature flag.
 */
export function clearFlagOverride(feature: ScrapingFeature): void {
  delete flagOverrides[feature];
  clearFlagCache();
}

/**
 * Clear all runtime overrides.
 */
export function clearAllFlagOverrides(): void {
  for (const key of Object.keys(flagOverrides) as ScrapingFeature[]) {
    delete flagOverrides[key];
  }
  clearFlagCache();
}

/**
 * Get flag with override support.
 */
export function getFeatureFlagWithOverride(
  feature: ScrapingFeature
): MigrationState {
  if (feature in flagOverrides) {
    return flagOverrides[feature]!;
  }
  return getFeatureFlag(feature);
}

/**
 * Load flags with override support.
 */
export function loadMigrationFlagsWithOverrides(): ScrapingMigrationFlags {
  const envFlags = loadMigrationFlagsCached();

  return {
    ...envFlags,
    ...flagOverrides,
  };
}

// =============================================================================
// Flag Validation & Diagnostics
// =============================================================================

/**
 * Flag status for diagnostics.
 */
export interface FlagStatus {
  feature: ScrapingFeature;
  state: MigrationState;
  source: "default" | "environment" | "override";
  envVar: string;
  envValue: string | undefined;
}

/**
 * Get detailed status of all flags.
 */
export function getFlagStatus(): FlagStatus[] {
  const result: FlagStatus[] = [];

  for (const feature of Object.keys(DEFAULT_FLAGS) as ScrapingFeature[]) {
    const envVar = FLAG_ENV_VARS[feature];
    const envValue = process.env[envVar];
    const defaultState = DEFAULT_FLAGS[feature];
    const overrideState = flagOverrides[feature];

    let state: MigrationState;
    let source: FlagStatus["source"];

    if (overrideState) {
      state = overrideState;
      source = "override";
    } else if (envValue && isValidMigrationState(envValue.toLowerCase())) {
      state = envValue.toLowerCase() as MigrationState;
      source = "environment";
    } else {
      state = defaultState;
      source = "default";
    }

    result.push({
      feature,
      state,
      source,
      envVar,
      envValue,
    });
  }

  return result;
}

/**
 * Check if all features are at a specific state.
 */
export function allFeaturesAt(state: MigrationState): boolean {
  const flags = loadMigrationFlagsWithOverrides();
  return Object.values(flags).every((s) => s === state);
}

/**
 * Count features at each migration state.
 */
export function countByState(): Record<MigrationState, number> {
  const flags = loadMigrationFlagsWithOverrides();
  const counts: Record<MigrationState, number> = {
    legacy: 0,
    shadow: 0,
    canary: 0,
    rollout: 0,
    migrated: 0,
  };

  for (const state of Object.values(flags) as MigrationState[]) {
    counts[state]++;
  }

  return counts;
}

/**
 * Get migration progress as a percentage.
 */
export function getMigrationProgress(): number {
  const counts = countByState();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const migrated = counts.rollout + counts.migrated;
  return total > 0 ? (migrated / total) * 100 : 0;
}
