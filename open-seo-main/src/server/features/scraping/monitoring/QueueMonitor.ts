/**
 * Queue Monitor for Metrics Collection.
 * Phase 95: Unified Scraping Infrastructure - Plan 03
 *
 * Collects and exposes Prometheus-compatible metrics for:
 * - Queue depth by queue and state
 * - Jobs processed by queue, status, and tier
 * - Processing time histograms
 * - Concurrency utilization
 */

import type Redis from "ioredis";
import type { QueueManager } from "../queue/QueueManager";
import type { ScrapeQueueName } from "../queue/queue.types";
import { SCRAPE_QUEUE_NAMES } from "../queue/queue.types";
import { BlockedDomainTracker } from "./BlockedDomainTracker";
import { ProcessingRateTracker } from "./ProcessingRateTracker";
import { GlobalConcurrencyLimiter } from "../ratelimit/GlobalConcurrencyLimiter";
import { ALERT_THRESHOLDS, getSeverity, type Alert, type AlertSeverity } from "./alerts.config";
import { queueLogger } from "../logging";

/**
 * Collected metrics snapshot.
 */
export interface MetricsSnapshot {
  /** Timestamp when metrics were collected */
  timestamp: number;

  /** Queue depth by queue and state */
  queueDepth: Record<ScrapeQueueName, {
    waiting: number;
    active: number;
    delayed: number;
    paused: boolean;
  }>;

  /** Jobs processed counts */
  jobsProcessed: {
    completed: number;
    failed: number;
    total: number;
  };

  /** Processing rates */
  processingRate: {
    perSecond: number;
    perMinute: number;
  };

  /** Processing time statistics */
  processingTime: {
    avg: number;
    p50: number;
    p90: number;
    p95: number;
    p99: number;
  };

  /** Concurrency utilization */
  concurrency: {
    current: number;
    max: number;
    utilization: number;
  };

  /** Blocked domains count */
  blockedDomains: {
    total: number;
    byReason: Record<string, number>;
  };

  /** Active alerts */
  alerts: Alert[];
}

/**
 * Monitor for collecting queue metrics.
 */
export class QueueMonitor {
  private readonly queueManager: QueueManager;
  private readonly redis: Redis;
  private readonly blockedDomainTracker: BlockedDomainTracker;
  private readonly processingRateTracker: ProcessingRateTracker;
  private readonly concurrencyLimiter: GlobalConcurrencyLimiter;

  private collectInterval?: NodeJS.Timeout;
  private lastSnapshot?: MetricsSnapshot;

  constructor(
    queueManager: QueueManager,
    redis: Redis,
    maxConcurrency: number = 200
  ) {
    this.queueManager = queueManager;
    this.redis = redis;
    this.blockedDomainTracker = new BlockedDomainTracker(redis);
    this.processingRateTracker = new ProcessingRateTracker(redis);
    this.concurrencyLimiter = new GlobalConcurrencyLimiter(redis, { maxConcurrent: maxConcurrency });
  }

  /**
   * Start periodic metrics collection.
   *
   * @param intervalMs - Collection interval in ms (default: 15000)
   */
  startCollection(intervalMs: number = 15_000): void {
    if (this.collectInterval) {
      return; // Already running
    }

    // Collect immediately
    void this.collectMetrics();

    // Then collect periodically
    this.collectInterval = setInterval(() => {
      void this.collectMetrics();
    }, intervalMs);

    queueLogger.info({ intervalMs }, 'Queue monitor started metrics collection');
  }

