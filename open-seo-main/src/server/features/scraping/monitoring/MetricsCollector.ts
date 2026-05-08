/**
 * MetricsCollector - Prometheus-compatible Metrics Collection
 * Phase 95-16: Metrics & Observability
 *
 * Provides histogram, counter, and gauge support with Prometheus text format export.
 * Supports labeled metrics with automatic key generation.
 *
 * Key metrics:
 * - scraping_request_duration_seconds (histogram) - Request latency by tier/status
 * - scraping_requests_total (counter) - Request counts by tier/status
 * - scraping_cost_usd_total (counter) - Cost by tier/client
 * - scraping_cache_hits_total (counter) - Cache hits by level
 * - scraping_circuit_state (gauge) - Circuit breaker states
 */

// =============================================================================
// Types
// =============================================================================

interface HistogramBucket {
  le: number; // Less than or equal
  count: number;
}

interface Histogram {
  buckets: HistogramBucket[];
  sum: number;
  count: number;
}

interface MetricMetadata {
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
}

// =============================================================================
// MetricsCollector
// =============================================================================

/**
 * Prometheus-compatible metrics collector with histogram, counter, and gauge support.
 */
export class MetricsCollector {
  private histograms: Map<string, Histogram> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private metadata: Map<string, MetricMetadata> = new Map();

  // Standard latency buckets (in seconds) - matches Prometheus defaults
  private static readonly LATENCY_BUCKETS = [
    0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60,
  ];

  // Cost buckets (in USD) - for tracking per-request costs
  private static readonly COST_BUCKETS = [
    0, 0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1,
  ];

  constructor() {
    this.registerDefaultMetrics();
  }

  /**
   * Register default metric definitions with help text.
   */
  private registerDefaultMetrics(): void {
    // Request duration histogram
    this.registerMetric(
      'scraping_request_duration_seconds',
      'histogram',
      'Duration of scraping requests in seconds'
    );

    // Request counters
    this.registerMetric(
      'scraping_requests_total',
      'counter',
      'Total number of scraping requests'
    );

    // Cost counter
    this.registerMetric(
      'scraping_cost_usd_total',
      'counter',
      'Total cost in USD'
    );

    // Cache hit counters
    this.registerMetric(
      'scraping_cache_hits_total',
      'counter',
      'Total cache hits by level'
    );

    // Circuit state gauge
    this.registerMetric(
      'scraping_circuit_state',
      'gauge',
      'Circuit breaker state (0=closed, 0.5=half-open, 1=open)'
    );

    // Budget gauge
    this.registerMetric(
      'scraping_dfs_budget_used_percent',
      'gauge',
      'DataForSEO daily budget utilization percentage'
    );

    // Savings counter
    this.registerMetric(
      'scraping_dfs_savings_usd',
      'counter',
      'Savings from using Standard Queue over Live'
    );

    // ==========================================================================
    // Phase 95-18: Resilience Hardening Metrics
    // ==========================================================================

    // CrUX Rate Limiter metrics
    this.registerMetric(
      'scraping_crux_requests_total',
      'counter',
      'Total CrUX API requests'
    );

    this.registerMetric(
      'scraping_crux_quota_remaining',
      'gauge',
      'Remaining CrUX API quota for today'
    );

    this.registerMetric(
      'scraping_crux_alerts_total',
      'counter',
      'Total CrUX quota alerts by level'
    );

    // Database Circuit Breaker metrics
    this.registerMetric(
      'scraping_db_circuit_state',
      'gauge',
      'Database circuit breaker state (0=closed, 0.5=half-open, 1=open)'
    );

    this.registerMetric(
      'scraping_db_health_check_status',
      'gauge',
      'Database health check status (0=unhealthy, 1=healthy)'
    );

    this.registerMetric(
      'scraping_db_health_check_duration_seconds',
      'histogram',
      'Database health check duration in seconds'
    );

    // Proxy Bandwidth Tracking metrics
    this.registerMetric(
      'scraping_proxy_bandwidth_bytes',
      'counter',
      'Total proxy bandwidth usage in bytes'
    );

    this.registerMetric(
      'scraping_proxy_bandwidth_cost_usd',
      'gauge',
      'Estimated proxy bandwidth cost in USD'
    );

    this.registerMetric(
      'scraping_proxy_bandwidth_alerts_total',
      'counter',
      'Total proxy bandwidth alerts by provider and level'
    );

    // ==========================================================================
    // Phase 95: P95 Latency Alerting (Gap P3.G20)
    // ==========================================================================

    this.registerMetric(
      'scraping_p95_latency_rolling_ms',
      'gauge',
      'Rolling P95 latency in milliseconds (last 100 requests)'
    );

    this.registerMetric(
      'scraping_p95_threshold_breach',
      'gauge',
      'P95 latency threshold breach indicator (1=above, 0=below)'
    );

    this.registerMetric(
      'scraping_p95_consecutive_breaches',
      'gauge',
      'Number of consecutive P95 threshold breaches'
    );
  }

