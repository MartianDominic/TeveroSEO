/**
 * Unified Scraping Infrastructure
 * Phase 95: TieredFetcher + Domain Learning System
 *
 * Cost-optimized tiered scraping with per-domain learning.
 * Target: 60%+ free tiers, 90%+ cost reduction vs all-DFS.
 */

// =============================================================================
// Main Entry Point - ScrapingService (Plan 95-05)
// =============================================================================

export {
  ScrapingService,
  scrapingService,
  createScrapingService,
  type ScrapeOptions,
  type ScrapeResult,
  type ParsedPageData,
  type BatchScrapeOptions,
  type BatchScrapeResult,
  type CrawlOptions,
  type ScrapingMetrics,
  type CostReport,
} from "./ScrapingService";

// =============================================================================
// TieredFetcher (Plan 95-01)
// =============================================================================

export {
  TieredFetcher,
  tieredFetcher,
  createTieredFetcher,
  type FetchOptions,
  type FetchResult,
} from "./TieredFetcher";

// =============================================================================
// Schema and Types
// =============================================================================

export {
  // Tables
  domainScrapeConfigs,
  domainScrapeHistory,
  domainScrapeConfigsRelations,
  domainScrapeHistoryRelations,
  // Constants
  SCRAPE_TIERS,
  TIER_COSTS,
  TIER_INDEX,
  ESCALATION_REASONS,
  DETECTED_TECHNOLOGIES,
  REVALIDATION_INTERVALS,
  DOMAIN_CONFIG_CACHE_TTL_SECONDS,
  // Types
  type ScrapeTier,
  type EscalationReason,
  type DetectedTechnology,
  type GeoRequirement,
  type DiscoveryAttempt,
  type DomainScrapeConfigSelect,
  type DomainScrapeConfigInsert,
  type DomainScrapeHistorySelect,
  type DomainScrapeHistoryInsert,
} from "@/db/domain-scrape-learning-schema";

// Service types
export type {
  TieredFetchRequest,
  TieredFetchResult,
  ContentValidation,
  DomainConfig,
  DomainConfigUpdate,
  DiscoveryRequest,
  DiscoveryResult,
  RevalidationCandidate,
  RevalidationResult,
  CrawlCostSummary,
  DailyCostReport,
  IDomainLearningService,
} from "./types";

// =============================================================================
// Domain Learning Service
// =============================================================================

export {
  DomainLearningService,
  domainLearningService,
  normalizeDomain,
  getNextTier,
  calculateCost,
} from "./DomainLearningService";

// =============================================================================
// Content Quality Assessment
// =============================================================================

export {
  ContentQualityAssessor,
  contentQualityAssessor,
  type QualityAssessment,
  type QualityMetrics,
} from "./ContentQualityAssessor";

// =============================================================================
// Fetchers (Individual Tier Implementations)
// =============================================================================

export {
  // Types
  type FetchResult as TierFetchResult,
  type BaseFetchOptions,
  type GeoTargetingOptions,
  type SessionOptions,
  type ConnectionTestResult,
  TIER_TO_NUMBER,
  NUMBER_TO_TIER,
  // T0: Direct
  DirectFetcher,
  getDirectFetcher,
  // T1: Webshare
  WebshareFetcher,
  getWebshareFetcher,
  // T2: Geonode
  GeonodeFetcher,
  getGeonodeFetcher,
  // T2.5: Camoufox
  CamoufoxFetcher,
  getCamoufoxFetcher,
  // T3-T5: DataForSEO
  DataForSEOFetcher,
  getDataForSEOFetcher,
} from "./fetchers";

// =============================================================================
// Cron Jobs
// =============================================================================

export {
  RevalidationCronJob,
  HistoryCleanupJob,
  revalidationCronJob,
  historyCleanupJob,
  startDomainLearningJobs,
  stopDomainLearningJobs,
  type RevalidationJobConfig,
  type RevalidationRunStats,
} from "./RevalidationCronJob";

// =============================================================================
// Migration Utilities
// =============================================================================

export {
  // Adapters for backward compatibility
  TieredCrawlerAdapter,
  UniversalCrawlerAdapter,
  // Drop-in replacement functions
  fetchPageWithTiered,
  crawlUrlWithTiered,
  // Compatibility types
  type HybridCrawlResult,
  type HybridCrawlOptions,
  type UniversalCrawlResult,
  type UniversalCrawlOptions,
  type PageData,
} from "./migration";

// =============================================================================
// Rate Limiting (Plan 95-03)
// =============================================================================

export {
  RateLimiter,
  RateLimitExceededError,
  AdaptiveBackoff,
  GlobalConcurrencyLimiter,
  type BackoffState,
  type AdaptiveBackoffConfig,
  type AcquireResult,
  type LoadStats,
  type GlobalConcurrencyConfig,
} from "./ratelimit";

// =============================================================================
// Queue Management (Plan 95-03)
// =============================================================================

