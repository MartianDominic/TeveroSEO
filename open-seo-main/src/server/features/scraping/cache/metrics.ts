/**
 * Cache Metrics & Monitoring System
 * Phase 95-02: Multi-Level Caching - Task 9
 *
 * Provides:
 * - Prometheus-compatible metrics export
 * - Cache statistics aggregation
 * - Performance tracking
 * - Alert threshold definitions
 */

import type { CacheStats, LevelStats, CacheLevel, ContentType } from "./types";

// =============================================================================
// Metric Types
// =============================================================================

/**
 * Metric type for Prometheus compatibility.
 */
export type MetricType = "counter" | "gauge" | "histogram" | "summary";

/**
 * Single metric definition.
 */
export interface MetricDefinition {
  name: string;
  type: MetricType;
  help: string;
  labels?: string[];
}

/**
 * Metric value with labels.
 */
export interface MetricValue {
  labels?: Record<string, string>;
  value: number;
  timestamp?: number;
}

/**
 * Complete metric with definition and values.
 */
export interface Metric {
  definition: MetricDefinition;
  values: MetricValue[];
}

/**
 * Alert threshold configuration.
 */
export interface AlertThreshold {
  metric: string;
  operator: ">" | "<" | ">=" | "<=" | "==";
  threshold: number;
  severity: "warning" | "critical";
  description: string;
}

/**
 * Snapshot of all cache metrics at a point in time.
 */
export interface MetricSnapshot {
  timestamp: Date;
  stats: CacheStats;
  metrics: Metric[];
  alerts: AlertTriggered[];
}

/**
 * Triggered alert.
 */
export interface AlertTriggered {
  threshold: AlertThreshold;
  currentValue: number;
  triggeredAt: Date;
}

// =============================================================================
// Metric Definitions
// =============================================================================

/**
 * All metric definitions for the cache system.
 */
export const CACHE_METRICS: MetricDefinition[] = [
  // Hit/Miss counters
  {
    name: "cache_hits_total",
    type: "counter",
    help: "Total number of cache hits",
    labels: ["level"],
  },
  {
    name: "cache_misses_total",
    type: "counter",
    help: "Total number of cache misses",
    labels: ["level"],
  },

  // Hit rate gauges
  {
    name: "cache_hit_rate",
    type: "gauge",
    help: "Cache hit rate (0-1)",
    labels: ["level"],
  },
  {
    name: "cache_hit_rate_total",
    type: "gauge",
    help: "Overall cache hit rate across all levels (0-1)",
  },

  // Latency
  {
    name: "cache_latency_ms",
    type: "gauge",
    help: "Average cache lookup latency in milliseconds",
    labels: ["level"],
  },
  {
    name: "cache_latency_ms_total",
    type: "gauge",
    help: "Average cache lookup latency across all levels",
  },

  // Size/Capacity
  {
    name: "cache_size_bytes",
    type: "gauge",
    help: "Current cache size in bytes",
    labels: ["level"],
  },
  {
    name: "cache_items_total",
    type: "gauge",
    help: "Total number of items in cache",
    labels: ["level"],
  },

  // Requests
  {
    name: "cache_requests_total",
    type: "counter",
    help: "Total number of cache requests",
  },

  // Content type distribution
  {
    name: "cache_content_type_total",
    type: "counter",
    help: "Cache entries by content type",
    labels: ["content_type"],
  },

  // Compression
  {
    name: "cache_compression_ratio",
    type: "gauge",
    help: "Compression ratio (original/compressed)",
    labels: ["level", "algo"],
  },

  // Invalidation
  {
    name: "cache_invalidations_total",
    type: "counter",
    help: "Total number of cache invalidations",
    labels: ["type", "level"],
  },

  // Promotion
  {
    name: "cache_promotions_total",
    type: "counter",
    help: "Total number of cache level promotions",
    labels: ["from", "to"],
  },
];

// =============================================================================
// Default Alert Thresholds
// =============================================================================

/**
 * Default alert thresholds for cache monitoring.
 */
export const DEFAULT_ALERT_THRESHOLDS: AlertThreshold[] = [
  // Low hit rate warnings
  {
    metric: "cache_hit_rate_total",
    operator: "<",
    threshold: 0.5,
    severity: "warning",
    description: "Overall cache hit rate below 50%",
  },
  {
    metric: "cache_hit_rate_total",
    operator: "<",
    threshold: 0.3,
    severity: "critical",
    description: "Overall cache hit rate critically low (below 30%)",
  },

  // L1 specific
  {
    metric: "cache_hit_rate",
    operator: "<",
    threshold: 0.6,
    severity: "warning",
    description: "L1 cache hit rate below 60% (hot cache not effective)",
  },

  // High latency
  {
    metric: "cache_latency_ms_total",
    operator: ">",
    threshold: 50,
    severity: "warning",
    description: "Average cache latency above 50ms",
  },
  {
    metric: "cache_latency_ms_total",
    operator: ">",
    threshold: 200,
    severity: "critical",
    description: "Average cache latency above 200ms (cache may be slower than fetch)",
  },

  // L2 Redis specific
  {
    metric: "cache_latency_ms",
    operator: ">",
    threshold: 10,
    severity: "warning",
    description: "L2 Redis latency above 10ms",
  },

  // Size thresholds (L1 at 80% capacity)
  {
    metric: "cache_size_bytes",
    operator: ">",
    threshold: 80 * 1024 * 1024, // 80MB (80% of 100MB)
    severity: "warning",
    description: "L1 cache nearing capacity (80%+)",
  },
];

