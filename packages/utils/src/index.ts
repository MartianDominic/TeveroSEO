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