  /**
   * Register a metric with its metadata.
   */
  registerMetric(
    name: string,
    type: 'counter' | 'gauge' | 'histogram',
    help: string
  ): void {
    this.metadata.set(name, { help, type });
  }

  /**
   * Initialize a histogram with specific buckets.
   */
  private initHistogram(name: string, buckets: number[]): void {
    this.histograms.set(name, {
      buckets: buckets.map((le) => ({ le, count: 0 })),
      sum: 0,
      count: 0,
    });
  }

  /**
   * Record a duration value in a histogram.
   *
   * @param name - Base metric name
   * @param durationSeconds - Duration in seconds
   * @param labels - Optional labels
   */
  recordDuration(
    name: string,
    durationSeconds: number,
    labels: Record<string, string> = {}
  ): void {
    const key = this.makeKey(name, labels);
    let histogram = this.histograms.get(key);

    if (!histogram) {
      this.initHistogram(key, MetricsCollector.LATENCY_BUCKETS);
      histogram = this.histograms.get(key)!;
    }

    histogram.sum += durationSeconds;
    histogram.count++;

    // Increment all buckets where value <= le
    for (const bucket of histogram.buckets) {
      if (durationSeconds <= bucket.le) {
        bucket.count++;
      }
    }
  }

  /**
   * Record a cost value in a histogram.
   *
   * @param name - Base metric name
   * @param costUsd - Cost in USD
   * @param labels - Optional labels
   */
  recordCost(
    name: string,
    costUsd: number,
    labels: Record<string, string> = {}
  ): void {
    const key = this.makeKey(name, labels);
    let histogram = this.histograms.get(key);

    if (!histogram) {
      this.initHistogram(key, MetricsCollector.COST_BUCKETS);
      histogram = this.histograms.get(key)!;
    }

    histogram.sum += costUsd;
    histogram.count++;

    for (const bucket of histogram.buckets) {
      if (costUsd <= bucket.le) {
        bucket.count++;
      }
    }
  }

  /**
   * Increment a counter.
   *
   * @param name - Metric name
   * @param labels - Optional labels
   * @param value - Increment amount (default: 1)
   */
  incrementCounter(
    name: string,
    labels: Record<string, string> = {},
    value: number = 1
  ): void {
    const key = this.makeKey(name, labels);
    this.counters.set(key, (this.counters.get(key) ?? 0) + value);
  }

  /**
   * Add to a counter (alias for incrementCounter with custom value).
   */
  addCounter(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    this.incrementCounter(name, labels, value);
  }

  /**
   * Set a gauge value.
   *
   * @param name - Metric name
   * @param value - Gauge value
   * @param labels - Optional labels
   */
  setGauge(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    const key = this.makeKey(name, labels);
    this.gauges.set(key, value);
  }

  /**
   * Get a counter value.
   */
  getCounter(name: string, labels: Record<string, string> = {}): number {
    const key = this.makeKey(name, labels);
    return this.counters.get(key) ?? 0;
  }

  /**
   * Get a gauge value.
   */
  getGauge(name: string, labels: Record<string, string> = {}): number {
    const key = this.makeKey(name, labels);
    return this.gauges.get(key) ?? 0;
  }