// =============================================================================
// Metrics Collector
// =============================================================================

/**
 * Collector for cache metrics.
 */
export class CacheMetricsCollector {
  private contentTypeCounters: Map<ContentType, number> = new Map();
  private invalidationCounters: Map<string, number> = new Map();
  private promotionCounters: Map<string, number> = new Map();
  private compressionRatios: Map<string, number[]> = new Map();
  private alertThresholds: AlertThreshold[];

  constructor(thresholds: AlertThreshold[] = DEFAULT_ALERT_THRESHOLDS) {
    this.alertThresholds = thresholds;
  }

  /**
   * Record a content type occurrence.
   */
  recordContentType(contentType: ContentType): void {
    const current = this.contentTypeCounters.get(contentType) ?? 0;
    this.contentTypeCounters.set(contentType, current + 1);
  }

  /**
   * Record a cache invalidation.
   */
  recordInvalidation(type: string, level: CacheLevel): void {
    const key = `${type}:${level}`;
    const current = this.invalidationCounters.get(key) ?? 0;
    this.invalidationCounters.set(key, current + 1);
  }

  /**
   * Record a cache level promotion.
   */
  recordPromotion(from: CacheLevel, to: CacheLevel): void {
    const key = `${from}:${to}`;
    const current = this.promotionCounters.get(key) ?? 0;
    this.promotionCounters.set(key, current + 1);
  }

  /**
   * Record compression ratio.
   */
  recordCompressionRatio(level: CacheLevel, algo: string, ratio: number): void {
    const key = `${level}:${algo}`;
    const ratios = this.compressionRatios.get(key) ?? [];
    ratios.push(ratio);
    // Keep last 1000 samples
    if (ratios.length > 1000) {
      ratios.shift();
    }
    this.compressionRatios.set(key, ratios);
  }

  /**
   * Collect all metrics from cache stats.
   */
  collect(stats: CacheStats): MetricSnapshot {
    const timestamp = new Date();
    const metrics: Metric[] = [];

    // Hit/Miss counters per level
    const levels: CacheLevel[] = ["L1", "L2", "L3", "L4"];

    for (const level of levels) {
      const levelStats = stats[level.toLowerCase() as keyof CacheStats] as LevelStats;

      // Hits
      metrics.push(createMetric(
        findDefinition("cache_hits_total"),
        [{ labels: { level }, value: levelStats.hits }]
      ));

      // Misses
      metrics.push(createMetric(
        findDefinition("cache_misses_total"),
        [{ labels: { level }, value: levelStats.misses }]
      ));

      // Hit rate
      metrics.push(createMetric(
        findDefinition("cache_hit_rate"),
        [{ labels: { level }, value: levelStats.hitRate }]
      ));

      // Latency
      metrics.push(createMetric(
        findDefinition("cache_latency_ms"),
        [{ labels: { level }, value: levelStats.avgLatencyMs }]
      ));

      // Size (if available)
      if (levelStats.sizeBytes !== undefined) {
        metrics.push(createMetric(
          findDefinition("cache_size_bytes"),
          [{ labels: { level }, value: levelStats.sizeBytes }]
        ));
      }

      // Item count (if available)
      if (levelStats.itemCount !== undefined) {
        metrics.push(createMetric(
          findDefinition("cache_items_total"),
          [{ labels: { level }, value: levelStats.itemCount }]
        ));
      }
    }

    // Total hit rate
    metrics.push(createMetric(
      findDefinition("cache_hit_rate_total"),
      [{ value: stats.totalHitRate }]
    ));

    // Total latency
    metrics.push(createMetric(
      findDefinition("cache_latency_ms_total"),
      [{ value: stats.avgLatencyMs }]
    ));

    // Total requests
    metrics.push(createMetric(
      findDefinition("cache_requests_total"),
      [{ value: stats.totalRequests }]
    ));

    // Content type distribution
    const contentTypeValues: MetricValue[] = [];
    for (const [contentType, count] of this.contentTypeCounters) {
      contentTypeValues.push({ labels: { content_type: contentType }, value: count });
    }
    if (contentTypeValues.length > 0) {
      metrics.push(createMetric(
        findDefinition("cache_content_type_total"),
        contentTypeValues
      ));
    }

    // Invalidations
    const invalidationValues: MetricValue[] = [];
    for (const [key, count] of this.invalidationCounters) {
      const [type, level] = key.split(":");
      invalidationValues.push({ labels: { type, level }, value: count });
    }
    if (invalidationValues.length > 0) {
      metrics.push(createMetric(
        findDefinition("cache_invalidations_total"),
        invalidationValues
      ));
    }

    // Promotions
    const promotionValues: MetricValue[] = [];
    for (const [key, count] of this.promotionCounters) {
      const [from, to] = key.split(":");
      promotionValues.push({ labels: { from, to }, value: count });
    }
    if (promotionValues.length > 0) {
      metrics.push(createMetric(
        findDefinition("cache_promotions_total"),
        promotionValues
      ));
    }

    // Compression ratios
    const compressionValues: MetricValue[] = [];
    for (const [key, ratios] of this.compressionRatios) {
      const [level, algo] = key.split(":");
      const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
      compressionValues.push({ labels: { level, algo }, value: avgRatio });
    }
    if (compressionValues.length > 0) {
      metrics.push(createMetric(
        findDefinition("cache_compression_ratio"),
        compressionValues
      ));
    }

    // Check alerts
    const alerts = this.checkAlerts(stats, metrics);

    return {
      timestamp,
      stats,
      metrics,
      alerts,
    };
  }