  /**
   * Stop metrics collection.
   */
  stopCollection(): void {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
      this.collectInterval = undefined;
      queueLogger.info('Queue monitor stopped metrics collection');
    }
  }

  /**
   * Collect all metrics.
   */
  async collectMetrics(): Promise<MetricsSnapshot> {
    const timestamp = Date.now();

    const [
      queueMetrics,
      processingStats,
      percentiles,
      concurrencyLoad,
      blockedStats,
    ] = await Promise.all([
      this.queueManager.getQueueMetrics(),
      this.processingRateTracker.getGlobalStats(),
      this.processingRateTracker.getProcessingTimePercentiles(),
      this.concurrencyLimiter.getCurrentLoad(),
      this.blockedDomainTracker.getStats(),
    ]);

    // Build queue depth metrics
    const queueDepth: MetricsSnapshot["queueDepth"] = {
      [SCRAPE_QUEUE_NAMES.PRIORITY]: {
        waiting: queueMetrics.queues[SCRAPE_QUEUE_NAMES.PRIORITY].waiting,
        active: queueMetrics.queues[SCRAPE_QUEUE_NAMES.PRIORITY].active,
        delayed: queueMetrics.queues[SCRAPE_QUEUE_NAMES.PRIORITY].delayed,
        paused: queueMetrics.queues[SCRAPE_QUEUE_NAMES.PRIORITY].paused,
      },
      [SCRAPE_QUEUE_NAMES.STANDARD]: {
        waiting: queueMetrics.queues[SCRAPE_QUEUE_NAMES.STANDARD].waiting,
        active: queueMetrics.queues[SCRAPE_QUEUE_NAMES.STANDARD].active,
        delayed: queueMetrics.queues[SCRAPE_QUEUE_NAMES.STANDARD].delayed,
        paused: queueMetrics.queues[SCRAPE_QUEUE_NAMES.STANDARD].paused,
      },
      [SCRAPE_QUEUE_NAMES.BACKGROUND]: {
        waiting: queueMetrics.queues[SCRAPE_QUEUE_NAMES.BACKGROUND].waiting,
        active: queueMetrics.queues[SCRAPE_QUEUE_NAMES.BACKGROUND].active,
        delayed: queueMetrics.queues[SCRAPE_QUEUE_NAMES.BACKGROUND].delayed,
        paused: queueMetrics.queues[SCRAPE_QUEUE_NAMES.BACKGROUND].paused,
      },
    };

    // Calculate totals
    let totalCompleted = 0;
    let totalFailed = 0;

    for (const queueName of Object.values(SCRAPE_QUEUE_NAMES)) {
      totalCompleted += queueMetrics.queues[queueName].completed;
      totalFailed += queueMetrics.queues[queueName].failed;
    }

    // Generate alerts
    const alerts = this.generateAlerts(queueDepth, processingStats, concurrencyLoad, blockedStats);

    const snapshot: MetricsSnapshot = {
      timestamp,
      queueDepth,
      jobsProcessed: {
        completed: totalCompleted,
        failed: totalFailed,
        total: totalCompleted + totalFailed,
      },
      processingRate: {
        perSecond: processingStats.total.ratePerSecond,
        perMinute: processingStats.total.ratePerMinute,
      },
      processingTime: {
        avg: processingStats.avgProcessingTimeMs,
        p50: percentiles.p50,
        p90: percentiles.p90,
        p95: percentiles.p95,
        p99: percentiles.p99,
      },
      concurrency: {
        current: concurrencyLoad.current,
        max: concurrencyLoad.max,
        utilization: concurrencyLoad.utilization,
      },
      blockedDomains: {
        total: blockedStats.total,
        byReason: blockedStats.byReason,
      },
      alerts,
    };

    this.lastSnapshot = snapshot;
    return snapshot;
  }

  /**
   * Get the last collected metrics snapshot.
   */
  getLastSnapshot(): MetricsSnapshot | undefined {
    return this.lastSnapshot;
  }

  /**
   * Record a job completion (for processing rate tracking).
   */
  async recordCompletion(queue: ScrapeQueueName, processingTimeMs: number): Promise<void> {
    await this.processingRateTracker.recordCompletion(queue, processingTimeMs);
  }

  /**
   * Get the blocked domain tracker.
   */
  getBlockedDomainTracker(): BlockedDomainTracker {
    return this.blockedDomainTracker;
  }

  /**
   * Get the processing rate tracker.
   */
  getProcessingRateTracker(): ProcessingRateTracker {
    return this.processingRateTracker;
  }

  /**
   * Generate alerts based on current metrics.
   */
  private generateAlerts(
    queueDepth: MetricsSnapshot["queueDepth"],
    processingStats: { total: { ratePerSecond: number } },
    concurrencyLoad: { utilization: number },
    blockedStats: { total: number }
  ): Alert[] {
    const alerts: Alert[] = [];
    const timestamp = Date.now();

    // Queue depth alerts
    const priorityWaiting = queueDepth[SCRAPE_QUEUE_NAMES.PRIORITY].waiting;
    const prioritySeverity = getSeverity(priorityWaiting, ALERT_THRESHOLDS.queueDepth.priority);
    if (prioritySeverity !== "info") {
      alerts.push({
        id: `queue-depth-priority-${timestamp}`,
        severity: prioritySeverity,
        category: "queue",
        message: `Priority queue depth ${prioritySeverity === "critical" ? "critically high" : "elevated"}: ${priorityWaiting} jobs waiting`,
        value: priorityWaiting,
        threshold: ALERT_THRESHOLDS.queueDepth.priority[prioritySeverity === "critical" ? "critical" : "warning"],
        timestamp,
      });
    }

    const standardWaiting = queueDepth[SCRAPE_QUEUE_NAMES.STANDARD].waiting;
    const standardSeverity = getSeverity(standardWaiting, ALERT_THRESHOLDS.queueDepth.standard);
    if (standardSeverity !== "info") {
      alerts.push({
        id: `queue-depth-standard-${timestamp}`,
        severity: standardSeverity,
        category: "queue",
        message: `Standard queue depth ${standardSeverity === "critical" ? "critically high" : "elevated"}: ${standardWaiting} jobs waiting`,
        value: standardWaiting,
        threshold: ALERT_THRESHOLDS.queueDepth.standard[standardSeverity === "critical" ? "critical" : "warning"],
        timestamp,
      });
    }

    // Blocked domains alert
    const blockedSeverity = getSeverity(blockedStats.total, ALERT_THRESHOLDS.blockedDomains);
    if (blockedSeverity !== "info") {
      alerts.push({
        id: `blocked-domains-${timestamp}`,
        severity: blockedSeverity,
        category: "domains",
        message: `${blockedStats.total} domains currently blocked - possible IP reputation issue`,
        value: blockedStats.total,
        threshold: ALERT_THRESHOLDS.blockedDomains[blockedSeverity === "critical" ? "critical" : "warning"],
        timestamp,
      });
    }

    // High concurrency alert
    if (concurrencyLoad.utilization >= ALERT_THRESHOLDS.concurrency.highUtilization) {
      alerts.push({
        id: `concurrency-high-${timestamp}`,
        severity: "warning",
        category: "concurrency",
        message: `High concurrency utilization: ${(concurrencyLoad.utilization * 100).toFixed(1)}%`,
        value: concurrencyLoad.utilization,
        threshold: ALERT_THRESHOLDS.concurrency.highUtilization,
        timestamp,
      });
    }

    // Low processing rate when queue is backed up
    const totalWaiting = priorityWaiting + standardWaiting;
    if (totalWaiting > 100 && processingStats.total.ratePerSecond < ALERT_THRESHOLDS.processingRate.tooSlow) {
      alerts.push({
        id: `processing-rate-slow-${timestamp}`,
        severity: "warning",
        category: "rate",
        message: `Processing rate too slow: ${processingStats.total.ratePerSecond.toFixed(2)} jobs/sec with ${totalWaiting} jobs waiting`,
        value: processingStats.total.ratePerSecond,
        threshold: ALERT_THRESHOLDS.processingRate.tooSlow,
        timestamp,
      });
    }

    return alerts;
  }

  /**
   * Export metrics in Prometheus format.
   */
  toPrometheusFormat(): string {
    if (!this.lastSnapshot) {
      return "# No metrics collected yet\n";
    }

    const lines: string[] = [];
    const s = this.lastSnapshot;

    // Queue depth gauges
    lines.push("# HELP scrape_queue_depth Number of jobs in queue");
    lines.push("# TYPE scrape_queue_depth gauge");
    for (const [queueName, stats] of Object.entries(s.queueDepth)) {
      lines.push(`scrape_queue_depth{queue="${queueName}",state="waiting"} ${stats.waiting}`);
      lines.push(`scrape_queue_depth{queue="${queueName}",state="active"} ${stats.active}`);
      lines.push(`scrape_queue_depth{queue="${queueName}",state="delayed"} ${stats.delayed}`);
    }

    // Jobs processed counter
    lines.push("# HELP scrape_jobs_processed_total Total number of jobs processed");
    lines.push("# TYPE scrape_jobs_processed_total counter");
    lines.push(`scrape_jobs_processed_total{status="completed"} ${s.jobsProcessed.completed}`);
    lines.push(`scrape_jobs_processed_total{status="failed"} ${s.jobsProcessed.failed}`);

    // Processing time histogram summary
    lines.push("# HELP scrape_job_processing_seconds Job processing time in seconds");
    lines.push("# TYPE scrape_job_processing_seconds summary");
    lines.push(`scrape_job_processing_seconds{quantile="0.5"} ${s.processingTime.p50 / 1000}`);
    lines.push(`scrape_job_processing_seconds{quantile="0.9"} ${s.processingTime.p90 / 1000}`);
    lines.push(`scrape_job_processing_seconds{quantile="0.95"} ${s.processingTime.p95 / 1000}`);
    lines.push(`scrape_job_processing_seconds{quantile="0.99"} ${s.processingTime.p99 / 1000}`);

    // Concurrency gauge
    lines.push("# HELP scrape_concurrency_utilization Current concurrency utilization (0-1)");
    lines.push("# TYPE scrape_concurrency_utilization gauge");
    lines.push(`scrape_concurrency_utilization ${s.concurrency.utilization.toFixed(4)}`);

    // Blocked domains gauge
    lines.push("# HELP scrape_blocked_domains Number of blocked domains");
    lines.push("# TYPE scrape_blocked_domains gauge");
    lines.push(`scrape_blocked_domains ${s.blockedDomains.total}`);

    return lines.join("\n") + "\n";
  }
}