  /**
   * Create a unique key from metric name and labels.
   */
  private makeKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Parse key back into name and labels.
   */
  private parseKey(key: string): { name: string; labels: string } {
    const match = key.match(/^([^{]+)(\{.*\})?$/);
    if (match) {
      return {
        name: match[1],
        labels: match[2] ? match[2].slice(1, -1) : '',
      };
    }
    return { name: key, labels: '' };
  }

  /**
   * Export all metrics in Prometheus text format.
   */
  toPrometheusFormat(): string {
    const lines: string[] = [];
    const exportedNames = new Set<string>();

    // Export histograms
    for (const [key, histogram] of this.histograms) {
      const { name, labels } = this.parseKey(key);
      const baseName = name.split('{')[0];

      // Add HELP and TYPE only once per metric name
      if (!exportedNames.has(baseName)) {
        const meta = this.metadata.get(baseName);
        if (meta) {
          lines.push(`# HELP ${baseName} ${meta.help}`);
          lines.push(`# TYPE ${baseName} histogram`);
        }
        exportedNames.add(baseName);
      }

      // Export bucket values
      for (const bucket of histogram.buckets) {
        const bucketLabels = labels
          ? `${labels},le="${bucket.le}"`
          : `le="${bucket.le}"`;
        lines.push(`${baseName}_bucket{${bucketLabels}} ${bucket.count}`);
      }

      // +Inf bucket
      const infLabels = labels ? `${labels},le="+Inf"` : `le="+Inf"`;
      lines.push(`${baseName}_bucket{${infLabels}} ${histogram.count}`);

      // Sum and count
      lines.push(
        `${baseName}_sum${labels ? `{${labels}}` : ''} ${histogram.sum.toFixed(6)}`
      );
      lines.push(
        `${baseName}_count${labels ? `{${labels}}` : ''} ${histogram.count}`
      );
    }

    // Export counters
    const countersByBase = new Map<string, string[]>();
    for (const [key, value] of this.counters) {
      const { name } = this.parseKey(key);
      const baseName = name.split('{')[0];

      if (!countersByBase.has(baseName)) {
        countersByBase.set(baseName, []);
      }
      countersByBase.get(baseName)!.push(`${key} ${value.toFixed(6)}`);
    }

    for (const [baseName, metricLines] of countersByBase) {
      if (!exportedNames.has(baseName)) {
        const meta = this.metadata.get(baseName);
        if (meta) {
          lines.push(`# HELP ${baseName} ${meta.help}`);
          lines.push(`# TYPE ${baseName} ${meta.type}`);
        }
        exportedNames.add(baseName);
      }
      lines.push(...metricLines);
    }

    // Export gauges
    const gaugesByBase = new Map<string, string[]>();
    for (const [key, value] of this.gauges) {
      const { name } = this.parseKey(key);
      const baseName = name.split('{')[0];

      if (!gaugesByBase.has(baseName)) {
        gaugesByBase.set(baseName, []);
      }
      gaugesByBase.get(baseName)!.push(`${key} ${value}`);
    }

    for (const [baseName, metricLines] of gaugesByBase) {
      if (!exportedNames.has(baseName)) {
        const meta = this.metadata.get(baseName);
        if (meta) {
          lines.push(`# HELP ${baseName} ${meta.help}`);
          lines.push(`# TYPE ${baseName} ${meta.type}`);
        }
        exportedNames.add(baseName);
      }
      lines.push(...metricLines);
    }

    return lines.join('\n');
  }

  /**
   * Calculate a percentile from histogram data.
   * Uses linear interpolation within buckets.
   *
   * @param name - Metric name
   * @param percentile - Percentile to calculate (0-100)
   * @param labels - Optional labels
   */
  getPercentile(
    name: string,
    percentile: number,
    labels: Record<string, string> = {}
  ): number {
    const key = this.makeKey(name, labels);
    const histogram = this.histograms.get(key);

    if (!histogram || histogram.count === 0) {
      return 0;
    }

    const targetCount = histogram.count * (percentile / 100);
    let prevBucket = { le: 0, count: 0 };

    for (const bucket of histogram.buckets) {
      if (bucket.count >= targetCount) {
        // Linear interpolation within bucket
        const countDiff = bucket.count - prevBucket.count;
        if (countDiff === 0) {
          return bucket.le;
        }
        const fraction = (targetCount - prevBucket.count) / countDiff;
        return prevBucket.le + fraction * (bucket.le - prevBucket.le);
      }
      prevBucket = bucket;
    }

    // Return max bucket if percentile exceeds all buckets
    return histogram.buckets[histogram.buckets.length - 1].le;
  }

  /**
   * Get histogram statistics.
   */
  getHistogramStats(
    name: string,
    labels: Record<string, string> = {}
  ): { count: number; sum: number; avg: number } | null {
    const key = this.makeKey(name, labels);
    const histogram = this.histograms.get(key);

    if (!histogram) {
      return null;
    }

    return {
      count: histogram.count,
      sum: histogram.sum,
      avg: histogram.count > 0 ? histogram.sum / histogram.count : 0,
    };
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.histograms.clear();
    this.counters.clear();
    this.gauges.clear();
  }

  /**
   * Reset only counters (for periodic snapshots).
   */
  resetCounters(): void {
    this.counters.clear();
  }
}

// =============================================================================
// Singleton
// =============================================================================

let metricsCollector: MetricsCollector | null = null;

/**
 * Get the global MetricsCollector singleton.
 */
export function getMetricsCollector(): MetricsCollector {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector();
  }
  return metricsCollector;
}