  /**
   * Check alert thresholds and return triggered alerts.
   */
  private checkAlerts(stats: CacheStats, metrics: Metric[]): AlertTriggered[] {
    const triggered: AlertTriggered[] = [];

    for (const threshold of this.alertThresholds) {
      let currentValue: number | null = null;

      // Find the metric value
      if (threshold.metric === "cache_hit_rate_total") {
        currentValue = stats.totalHitRate;
      } else if (threshold.metric === "cache_latency_ms_total") {
        currentValue = stats.avgLatencyMs;
      } else {
        // Find in metrics array
        const metric = metrics.find(m => m.definition.name === threshold.metric);
        if (metric && metric.values.length > 0) {
          // For labeled metrics, we'd need to match labels
          // For simplicity, take first value or L1 if level-specific
          const l1Value = metric.values.find(v => v.labels?.level === "L1");
          currentValue = l1Value?.value ?? metric.values[0].value;
        }
      }

      if (currentValue !== null && this.isThresholdViolated(currentValue, threshold)) {
        triggered.push({
          threshold,
          currentValue,
          triggeredAt: new Date(),
        });
      }
    }

    return triggered;
  }

  /**
   * Check if a threshold is violated.
   */
  private isThresholdViolated(value: number, threshold: AlertThreshold): boolean {
    switch (threshold.operator) {
      case ">":
        return value > threshold.threshold;
      case "<":
        return value < threshold.threshold;
      case ">=":
        return value >= threshold.threshold;
      case "<=":
        return value <= threshold.threshold;
      case "==":
        return value === threshold.threshold;
      default:
        return false;
    }
  }

  /**
   * Reset all counters.
   */
  reset(): void {
    this.contentTypeCounters.clear();
    this.invalidationCounters.clear();
    this.promotionCounters.clear();
    this.compressionRatios.clear();
  }

  /**
   * Add custom alert threshold.
   */
  addAlertThreshold(threshold: AlertThreshold): void {
    this.alertThresholds.push(threshold);
  }

  /**
   * Remove alert threshold by metric name.
   */
  removeAlertThreshold(metricName: string): void {
    this.alertThresholds = this.alertThresholds.filter(t => t.metric !== metricName);
  }

  /**
   * Get current alert thresholds.
   */
  getAlertThresholds(): AlertThreshold[] {
    return [...this.alertThresholds];
  }
}

// =============================================================================
// Prometheus Export
// =============================================================================

/**
 * Export metrics in Prometheus text format.
 */
