/**
 * Monitoring Dashboard Types
 * Phase 95-05: Migration & Monitoring
 *
 * Type definitions for the scraping monitoring dashboard.
 * Used by API endpoints and UI components for cost tracking and operational visibility.
 */

import type { ScrapeTier } from "@/db/domain-scrape-learning-schema";
import type { ScrapingMigrationFlags, ScrapingFeature } from "../config";
import type { CacheLevel } from "../cache";

// =============================================================================
// Cost Metrics
// =============================================================================

/**
 * Cost breakdown by tier.
 */
export interface TierCostBreakdown {
  tier: ScrapeTier;
  requests: number;
  bytesTransferred: number;
  costUsd: number;
  avgLatencyMs: number;
  successRate: number;
}

/**
 * Cost breakdown by feature.
 */
export interface FeatureCostBreakdown {
  feature: ScrapingFeature | "unknown";
  requests: number;
  costUsd: number;
  avgLatencyMs: number;
  successRate: number;
  primaryTier: ScrapeTier;
}

/**
 * Cost breakdown by client.
 */
export interface ClientCostBreakdown {
  clientId: string;
  clientName?: string;
  requests: number;
  costUsd: number;
  topDomains: Array<{
    domain: string;
    requests: number;
    costUsd: number;
  }>;
}

/**
 * Daily cost summary.
 */
export interface DailyCostSummary {
  date: string;
  totalRequests: number;
  totalCostUsd: number;
  byTier: TierCostBreakdown[];
  byFeature: FeatureCostBreakdown[];
  cacheHitRate: number;
  savingsFromCache: number;
}

/**
 * Cost trend data point.
 */
export interface CostTrendPoint {
  timestamp: string;
  costUsd: number;
  requests: number;
  cacheHitRate: number;
}

/**
 * Cost projection based on current usage.
 */
export interface CostProjection {
  currentMonthCost: number;
  projectedMonthCost: number;
  dailyAvgCost: number;
  budgetUsedPercent: number;
  daysRemaining: number;
  onTrack: boolean;
  recommendation?: string;
}

// =============================================================================
// Performance Metrics
// =============================================================================

/**
 * Latency percentiles.
 */
export interface LatencyPercentiles {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
}

/**
 * Performance metrics by tier.
 */
export interface TierPerformanceMetrics {
  tier: ScrapeTier;
  requests: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  latency: LatencyPercentiles;
  bytesPerSecond: number;
  errorTypes: Record<string, number>;
}

/**
 * Global performance summary.
 */
export interface PerformanceSummary {
  totalRequests: number;
  successRate: number;
  avgLatencyMs: number;
  latencyPercentiles: LatencyPercentiles;
  throughputPerSecond: number;
  errorRate: number;
  topErrors: Array<{
    type: string;
    count: number;
    percentage: number;
  }>;
}

// =============================================================================
// Cache Metrics
// =============================================================================

/**
 * Cache level statistics.
 */
export interface CacheLevelStats {
  level: CacheLevel;
  hitRate: number;
  hits: number;
  misses: number;
  avgLatencyMs: number;
  sizeBytes: number;
  itemCount: number;
  evictions: number;
}

/**
 * Cache efficiency metrics.
 */
export interface CacheEfficiencyMetrics {
  overallHitRate: number;
  byLevel: CacheLevelStats[];
  estimatedSavings: {
    costSavedUsd: number;
    requestsServedFromCache: number;
    bandwidthSavedBytes: number;
    timeSavedMs: number;
  };
  staleServeRate: number;
  revalidationRate: number;
}

/**
 * Cache health indicators.
 */
export interface CacheHealth {
  status: "healthy" | "degraded" | "unhealthy";
  l1Status: "ok" | "warning" | "error";
  l2Status: "ok" | "warning" | "error";
  l3Status: "ok" | "warning" | "error";
  l4Status: "ok" | "warning" | "error";
  issues: string[];
  recommendations: string[];
}

// =============================================================================
// Domain Learning Metrics
// =============================================================================

/**
 * Domain learning statistics.
 */
export interface DomainLearningStats {
  totalDomains: number;
  domainsDiscoveredToday: number;
  domainsRevalidatedToday: number;
  revalidationsPending: number;
  tierDistribution: Record<ScrapeTier, number>;
  tierDistributionPercent: Record<ScrapeTier, number>;
  predictionAccuracy: number;
  avgDiscoveryTimeMs: number;
  avgRevalidationTimeMs: number;
}

/**
 * Domain learning health.
 */
export interface DomainLearningHealth {
  status: "healthy" | "degraded" | "unhealthy";
  revalidationBacklogOk: boolean;
  predictionAccuracyOk: boolean;
  tierDistributionOk: boolean;
  issues: string[];
}

/**
 * Top domains by various metrics.
 */
export interface TopDomainsReport {
  byCost: Array<{
    domain: string;
    requests: number;
    costUsd: number;
    optimalTier: ScrapeTier;
    lastAccess: string;
  }>;
  byRequests: Array<{
    domain: string;
    requests: number;
    costUsd: number;
    optimalTier: ScrapeTier;
    lastAccess: string;
  }>;
  byFailureRate: Array<{
    domain: string;
    requests: number;
    failureRate: number;
    lastFailure: string;
  }>;
  recentlyDiscovered: Array<{
    domain: string;
    discoveredAt: string;
    optimalTier: ScrapeTier;
    technologies: string[];
  }>;
}