/**
 * Reset the global MetricsCollector (for testing).
 */
export function resetMetricsCollector(): void {
  metricsCollector = null;
}

// =============================================================================
// Timing Utilities
// =============================================================================

/**
 * Wrap an async operation and record its duration.
 *
 * @param operation - Async function to execute
 * @param metricName - Metric name for recording
 * @param labels - Labels to attach to the metric
 * @returns Result of the operation
 */
export async function withTiming<T>(
  operation: () => Promise<T>,
  metricName: string,
  labels: Record<string, string> = {}
): Promise<T> {
  const startTime = performance.now();
  try {
    return await operation();
  } finally {
    const durationSeconds = (performance.now() - startTime) / 1000;
    getMetricsCollector().recordDuration(metricName, durationSeconds, labels);
  }
}

/**
 * Create a timer for manual duration recording.
 */
export function createTimer(): { stop: () => number } {
  const startTime = performance.now();
  return {
    stop: () => (performance.now() - startTime) / 1000,
  };
}

// =============================================================================
// Metric Recording Helpers
// =============================================================================

/**
 * Record a scraping request completion.
 */
export function recordScrapeRequest(params: {
  tier: string;
  status: 'success' | 'error';
  durationSeconds: number;
  costUsd: number;
  cached: boolean;
  cacheLevel?: string;
  clientId?: string;
}): void {
  const collector = getMetricsCollector();

  // Record duration
  collector.recordDuration('scraping_request_duration_seconds', params.durationSeconds, {
    tier: params.tier,
    status: params.status,
  });

  // Increment request counter
  collector.incrementCounter('scraping_requests_total', {
    tier: params.tier,
    status: params.status,
  });

  // Record cost (only for non-cached, successful requests)
  if (!params.cached && params.status === 'success' && params.costUsd > 0) {
    const costLabels: Record<string, string> = { tier: params.tier };
    if (params.clientId) {
      costLabels.client = params.clientId;
    }
    collector.addCounter('scraping_cost_usd_total', params.costUsd, costLabels);
  }

  // Record cache hit
  if (params.cached && params.cacheLevel) {
    collector.incrementCounter('scraping_cache_hits_total', {
      level: params.cacheLevel,
    });
  }
}

/**
 * Record circuit breaker state.
 */
export function recordCircuitState(
  tier: string,
  state: 'closed' | 'half-open' | 'open'
): void {
  const collector = getMetricsCollector();
  const stateValue = { closed: 0, 'half-open': 0.5, open: 1 }[state];
  collector.setGauge('scraping_circuit_state', stateValue, { tier });
}

/**
 * Record DFS budget usage.
 */
export function recordDfsBudgetUsage(
  usedUsd: number,
  budgetUsd: number,
  savingsUsd: number
): void {
  const collector = getMetricsCollector();
  const usedPercent = budgetUsd > 0 ? (usedUsd / budgetUsd) * 100 : 0;

  collector.setGauge('scraping_dfs_budget_used_percent', usedPercent);
  collector.addCounter('scraping_dfs_savings_usd', savingsUsd);
}

// =============================================================================
// Phase 95-18: Resilience Metrics Helpers
// =============================================================================

/**
 * Record CrUX rate limiter status.
 */
export function recordCruxQuotaStatus(
  requestsToday: number,
  quotaRemaining: number,
  dailyLimit: number
): void {
  const collector = getMetricsCollector();
  collector.setGauge('scraping_crux_quota_remaining', quotaRemaining);
  collector.setGauge('scraping_crux_usage_percent', (requestsToday / dailyLimit) * 100);
}

/**
 * Record proxy bandwidth status.
 */
export function recordProxyBandwidthStatus(
  provider: 'geonode' | 'webshare',
  usedBytes: number,
  limitBytes: number,
  estimatedCostUsd: number
): void {
  const collector = getMetricsCollector();
  collector.setGauge('scraping_proxy_bandwidth_cost_usd', estimatedCostUsd, { provider });
  collector.setGauge('scraping_proxy_bandwidth_used_percent', (usedBytes / limitBytes) * 100, { provider });
}
