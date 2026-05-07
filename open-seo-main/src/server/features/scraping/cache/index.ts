/**
 * Multi-Level Caching System - Public API
 * Phase 95-02: Multi-Level Caching
 *
 * Re-exports all public types and functions from the cache module.
 */

// =============================================================================
// Types
// =============================================================================

export type {
  CacheLevel,
  ContentType,
  CompressionAlgo,
  ParsedPageData,
  CachedPage,
  CacheResult,
  RevalidationHeaders,
  LevelStats,
  CacheStats,
  L1CacheConfig,
  L2CacheConfig,
  L3CacheConfig,
  L4CacheConfig,
  CacheConfig,
  GetOptions,
  SetOptions,
  InvalidationEventType,
  InvalidationEvent,
  ICacheManager,
  ICacheLevel,
} from "./types";

export { TTL_LEVEL_MULTIPLIERS, TTL_BY_CONTENT_TYPE, TRACKING_PARAMS } from "./types";

// =============================================================================
// Cache Manager
// =============================================================================

export { CacheManager, createCacheManager } from "./CacheManager";

// =============================================================================
// Individual Cache Levels (for testing/debugging)
// =============================================================================

export { L1Cache, createL1Cache } from "./L1Cache";
export { L2Cache, createL2Cache } from "./L2Cache";
export { L3Cache, createL3Cache } from "./L3Cache";
export { L4Cache, createL4Cache } from "./L4Cache";

// =============================================================================
// URL Normalization
// =============================================================================

export {
  normalizeUrl,
  normalizeUrlSafe,
  getCacheKey,
  getContentHash,
  getQuickHash,
  extractDomain,
  urlsMatch,
  isValidUrl,
  getPathSegments,
  isHomepage,
} from "./urlNormalization";

// =============================================================================
// TTL Strategy
// =============================================================================

export {
  detectContentType,
  getTtl,
  getTtlForUrl,
  calculateExpiresAt,
  isExpired,
  getRemainingTtl,
  formatTtl,
  getTtlPolicy,
  validateTtl,
  clampTtl,
  getFreshness,
  shouldProactivelyRefresh,
} from "./ttlStrategy";

// =============================================================================
// Invalidation
// =============================================================================

export {
  urlChangedEvent,
  domainUpdatedEvent,
  auditStartedEvent,
  forceRefreshEvent,
  ttlExpiredEvent,
  getInvalidationLevels,
  shouldPreserveHistory,
  getCascadeOrder,
  shouldInvalidateLevel,
  getInvalidationKeys,
  getDomainPattern,
  shouldExtendTtlOn304,
  calculateExtendedExpiry,
  shouldServeStale,
  needsRevalidation,
  groupUrlsByDomain,
  filterChangedUrls,
  createInvalidationLog,
} from "./invalidation";

export type { StaleWhileRevalidateConfig } from "./invalidation";

// =============================================================================
// Compression
// =============================================================================

export {
  compress,
  decompress,
  compressToBase64,
  decompressFromBase64,
  compressToBuffer,
  shouldCompress,
} from "./compression";

export type { CompressionResult } from "./compression";

// =============================================================================
// Metrics & Monitoring
// =============================================================================

export {
  CacheMetricsCollector,
  createMetricsCollector,
  exportPrometheusFormat,
  exportJsonFormat,
  calculateOverallHitRate,
  calculateWeightedLatency,
  formatBytes,
  formatRate,
  formatLatency,
  getDashboardQuery,
  CACHE_METRICS,
  DEFAULT_ALERT_THRESHOLDS,
  DASHBOARD_QUERIES,
} from "./metrics";

export type {
  MetricType,
  MetricDefinition,
  MetricValue,
  Metric,
  AlertThreshold,
  MetricSnapshot,
  AlertTriggered,
} from "./metrics";

// =============================================================================
// Cache Warmer
// =============================================================================

export {
  CacheWarmer,
  createCacheWarmer,
  getCacheWarmer,
  setWarmerDependencies,
} from "./CacheWarmer";

export type {
  WarmingConfig,
  WarmingProgress,
  WarmingResult,
} from "./CacheWarmer";
