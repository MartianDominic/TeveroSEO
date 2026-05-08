/**
 * Monitoring Module Exports.
 * Phase 95: Unified Scraping Infrastructure - Plan 03, 05, 16
 */

// =============================================================================
// Alert Configuration (Plan 95-03)
// =============================================================================

export * from "./alerts.config";

// =============================================================================
// Metrics Collector (Plan 95-16)
// =============================================================================

export {
  MetricsCollector,
  getMetricsCollector,
  resetMetricsCollector,
  withTiming,
  createTimer,
  recordScrapeRequest,
  recordCircuitState,
  recordDfsBudgetUsage,
} from "./MetricsCollector";

// =============================================================================
// Trackers (Plan 95-03)
// =============================================================================

export { BlockedDomainTracker, type BlockedDomainInfo, type BlockedDomainStats, type BlockReason } from "./BlockedDomainTracker";
export { ProcessingRateTracker, type ProcessingRateStats, type GlobalProcessingStats } from "./ProcessingRateTracker";
export { QueueMonitor, type MetricsSnapshot } from "./QueueMonitor";

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
  type QueueMetrics as DashboardQueueMetrics,
  type QueueStatus,
  // Dashboard aggregates
  type DashboardSummaryCard,
  type ScrapingDashboardData,
  // Alerts
  type AlertSeverity as DashboardAlertSeverity,
  type AlertCategory,
  type ScrapingAlert,
  type AlertConfig,
  // API responses
  type DashboardResponse,
  type CostBreakdownResponse,
  type DomainLearningResponse,
  type MigrationStatusResponse,
} from "./dashboard-types";