// =============================================================================
// Migration Metrics
// =============================================================================

/**
 * Migration status for a single feature.
 */
export interface FeatureMigrationStatus {
  feature: ScrapingFeature;
  state: ScrapingMigrationFlags[ScrapingFeature];
  requestsTotal: number;
  requestsNewImpl: number;
  requestsLegacy: number;
  newImplPercent: number;
  fallbackCount: number;
  shadowMismatches: number;
  avgLatencyNew: number;
  avgLatencyLegacy: number;
  costNew: number;
  costLegacy: number;
  costSavings: number;
}

/**
 * Overall migration progress.
 */
export interface MigrationProgress {
  overallPercent: number;
  featuresComplete: number;
  featuresTotal: number;
  byFeature: FeatureMigrationStatus[];
  totalShadowMismatches: number;
  totalFallbacks: number;
  estimatedCostSavings: number;
  migrationStartDate: string;
  estimatedCompletionDate?: string;
}

/**
 * Shadow mode comparison stats.
 */
export interface ShadowModeStats {
  totalComparisons: number;
  matches: number;
  mismatches: number;
  matchRate: number;
  avgLegacyTimeMs: number;
  avgNewTimeMs: number;
  speedupPercent: number;
  topMismatchReasons: Array<{
    reason: string;
    count: number;
  }>;
  recentMismatches: Array<{
    feature: string;
    url: string;
    timestamp: string;
    differences: string[];
  }>;
}

// =============================================================================
// Queue Metrics
// =============================================================================

/**
 * Queue health metrics.
 */
export interface QueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  processingRate: number;
  avgWaitTimeMs: number;
  avgProcessingTimeMs: number;
}

/**
 * Global queue status.
 */
export interface QueueStatus {
  healthy: boolean;
  queues: QueueMetrics[];
  totalWaiting: number;
  totalActive: number;
  globalConcurrency: number;
  maxConcurrency: number;
  utilizationPercent: number;
  blockedDomains: number;
  rateLimitedDomains: number;
}

// =============================================================================
// Dashboard Aggregates
// =============================================================================

/**
 * Dashboard summary card data.
 */
export interface DashboardSummaryCard {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  trend?: "up" | "down" | "stable";
  status?: "success" | "warning" | "error";
}

/**
 * Complete dashboard data.
 */
export interface ScrapingDashboardData {
  // Summary cards
  summary: {
    todayCost: DashboardSummaryCard;
    monthCost: DashboardSummaryCard;
    cacheHitRate: DashboardSummaryCard;
    successRate: DashboardSummaryCard;
    avgLatency: DashboardSummaryCard;
    migrationProgress: DashboardSummaryCard;
  };

  // Detailed sections
  costBreakdown: {
    today: DailyCostSummary;
    trend: CostTrendPoint[];
    projection: CostProjection;
  };

  performance: PerformanceSummary;

  cache: CacheEfficiencyMetrics & {
    health: CacheHealth;
  };

  domainLearning: DomainLearningStats & {
    health: DomainLearningHealth;
    topDomains: TopDomainsReport;
  };

  migration: MigrationProgress & {
    shadowStats: ShadowModeStats;
  };

  queues: QueueStatus;

  // Timestamp
  generatedAt: string;
  dataFreshness: "realtime" | "cached";
  cacheAge?: number;
}

// =============================================================================
// Alert Types
// =============================================================================

/**
 * Alert severity levels.
 */
export type AlertSeverity = "info" | "warning" | "critical";

/**
 * Alert categories.
 */
export type AlertCategory =
  | "cost"
  | "performance"
  | "cache"
  | "domain_learning"
  | "migration"
  | "queue";

/**
 * Active alert.
 */
export interface ScrapingAlert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  metric?: string;
  threshold?: number;
  currentValue?: number;
  triggeredAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

/**
 * Alert configuration.
 */
export interface AlertConfig {
  category: AlertCategory;
  metric: string;
  operator: ">" | "<" | ">=" | "<=" | "==" | "!=";
  threshold: number;
  severity: AlertSeverity;
  cooldownMinutes: number;
  enabled: boolean;
}

// =============================================================================
// API Response Types
// =============================================================================

/**
 * Dashboard API response.
 */
export interface DashboardResponse {
  success: boolean;
  data?: ScrapingDashboardData;
  error?: string;
}

/**
 * Cost breakdown API response.
 */
export interface CostBreakdownResponse {
  success: boolean;
  data?: {
    period: "day" | "week" | "month";
    breakdown: DailyCostSummary[];
    totals: {
      requests: number;
      costUsd: number;
      cacheHitRate: number;
    };
  };
  error?: string;
}

/**
 * Domain learning API response.
 */
export interface DomainLearningResponse {
  success: boolean;
  data?: {
    stats: DomainLearningStats;
    topDomains: TopDomainsReport;
  };
  error?: string;
}

/**
 * Migration status API response.
 */
export interface MigrationStatusResponse {
  success: boolean;
  data?: MigrationProgress;
  error?: string;
}
