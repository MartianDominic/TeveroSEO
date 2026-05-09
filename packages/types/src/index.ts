// =============================================================================
// Core Entity Types
// =============================================================================
export type { Client } from "./client";
export type { Project } from "./project";
export type { AuditStatus } from "./audit";

// =============================================================================
// Event Types (Phase 68-03)
// =============================================================================
export * from "./events";

// =============================================================================
// OAuth Types
// =============================================================================
export type {
  OAuthProvider,
  OAuthConnection,
  InviteResponse,
  InviteValidation,
  InviteCreate,
} from "./oauth";

// =============================================================================
// Report Types
// =============================================================================
export type {
  ReportSectionType,
  ReportSection,
  ReportTemplate,
  ReportMetadata,
  ReportStatus,
  ReportSectionMeta,
  ReportBuilderConfig,
} from "./reports";

// =============================================================================
// Error Types (Phase 96 Unified)
// =============================================================================
export type {
  ErrorCode,
  StandardError,
  ErrorResponse,
} from "./error";
export {
  HTTP_STATUS_TO_ERROR_CODE,
  ERROR_CODE_TO_HTTP_STATUS,
  createErrorResponse,
  deriveErrorCode,
  getHttpStatus,
} from "./error";

// =============================================================================
// Scoring Types (FIX-14)
// =============================================================================
export {
  QUALITY_THRESHOLDS,
  SCORE_COLORS,
  SCORE_LABELS,
  getScoreColorFromThreshold,
  getScoreLabelFromValue,
  passesQualityGate,
  formatScore,
  safeScoreCalc,
  clampScore,
} from "./scoring";
export type { CheckStatus, ScoreColor, ScoreLabel } from "./scoring";

// =============================================================================
// API Response Types (FIX-19, standardized for Next.js + Express)
// =============================================================================
export type {
  ApiError,
  ApiResponse,
  PaginationMeta,
  ApiErrorCode,
  ExpressResponseHelpers,
} from "./api";
export {
  API_ERROR_CODES,
  ERROR_CODE_HTTP_STATUS,
  successResponse,
  paginatedResponse,
  errorResponse,
  validationErrorResponse,
  isSuccessResponse,
  isErrorResponse,
  getErrorMessage,
  getErrorStack,
  createExpressHelpers,
} from "./api";

// =============================================================================
// Common Types (Phase 96 Unified)
// =============================================================================
export type {
  DateRange,
  DateRangeDate,
  DateRangeFromTo,
  ComparisonPeriod,
  PaginationParams,
  CursorPaginationParams,
  CursorPaginationResult,
  FilterParams,
  SortDirection,
  SortConfig,
  RequireFields,
  OptionalFields,
  ArrayElement,
  NonEmptyArray,
  Nullable,
  Maybe,
  Branded,
  ClientId,
  WorkspaceId,
  SiteId,
  UserId,
} from "./common";
export {
  DateRangeSchema,
  ComparisonPeriodSchema,
  PaginationParamsSchema,
  CursorPaginationParamsSchema,
  FilterParamsSchema,
  encodeCursor,
  decodeCursor,
} from "./common";

// =============================================================================
// Analytics Types (Phase 96 Unified)
// =============================================================================
export type {
  ClientStatus,
  ClientMetrics,
  DashboardClient,
  SiteMetrics,
  GSCDataPoint,
  GSCSummary,
  GA4DataPoint,
  GA4Summary,
  TopQuery,
  AnalyticsData,
  DashboardFilters,
  DashboardAggregates,
  TrendType,
  ConfidenceLevel,
  TrendAnalysis,
  QueryFilter,
  TrendFilters,
  TrendResult,
  DifficultyLevel,
  StrikingDistancePage,
  StrikingDistanceFilters,
  StrikingDistanceResult,
  PortfolioSummary,
  PortfolioTrend,
  ClientPerformance,
  BrandedSplit,
  CtrComparison,
} from "./analytics";
export {
  ClientStatusSchema,
  ClientMetricsSchema,
  SiteMetricsSchema,
  GSCDataPointSchema,
  GA4DataPointSchema,
  TopQuerySchema,
  DashboardFiltersSchema,
} from "./analytics";

// =============================================================================
// Cache Types (Phase 96 Unified)
// =============================================================================
export type {
  CacheMetadata,
  CachedData,
  CacheConfig,
  AnalyticsCacheType,
  CacheOptions,
  CacheGetResult,
  CacheSetResult,
  CacheInvalidateResult,
  CacheStats,
} from "./cache";
export {
  DEFAULT_CACHE_CONFIG,
  ANALYTICS_CACHE_TTL_SECONDS,
  createFreshMetadata,
  wrapCachedData,
  unwrapCachedData,
  isCachedData,
  assertIsCachedData,
  isStale,
  isFresh,
} from "./cache";