export {
  // Queue Manager
  QueueManager,
  getQueueManager,
  QueueOrchestrator,
  // Types
  type ScrapeJobData,
  type ScrapeJobResult,
  type ScrapeJobInput,
  type ScrapeJobBaseInput,
  type EnqueueResult,
  type JobStatus,
  type BatchStatus,
  type QueueMetrics,
  type ScrapeQueueName,
  type JobPriority,
  type JobSource,
  type ScrapeErrorCode,
  type JobState,
  type QueueStats,
  type GlobalMetrics,
  // Constants
  SCRAPE_QUEUE_NAMES,
  QUEUE_CONFIG,
  // Priority
  assignPriority,
  selectQueue,
  toBullMQPriority,
  fromBullMQPriority,
  getPrioritySLA,
  getPriorityDescription,
  BULLMQ_PRIORITY_VALUES,
  // Retry config
  getRetryPolicy,
  calculateDelay,
  shouldEscalateTier,
  isPermanentError,
  DEFAULT_RETRY_CONFIG,
  ERROR_RETRY_POLICIES,
} from "./queue";

// =============================================================================
// Workers (Plan 95-03)
// =============================================================================

export {
  createScrapeWorker,
  createAllScrapeWorkers,
  type ScrapeWorkerConfig,
} from "./workers";

// =============================================================================
// Monitoring (Plan 95-03, 95-16)
// =============================================================================

export {
  // Alert configuration
  ALERT_THRESHOLDS,
  getSeverity,
  isWarning,
  isCritical,
  type Alert,
  type AlertSeverity,
  // Trackers
  BlockedDomainTracker,
  ProcessingRateTracker,
  QueueMonitor,
  type BlockedDomainInfo,
  type BlockedDomainStats,
  type BlockReason,
  type ProcessingRateStats,
  type GlobalProcessingStats,
  type MetricsSnapshot,
  // Metrics collector (Plan 95-16)
  MetricsCollector,
  getMetricsCollector,
  resetMetricsCollector,
  withTiming,
  createTimer,
  recordScrapeRequest,
  recordCircuitState,
  recordDfsBudgetUsage,
} from "./monitoring";

// =============================================================================
// Structured Logging (Plan 95-16)
// =============================================================================

export {
  // Main logger
  logger,
  // Component loggers
  fetcherLogger,
  cacheLogger,
  queueLogger,
  costLogger,
  domainLogger,
  alertLogger,
  migrationLogger,
  circuitLogger,
  // Correlation ID utilities
  generateCorrelationId,
  getCorrelationId,
  getRequestContext,
  withCorrelationId,
  withRequestContext,
  withRequestContextAsync,
  // Middleware
  correlationMiddleware,
  // Job context
  createJobContext,
  withJobContext,
  // Logging helpers
  logScrapeStart,
  logScrapeComplete,
  logScrapeError,
  logTierEscalation,
  logCacheOperation,
  logCircuitStateChange,
  logCostRecord,
  logQueueOperation,
} from "./logging";

// =============================================================================
// Interfaces (Plan 95-03)
// =============================================================================

export type {
  IRateLimiter,
  RateLimitStatus,
  RateLimiterConfig,
  IQueueManager,
} from "./interfaces";

// =============================================================================
// Feature Flags & Configuration (Plan 95-05)
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
  // Flag loading
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
} from "./config";

// =============================================================================
// Migration Router & Shadow Mode (Plan 95-05)
// =============================================================================

export {
  // Shadow mode
  runShadow,
  runShadowAsync,
  logShadowComparison,
  getShadowComparisonLogs,
  getShadowStats,
  clearShadowLogs,
  type ShadowComparison,
  type ShadowResult,
  type ShadowComparisonLog,
  type CompareFunction,
  // Comparators
  compareSingleScrape,
  compareParsedData,
  compareProspectScrape,
  compareSerpContent,
  compareBatchResults,
  type MultiPageScrapeResult,
  type SerpContentAnalysis,
  type ComparisonResult,
  // Migration router
  routeRequest,
  routeBatchRequest,
  featureShouldUseUnified,
  getFeatureMigrationState,
  getMigrationSummary,
  type LegacyScraperFn,
  type ResultTransformer,
  type RouteOptions,
  type BatchRouteOptions,
  // Migration rollout (Plan 95-13)
  MigrationRollout,
  getMigrationRollout,
  createMigrationRollout,
  type RolloutCriteria,
  type RolloutMetrics,
  type RolloutReadinessCheck,
  type AdvanceResult,
  type RollbackResult,
  type RolloutStatus,
} from "./migration";

// =============================================================================
// Dashboard Types (Plan 95-05)
// =============================================================================

