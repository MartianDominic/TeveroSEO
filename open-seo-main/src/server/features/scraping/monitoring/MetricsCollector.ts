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

    // ==========================================================================
    // Circuit Breaker State Transitions
    // ==========================================================================

    this.registerMetric(
      'scraping_circuit_transitions_total',
      'counter',
      'Total circuit breaker state transitions'
    );

    this.registerMetric(
      'scraping_circuit_time_in_state_seconds',
      'counter',
      'Cumulative time spent in each circuit breaker state'
    );

    // ==========================================================================
    // Phase 95: Tier Distribution Metrics (Cost Optimization Tracking)
    // ==========================================================================

    this.registerMetric(
      'scraping_tier_usage_total',
      'counter',
      'Total requests per tier'
    );

    this.registerMetric(
      'scraping_cheap_tier_percentage',
      'gauge',
      'Percentage of requests using cheap tiers (T0-T2.5) - target 65%'
    );

    // ==========================================================================
    // Phase 95: Rate Limiter Metrics (Gap P3.G21)
    // ==========================================================================

    this.registerMetric(
      'scraping_ratelimit_wait_seconds',
      'histogram',
      'Time spent waiting for rate limit slot in seconds'
    );

    this.registerMetric(
      'scraping_ratelimit_rejections_total',
      'counter',
      'Total rate limit rejections (timeout exceeded)'
    );

    this.registerMetric(
      'scraping_ratelimit_active_domains',
      'gauge',
      'Number of domains with active rate limit state'
    );

    this.registerMetric(
      'scraping_ratelimit_backoff_multiplier',
      'gauge',
      'Current adaptive backoff multiplier by domain'
    );

    this.registerMetric(
      'scraping_ratelimit_acquires_total',
      'counter',
      'Total rate limit acquire attempts by status'
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

// =============================================================================
// Circuit Breaker Transition Metrics
// =============================================================================

/**
 * Record a circuit breaker state transition.
 * Tracks transitions for historical analysis and alerting.
 *
 * @param tier - The tier/service name (e.g., 'direct', 'webshare', 'geonode', 'dataforseo')
 * @param fromState - Previous circuit state
 * @param toState - New circuit state
 */
export function recordCircuitTransition(
  tier: string,
  fromState: 'closed' | 'half-open' | 'open',
  toState: 'closed' | 'half-open' | 'open'
): void {
  const collector = getMetricsCollector();
  collector.incrementCounter('scraping_circuit_transitions_total', {
    tier,
    from: fromState,
    to: toState,
  });
}

/**
 * Record time spent in a circuit breaker state.
 * Call this when transitioning out of a state.
 *
 * @param tier - The tier/service name
 * @param state - The state that was exited
 * @param durationSeconds - Time spent in that state
 */
export function recordCircuitTimeInState(
  tier: string,
  state: 'closed' | 'half-open' | 'open',
  durationSeconds: number
): void {
  const collector = getMetricsCollector();
  collector.addCounter('scraping_circuit_time_in_state_seconds', durationSeconds, {
    tier,
    state,
  });
}

// =============================================================================
// Phase 95: Tier Distribution Metrics (Cost Optimization Tracking)
// =============================================================================

/**
 * Cheap tiers (T0-T2.5) that count toward the 65% target.
 * These are low-cost or free options that should handle the majority of requests.
 */
const CHEAP_TIERS = ['direct', 'webshare', 'geonode', 'camoufox'] as const;

/**
 * Record tier usage and update the cheap tier percentage gauge.
 * Call this every time a tier is used for a scraping request.
 *
 * @param tier - The tier that was used (e.g., 'direct', 'webshare', 'dfs_basic')
 */
export function recordTierUsage(tier: string): void {
  const collector = getMetricsCollector();

  // Increment the counter for this specific tier
  collector.incrementCounter('scraping_tier_usage_total', { tier });

  // Recalculate cheap tier percentage
  updateCheapTierPercentage();
}

/**
 * Update the cheap tier percentage gauge based on current tier distribution.
 * Iterates through all tier counters to calculate the percentage.
 */
function updateCheapTierPercentage(): void {
  const collector = getMetricsCollector();

  // All possible tiers
  const allTiers = ['direct', 'webshare', 'geonode', 'camoufox', 'dfs_basic', 'dfs_js', 'dfs_browser'];

  // Sum up total requests and cheap tier requests
  let totalRequests = 0;
  let cheapRequests = 0;

  for (const tier of allTiers) {
    const count = collector.getCounter('scraping_tier_usage_total', { tier });
    totalRequests += count;
    if (CHEAP_TIERS.includes(tier as typeof CHEAP_TIERS[number])) {
      cheapRequests += count;
    }
  }

  // Calculate and set the percentage gauge
  const percentage = totalRequests > 0 ? (cheapRequests / totalRequests) * 100 : 0;
  collector.setGauge('scraping_cheap_tier_percentage', percentage);
}

/**
 * Get the current tier distribution statistics.
 * Useful for dashboards and cost analysis.
 *
 * @returns Object with tier counts, percentages, and target compliance
 */
export function getTierDistribution(): {
  tiers: Record<string, { count: number; percentage: number }>;
  total: number;
  cheapTierPercentage: number;
  targetMet: boolean;
  targetPercentage: number;
} {
  const collector = getMetricsCollector();
  const allTiers = ['direct', 'webshare', 'geonode', 'camoufox', 'dfs_basic', 'dfs_js', 'dfs_browser'];
  const TARGET_PERCENTAGE = 65;

  let totalRequests = 0;
  const tierCounts: Record<string, number> = {};

  // Gather counts
  for (const tier of allTiers) {
    const count = collector.getCounter('scraping_tier_usage_total', { tier });
    tierCounts[tier] = count;
    totalRequests += count;
  }

  // Calculate percentages
  const tiers: Record<string, { count: number; percentage: number }> = {};
  let cheapRequests = 0;

  for (const tier of allTiers) {
    const count = tierCounts[tier];
    const percentage = totalRequests > 0 ? (count / totalRequests) * 100 : 0;
    tiers[tier] = { count, percentage };
    if (CHEAP_TIERS.includes(tier as typeof CHEAP_TIERS[number])) {
      cheapRequests += count;
    }
  }

  const cheapTierPercentage = totalRequests > 0 ? (cheapRequests / totalRequests) * 100 : 0;

  return {
    tiers,
    total: totalRequests,
    cheapTierPercentage,
    targetMet: cheapTierPercentage >= TARGET_PERCENTAGE,
    targetPercentage: TARGET_PERCENTAGE,
  };
}

// =============================================================================
// Phase 95: Rate Limiter Metrics Helpers (Gap P3.G21)
// =============================================================================

/**
 * Rate limiter metrics interface for getMetrics() export.
 */
export interface RateLimiterMetrics {
  /** P50 wait time in milliseconds */
  waitTimeP50Ms: number;
  /** P95 wait time in milliseconds */
  waitTimeP95Ms: number;
  /** P99 wait time in milliseconds */
  waitTimeP99Ms: number;
  /** Total rejections (timeout exceeded) */
  rejections: number;
  /** Number of active domains being rate limited */
  activeDomains: number;
  /** Total successful acquires */
  successfulAcquires: number;
  /** Total acquire attempts */
  totalAttempts: number;
}

/**
 * Record a successful rate limit acquire with wait time.
 *
 * @param domain - The domain that was rate limited
 * @param waitTimeMs - Time spent waiting in milliseconds (0 if no wait)
 */
export function recordRateLimitAcquire(
  domain: string,
  waitTimeMs: number
): void {
  const collector = getMetricsCollector();

  // Record wait time histogram (convert to seconds for Prometheus convention)
  collector.recordDuration('scraping_ratelimit_wait_seconds', waitTimeMs / 1000, {
    domain,
  });

  // Increment successful acquire counter
  collector.incrementCounter('scraping_ratelimit_acquires_total', {
    status: 'success',
  });
}

/**
 * Record a rate limit rejection (timeout exceeded).
 *
 * @param domain - The domain that was rejected
 * @param waitedMs - Time spent waiting before rejection
 */
export function recordRateLimitRejection(
  domain: string,
  waitedMs: number
): void {
  const collector = getMetricsCollector();

  // Increment rejection counter
  collector.incrementCounter('scraping_ratelimit_rejections_total', {
    domain,
  });

  // Also track in acquires counter with rejection status
  collector.incrementCounter('scraping_ratelimit_acquires_total', {
    status: 'rejected',
  });

  // Record the wait time that led to rejection
  collector.recordDuration('scraping_ratelimit_wait_seconds', waitedMs / 1000, {
    domain,
    status: 'rejected',
  });
}

/**
 * Update the active domains gauge.
 * Call this periodically or after domain state changes.
 *
 * @param count - Number of domains with active rate limit state
 */
export function recordRateLimitActiveDomains(count: number): void {
  const collector = getMetricsCollector();
  collector.setGauge('scraping_ratelimit_active_domains', count);
}

/**
 * Record backoff multiplier for a domain.
 * Useful for tracking adaptive backoff behavior.
 *
 * @param domain - The domain with backoff applied
 * @param multiplier - Current backoff multiplier (1 = no backoff)
 */
export function recordRateLimitBackoff(
  domain: string,
  multiplier: number
): void {
  const collector = getMetricsCollector();
  collector.setGauge('scraping_ratelimit_backoff_multiplier', multiplier, {
    domain,
  });
}

/**
 * Get rate limiter metrics for external monitoring.
 * Returns computed percentiles and aggregate counts.
 */
export function getRateLimiterMetrics(): RateLimiterMetrics {
  const collector = getMetricsCollector();

  // Get percentiles from the wait time histogram
  const waitTimeP50Ms = collector.getPercentile('scraping_ratelimit_wait_seconds', 50) * 1000;
  const waitTimeP95Ms = collector.getPercentile('scraping_ratelimit_wait_seconds', 95) * 1000;
  const waitTimeP99Ms = collector.getPercentile('scraping_ratelimit_wait_seconds', 99) * 1000;

  // Get counters
  const successfulAcquires = collector.getCounter('scraping_ratelimit_acquires_total', {
    status: 'success',
  });
  const rejectedAcquires = collector.getCounter('scraping_ratelimit_acquires_total', {
    status: 'rejected',
  });
  const totalAttempts = successfulAcquires + rejectedAcquires;

  // Get rejections (separate counter for domain-level tracking)
  // Sum all domain-specific rejections
  const rejections = rejectedAcquires;

  // Get active domains gauge
  const activeDomains = collector.getGauge('scraping_ratelimit_active_domains');

  return {
    waitTimeP50Ms,
    waitTimeP95Ms,
    waitTimeP99Ms,
    rejections,
    activeDomains,
    successfulAcquires,
    totalAttempts,
  };
}