export function exportPrometheusFormat(snapshot: MetricSnapshot): string {
  const lines: string[] = [];

  for (const metric of snapshot.metrics) {
    const { definition, values } = metric;

    // HELP line
    lines.push(`# HELP ${definition.name} ${definition.help}`);

    // TYPE line
    lines.push(`# TYPE ${definition.name} ${definition.type}`);

    // Value lines
    for (const value of values) {
      if (value.labels && Object.keys(value.labels).length > 0) {
        const labelStr = Object.entries(value.labels)
          .map(([k, v]) => `${k}="${v}"`)
          .join(",");
        lines.push(`${definition.name}{${labelStr}} ${value.value}`);
      } else {
        lines.push(`${definition.name} ${value.value}`);
      }
    }

    // Empty line between metrics
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Export metrics as JSON for custom dashboards.
 */
export function exportJsonFormat(snapshot: MetricSnapshot): object {
  return {
    timestamp: snapshot.timestamp.toISOString(),
    stats: {
      l1: snapshot.stats.l1,
      l2: snapshot.stats.l2,
      l3: snapshot.stats.l3,
      l4: snapshot.stats.l4,
      totalHitRate: snapshot.stats.totalHitRate,
      avgLatencyMs: snapshot.stats.avgLatencyMs,
      totalRequests: snapshot.stats.totalRequests,
      lastResetAt: snapshot.stats.lastResetAt.toISOString(),
    },
    alerts: snapshot.alerts.map(a => ({
      metric: a.threshold.metric,
      severity: a.threshold.severity,
      description: a.threshold.description,
      currentValue: a.currentValue,
      threshold: a.threshold.threshold,
      operator: a.threshold.operator,
      triggeredAt: a.triggeredAt.toISOString(),
    })),
  };
}

// =============================================================================
// Dashboard Queries
// =============================================================================

/**
 * Grafana/PromQL dashboard queries for cache monitoring.
 */
export const DASHBOARD_QUERIES = {
  // Overall hit rate over time
  overallHitRate: 'cache_hit_rate_total',

  // Per-level hit rates
  levelHitRates: 'cache_hit_rate{level=~"L."}',

  // Request rate
  requestRate: 'rate(cache_requests_total[5m])',

  // Hit rate by level (stacked)
  hitsByLevel: 'increase(cache_hits_total{level=~"L."}[1h])',

  // Latency percentiles (requires histogram)
  latencyP50: 'histogram_quantile(0.5, cache_latency_ms)',
  latencyP99: 'histogram_quantile(0.99, cache_latency_ms)',

  // Cache efficiency (hits vs total)
  efficiency: 'sum(cache_hits_total) / sum(cache_requests_total)',

  // Memory usage
  memoryUsage: 'cache_size_bytes{level="L1"}',

  // Invalidation rate
  invalidationRate: 'rate(cache_invalidations_total[5m])',

  // Promotion activity
  promotionRate: 'rate(cache_promotions_total[5m])',

  // Content type distribution
  contentTypeBreakdown: 'sum by(content_type) (cache_content_type_total)',

  // Cost savings estimate (assuming $0.000125/fetch avoided)
  costSavingsUsd: 'sum(cache_hits_total) * 0.000125',
} as const;

/**
 * Get a formatted query for a specific time range.
 */
export function getDashboardQuery(
  queryName: keyof typeof DASHBOARD_QUERIES,
  options?: { timeRange?: string; labels?: Record<string, string> }
): string {
  let query: string = DASHBOARD_QUERIES[queryName];

  // Add time range if applicable
  if (options?.timeRange && query.includes('[')) {
    query = query.replace(/\[\d+[mhd]\]/g, `[${options.timeRange}]`);
  }

  // Add label filters
  if (options?.labels) {
    const labelStr = Object.entries(options.labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");
    query = query.replace(/\{([^}]*)\}/, `{$1,${labelStr}}`);
  }

  return query;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Find metric definition by name.
 */
function findDefinition(name: string): MetricDefinition {
  const def = CACHE_METRICS.find(m => m.name === name);
  if (!def) {
    throw new Error(`Unknown metric: ${name}`);
  }
  return def;
}

/**
 * Create a metric with values.
 */
function createMetric(definition: MetricDefinition, values: MetricValue[]): Metric {
  return { definition, values };
}

/**
 * Calculate overall hit rate from level stats.
 */
export function calculateOverallHitRate(stats: CacheStats): number {
  const totalHits = stats.l1.hits + stats.l2.hits + stats.l3.hits + stats.l4.hits;
  const totalRequests = stats.totalRequests;

  if (totalRequests === 0) return 0;
  return totalHits / totalRequests;
}

/**
 * Calculate weighted average latency across levels.
 */
export function calculateWeightedLatency(stats: CacheStats): number {
  const levels = [stats.l1, stats.l2, stats.l3, stats.l4];
  let totalWeight = 0;
  let weightedSum = 0;

  for (const level of levels) {
    const weight = level.hits + level.misses;
    if (weight > 0) {
      weightedSum += level.avgLatencyMs * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Format bytes as human-readable string.
 */
export function formatBytes(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let value = bytes;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(2)} ${units[unitIndex]}`;
}

/**
 * Format rate as percentage string.
 */
export function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

/**
 * Format latency with appropriate precision.
 */
export function formatLatency(ms: number): string {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(0)}us`;
  } else if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else {
    return `${(ms / 1000).toFixed(2)}s`;
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a new metrics collector instance.
 */
export function createMetricsCollector(
  customThresholds?: AlertThreshold[]
): CacheMetricsCollector {
  return new CacheMetricsCollector(customThresholds ?? DEFAULT_ALERT_THRESHOLDS);
}