export {
  // Cost metrics
  type TierCostBreakdown,
  type FeatureCostBreakdown,
  type ClientCostBreakdown,
  type DailyCostSummary,
  type CostTrendPoint,
  type CostProjection,
  // Performance metrics
  type LatencyPercentiles,
  type TierPerformanceMetrics,
  type PerformanceSummary,
  // Cache metrics
  type CacheLevelStats,
  type CacheEfficiencyMetrics,
  type CacheHealth,
  // Domain learning metrics
  type DomainLearningStats,
  type DomainLearningHealth,
  type TopDomainsReport,
  // Migration metrics
  type FeatureMigrationStatus,
  type MigrationProgress,
  type ShadowModeStats,
  // Queue metrics
  type DashboardQueueMetrics,
  type QueueStatus,
  // Dashboard aggregates
  type DashboardSummaryCard,
  type ScrapingDashboardData,
  // Alerts
  type DashboardAlertSeverity,
  type AlertCategory,
  type ScrapingAlert,
  type AlertConfig,
  // API responses
  type DashboardResponse,
  type CostBreakdownResponse,
  type DomainLearningResponse,
  type MigrationStatusResponse,
} from "./monitoring";

// =============================================================================
// Domain Feedback Service (Plan 95-13)
// =============================================================================

export {
  DomainFeedbackService,
  getDomainFeedbackService,
  setFeedbackServiceDependencies,
  createDomainFeedbackService,
  createCheckRunnerIntegration,
  type CheckFeedback,
  type DomainFeedbackOptions,
  type CheckCompleteHandler,
} from "./DomainFeedback";

// =============================================================================
// Admin Routes (Plan 95-13)
// =============================================================================

export {
  createAdminRoutes,
  getAdminRoutes,
  initAdminRoutes,
  type AdminRouteDependencies,
  type MigrationStatusResponse as AdminMigrationStatusResponse,
  type ReadinessResponse,
  type CacheWarmRequest,
  type FeedbackStatusResponse,
} from "./routes/admin";

// =============================================================================
// Internal API Routes (AI-Writer HTTP Bridge)
// =============================================================================

export {
  createInternalRoutes,
  getInternalRoutes,
  initInternalRoutes,
  type InternalScrapeResponse,
  type InternalBatchScrapeResponse,
} from "./routes/internal";

// =============================================================================
// Health Routes
// =============================================================================

export {
  createHealthRoutes,
  type StatusResult,
} from "./routes/health";

// =============================================================================
// Middleware (Plan 95-14)
// =============================================================================

export {
  createAdminAuthMiddleware,
  requireAdminAuth,
  type AdminAuthConfig,
  type AdminContext,
  type AdminRequest,
} from "./middleware";

// =============================================================================
// Audit Logging (Plan 95-14)
// =============================================================================

export {
  AuditLogger,
  getAuditLogger,
  shutdownAuditLogger,
  createAuditContext,
  withAuditLog,
  type AuditEntry,
  type AuditTarget,
} from "./monitoring";

// =============================================================================
// Centralized DFS Pricing (COST-2)
// =============================================================================

export {
  // Main pricing constants
  DFS_PRICING,
  DFS_ONPAGE_PRICING,
  DFS_SERP_PRICING,
  DFS_LABS_PRICING,
  DFS_BACKLINKS_PRICING,
  // Helper functions
  getOnPageCost,
  getSerpCost,
  getLabsCost,
  getBacklinksCost,
  estimateOnPageBatchCost,
  estimateSerpBatchCost,
  estimateKeywordMetricsCost,
  // Legacy compatibility exports
  DFS_STANDARD_COSTS,
  DFS_LIVE_COSTS,
  DFS_API_COSTS,
  // Types
  type DfsOnPageMode,
  type DfsQueueType,
  type DfsLabsOperation,
  type DfsBacklinksOperation,
} from "./cost";

// =============================================================================
// Budget Pre-Check Wrapper (COST-1)
// =============================================================================

export {
  withBudgetCheck,
  checkBudgetAvailable,
  estimateBatchCost,
  BudgetExceededError,
  type BudgetCheckOptions,
} from "./providers/withBudgetCheck";

// =============================================================================
// Budget Monitor (Plan 95-04)
// =============================================================================

export {
  DfsBudgetMonitor,
  getDfsBudgetMonitor,
  resetDfsBudgetMonitor,
  runBudgetCheck,
  type BudgetConfig,
  type BudgetAlert,
} from "./providers/DfsBudgetMonitor";

// =============================================================================
// Cost Tracker (Plan 95-04)
// =============================================================================

export {
  DfsCostTracker,
  getDfsCostTracker,
  resetDfsCostTracker,
  extractDomainFromUrl,
} from "./providers/DfsCostTracker";

// =============================================================================
// TextFetcher - Lightweight fetcher for text/XML files (SEO-01)
// =============================================================================

export {
  TextFetcher,
  textFetcher,
  createTextFetcher,
  type TextFileType,
  type TextFetchOptions,
  type TextFetchResult,
} from "./TextFetcher";
