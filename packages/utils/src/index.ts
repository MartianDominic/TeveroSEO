/**
 * @tevero/utils - Shared utility functions
 *
 * This package consolidates common utilities used across TeveroSEO applications.
 * Import from here to avoid code duplication.
 *
 * @example
 * ```typescript
 * import {
 *   fetchWithTimeout,
 *   TimeoutError,
 *   DEFAULT_TIMEOUT_MS,
 *   formatNumber,
 *   formatCurrency,
 *   CursorPaginationParams,
 * } from "@tevero/utils";
 * ```
 */

// Fetch utilities
export {
  fetchWithTimeout,
  TimeoutError,
  DEFAULT_TIMEOUT_MS,
  LONG_RUNNING_TIMEOUT_MS,
  QUICK_CHECK_TIMEOUT_MS,
} from "./fetch";
export type { FetchWithTimeoutOptions } from "./fetch";

// Formatting utilities
export {
  formatNumber,
  formatCompactNumber,
  formatFloat,
  formatCurrency,
  formatCents,
  formatAmount,
  getCurrencySymbol,
  parseCurrency,
  formatPercent,
} from "./format";

// Pagination utilities
export {
  encodeCursor,
  decodeCursor,
  calculatePaginationMeta,
  calculateOffset,
} from "./pagination";
export type {
  CursorPaginationParams,
  CursorPaginationResult,
  OffsetPaginationParams,
  OffsetPaginationMeta,
  PaginatedResponse,
  FilterParams,
} from "./pagination";

// Rate limit configuration (centralized source of truth)
export {
  AUTH_RATE_LIMITS,
  API_RATE_LIMITS,
  SEO_RATE_LIMITS,
  CONTENT_RATE_LIMITS,
  ANALYTICS_RATE_LIMITS,
  PORTAL_RATE_LIMITS,
  SCRAPING_ADMIN_RATE_LIMITS,
  RESOURCE_RATE_LIMITS,
  FALLBACK_PERCENTAGES,
  toSecondsConfig,
  getFallbackLimit,
  getAllRateLimitConfigs,
} from "./rate-limit-config";
export type {
  RateLimitConfig,
  RateLimitTier,
  TieredRateLimitConfig,
} from "./rate-limit-config";

// Bounded cache utilities (consolidated from open-seo-main and apps/web)
export {
  BoundedCache,
  createBoundedCache,
  startPeriodicPruning,
  createApiResponseCache,
  createUserProfileCache,
  createSerpMemoryCache,
} from "./bounded-cache";
export type {
  BoundedCacheOptions,
  CacheEntry,
  CacheStats,
} from "./bounded-cache";
