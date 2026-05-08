import type { Redis } from 'ioredis';
import { SlackAlertChannel } from './SlackAlertChannel';
import { PagerDutyAlertChannel } from './PagerDutyAlertChannel';
import { alertLogger } from '../logging';

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertChannel = 'slack' | 'pagerduty' | 'email' | 'webhook';

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==';
  threshold: number;
  window?: number;
  aggregation?: 'avg' | 'max' | 'min' | 'sum' | 'count';
}

export interface AlertConfig {
  name: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  channels: AlertChannel[];
  cooldown: number;
  runbook?: string;
}

export interface Alert {
  id: string;
  name: string;
  severity: AlertSeverity;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved?: Date;
  runbook?: string;
}

export interface MetricsSnapshot {
  [key: string]: number;
}

export interface AlertChannelHandler {
  send(alert: Alert): Promise<void>;
}

/**
 * Alert thresholds for threshold-based alert methods.
 */
export interface AlertThresholds {
  /** Alert if N circuits open */
  circuitOpenCount: number;
  /** Warn if queue > N */
  queueDepthWarning: number;
  /** Critical if queue > N */
  queueDepthCritical: number;
  /** Warn if error rate > N% */
  errorRateWarning: number;
  /** Critical if error rate > N% */
  errorRateCritical: number;
  /** Warn if daily cost > $N */
  costDailyWarning: number;
  /** Critical if daily cost > $N */
  costDailyCritical: number;
  /** OBS-03: Alert if DLQ job count exceeds threshold */
  dlqCountWarning: number;
  /** OBS-03: Alert if DLQ growth exceeds percentage in 1 hour */
  dlqGrowthPercentWarning: number;
  /** OBS-04: Alert if heap memory usage exceeds percentage */
  memoryPressureWarning: number;
  /** OBS-04: Critical if heap memory usage exceeds percentage */
  memoryPressureCritical: number;
}

/**
 * Default alert thresholds.
 */
export const DEFAULT_THRESHOLDS: AlertThresholds = {
  circuitOpenCount: 2,
  queueDepthWarning: 500,
  queueDepthCritical: 1000,
  errorRateWarning: 5,
  errorRateCritical: 15,
  costDailyWarning: 40,
  costDailyCritical: 80,
  // OBS-03: DLQ growth thresholds
  dlqCountWarning: 100,
  dlqGrowthPercentWarning: 50,
  // OBS-04: Memory pressure thresholds (percentage of heap)
  memoryPressureWarning: 85,
  memoryPressureCritical: 95,
};

export interface AlertManagerConfig {
  redis?: Redis;
  runbookBaseUrl?: string;
  /** Slack webhook URL (or use SLACK_WEBHOOK_URL env var) */
  slackWebhookUrl?: string;
  /** Slack channel (or use SLACK_CHANNEL env var) */
  slackChannel?: string;
  /** PagerDuty routing key (or use PAGERDUTY_ROUTING_KEY env var) */
  pagerDutyRoutingKey?: string;
  /** Environment name (or use ALERT_ENVIRONMENT env var) */
  environment?: string;
  /** Custom thresholds */
  thresholds?: Partial<AlertThresholds>;
}

export class AlertManager {
  private alerts: Map<string, Alert> = new Map();
  private cooldowns: Map<string, number> = new Map();
  private channels: Map<AlertChannel, AlertChannelHandler> = new Map();
  private alertConfigs: Map<string, AlertConfig> = new Map();
  private runbookBaseUrl: string;
  private thresholds: AlertThresholds;
  private environment: string;
  private readonly dedupeWindowMs = 5 * 60 * 1000; // 5 minutes

  constructor(config: AlertManagerConfig = {}) {
    this.runbookBaseUrl = config.runbookBaseUrl || '';
    this.environment = config.environment || process.env.ALERT_ENVIRONMENT || process.env.NODE_ENV || 'development';
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };

    this.initializeChannels(config);
    this.registerDefaultAlerts();
  }

  /**
   * Initialize alert channels from config or environment variables.
   */
  private initializeChannels(config: AlertManagerConfig): void {
    // Slack channel
    const slackWebhookUrl = config.slackWebhookUrl || process.env.SLACK_WEBHOOK_URL;
    if (slackWebhookUrl) {
      this.channels.set('slack', new SlackAlertChannel({
        webhookUrl: slackWebhookUrl,
      }));
      alertLogger.info({ channel: 'slack' }, 'Alert channel configured');
    }

    // PagerDuty channel (for critical alerts only)
    const pagerDutyRoutingKey = config.pagerDutyRoutingKey || process.env.PAGERDUTY_ROUTING_KEY;
    if (pagerDutyRoutingKey) {
      this.channels.set('pagerduty', new PagerDutyAlertChannel({
        routingKey: pagerDutyRoutingKey,
        runbookBaseUrl: this.runbookBaseUrl,
      }));
      alertLogger.info({ channel: 'pagerduty' }, 'Alert channel configured');
    }

    if (this.channels.size === 0) {
      alertLogger.warn('No alert channels configured. Set SLACK_WEBHOOK_URL or PAGERDUTY_ROUTING_KEY');
    }
  }

  registerChannel(channel: AlertChannel, handler: AlertChannelHandler): void {
    this.channels.set(channel, handler);
  }

  registerAlert(config: AlertConfig): void {
    this.alertConfigs.set(config.name, config);
  }

  private registerDefaultAlerts(): void {
    // Cost alerts
    this.registerAlert({
      name: 'daily-cost-warning',
      condition: { metric: 'cost.daily', operator: '>', threshold: 50 },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 3600,
      runbook: '#cost-overrun',
    });

    this.registerAlert({
      name: 'daily-cost-critical',
      condition: { metric: 'cost.daily', operator: '>', threshold: 100 },
      severity: 'critical',
      channels: ['slack', 'pagerduty'],
      cooldown: 1800,
      runbook: '#cost-overrun',
    });

    // Error rate alerts
    this.registerAlert({
      name: 'error-rate-warning',
      condition: {
        metric: 'scraping.error_rate',
        operator: '>',
        threshold: 0.05,
        window: 300,
        aggregation: 'avg',
      },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 600,
      runbook: '#high-error-rate',
    });

    this.registerAlert({
      name: 'error-rate-critical',
      condition: {
        metric: 'scraping.error_rate',
        operator: '>',
        threshold: 0.15,
        window: 300,
        aggregation: 'avg',
      },
      severity: 'critical',
      channels: ['slack', 'pagerduty'],
      cooldown: 300,
      runbook: '#high-error-rate',
    });

    // Circuit breaker alerts
    this.registerAlert({
      name: 'circuit-open',
      condition: { metric: 'circuit.open_count', operator: '>', threshold: 0 },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 300,
      runbook: '#circuit-breaker-open',
    });

    // Cache health alerts
    this.registerAlert({
      name: 'cache-hit-rate-low',
      condition: {
        metric: 'cache.hit_rate',
        operator: '<',
        threshold: 0.5,
        window: 3600,
        aggregation: 'avg',
      },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 3600,
      runbook: '#low-cache-hit-rate',
    });

    // Queue health alerts
    this.registerAlert({
      name: 'queue-backlog-warning',
      condition: { metric: 'queue.waiting', operator: '>', threshold: 1000 },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 600,
      runbook: '#queue-backlog',
    });

    this.registerAlert({
      name: 'queue-backlog-critical',
      condition: { metric: 'queue.waiting', operator: '>', threshold: 5000 },
      severity: 'critical',
      channels: ['slack', 'pagerduty'],
      cooldown: 300,
      runbook: '#queue-backlog',
    });

    // DataForSEO budget alerts
    this.registerAlert({
      name: 'dfs-budget-warning',
      condition: { metric: 'dfs.budget_used_percent', operator: '>', threshold: 75 },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 3600,
      runbook: '#dfs-budget',
    });

    this.registerAlert({
      name: 'dfs-budget-critical',
      condition: { metric: 'dfs.budget_used_percent', operator: '>', threshold: 90 },
      severity: 'critical',
      channels: ['slack', 'pagerduty'],
      cooldown: 1800,
      runbook: '#dfs-budget',
    });

    // OBS-03: DLQ growth alerts
    this.registerAlert({
      name: 'dlq-count-warning',
      condition: { metric: 'dlq.job_count', operator: '>', threshold: this.thresholds.dlqCountWarning },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 3600, // 1 hour cooldown to avoid spam
      runbook: '#dlq-growth',
    });

    this.registerAlert({
      name: 'dlq-growth-warning',
      condition: {
        metric: 'dlq.growth_percent',
        operator: '>',
        threshold: this.thresholds.dlqGrowthPercentWarning,
        window: 3600, // 1 hour window
        aggregation: 'max',
      },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 3600, // 1 hour cooldown
      runbook: '#dlq-growth',
    });

    // OBS-04: Memory pressure alerts
    this.registerAlert({
      name: 'memory-pressure-warning',
      condition: { metric: 'memory.heap_used_percent', operator: '>', threshold: this.thresholds.memoryPressureWarning },
      severity: 'warning',
      channels: ['slack'],
      cooldown: 600, // 10 minute cooldown
      runbook: '#memory-pressure',
    });

    this.registerAlert({
      name: 'memory-pressure-critical',
      condition: { metric: 'memory.heap_used_percent', operator: '>', threshold: this.thresholds.memoryPressureCritical },
      severity: 'critical',
      channels: ['slack', 'pagerduty'],
      cooldown: 300, // 5 minute cooldown for critical
      runbook: '#memory-pressure',
    });
  }

  async evaluate(metrics: MetricsSnapshot): Promise<void> {
    for (const [name, config] of this.alertConfigs) {
      const value = this.extractMetricValue(metrics, config.condition);
      if (value === null) continue;

      const triggered = this.evaluateCondition(value, config.condition);

      if (triggered && this.canFire(name, config.cooldown)) {
        await this.fire({
          id: `${name}-${Date.now()}`,
          name,
          severity: config.severity,
          message: this.formatMessage(config, value),
          metric: config.condition.metric,
          value,
          threshold: config.condition.threshold,
          timestamp: new Date(),
          runbook: config.runbook,
        });
      }
    }
  }

  private extractMetricValue(
    metrics: MetricsSnapshot,
    condition: AlertCondition
  ): number | null {
    const value = metrics[condition.metric];
    if (value === undefined || value === null) return null;
    return value;
  }

  private evaluateCondition(value: number, condition: AlertCondition): boolean {
    switch (condition.operator) {
      case '>':
        return value > condition.threshold;
      case '<':
        return value < condition.threshold;
      case '>=':
        return value >= condition.threshold;
      case '<=':
        return value <= condition.threshold;
      case '==':
        return value === condition.threshold;
      default:
        return false;
    }
  }

  private canFire(name: string, cooldown: number): boolean {
    const lastFired = this.cooldowns.get(name);
    if (!lastFired) return true;

    const elapsed = Date.now() - lastFired;
    return elapsed >= cooldown * 1000;
  }

  private formatMessage(config: AlertConfig, value: number): string {
    const { condition, severity } = config;
    const direction = condition.operator === '>' || condition.operator === '>='
      ? 'exceeded'
      : 'below';

    return `[${severity.toUpperCase()}] ${config.name}: ${condition.metric} is ${direction} threshold (value: ${value.toFixed(2)}, threshold: ${condition.threshold})`;
  }

  private async fire(alert: Alert): Promise<void> {
    const config = this.alertConfigs.get(alert.name);
    if (!config) return;

    for (const channel of config.channels) {
      const handler = this.channels.get(channel);
      if (handler) {
        try {
          await handler.send(alert);
        } catch (error) {
          alertLogger.error({ channel, alertName: alert.name, error: error instanceof Error ? error.message : String(error) }, 'Failed to send alert');
        }
      }
    }

    this.alerts.set(alert.id, alert);
    this.cooldowns.set(alert.name, Date.now());

    // Log alert for observability
    alertLogger.info({ severity: alert.severity, alertName: alert.name, metric: alert.metric, value: alert.value, threshold: alert.threshold }, 'Alert fired');
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => !alert.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  resolveAlert(id: string): void {
    const alert = this.alerts.get(id);
    if (alert) {
      alert.resolved = new Date();
    }
  }

  // ===========================================================================
  // Threshold-based Alert Methods
  // ===========================================================================

  /**
   * Check circuit breaker open count and alert if threshold exceeded.
   */
  async checkCircuits(openCircuits: string[]): Promise<void> {
    if (openCircuits.length >= this.thresholds.circuitOpenCount) {
      await this.evaluate({
        'circuit.open_count': openCircuits.length,
      });
    }
  }

  /**
   * Check queue depth and alert if thresholds exceeded.
   */
  async checkQueueDepth(waiting: number): Promise<void> {
    if (waiting >= this.thresholds.queueDepthWarning) {
      await this.evaluate({
        'queue.waiting': waiting,
      });
    }
  }

  /**
   * Check error rate and alert if thresholds exceeded.
   */
  async checkErrorRate(errorRate: number): Promise<void> {
    if (errorRate >= this.thresholds.errorRateWarning) {
      await this.evaluate({
        'scraping.error_rate': errorRate / 100, // Convert to 0-1 range
      });
    }
  }

  /**
   * Check daily cost and alert if thresholds exceeded.
   */
  async checkDailyCost(costUsd: number): Promise<void> {
    if (costUsd >= this.thresholds.costDailyWarning) {
      await this.evaluate({
        'cost.daily': costUsd,
      });
    }
  }

  /**
   * Get current thresholds.
   */
  getThresholds(): AlertThresholds {
    return { ...this.thresholds };
  }

  /**
   * Update thresholds at runtime.
   */
  updateThresholds(updates: Partial<AlertThresholds>): void {
    this.thresholds = { ...this.thresholds, ...updates };
  }

  /**
   * Get configured channel names.
   */
  getConfiguredChannels(): AlertChannel[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Check if a specific channel is configured.
   */
  hasChannel(channel: AlertChannel): boolean {
    return this.channels.has(channel);
  }

  /**
   * Get environment name.
   */
  getEnvironment(): string {
    return this.environment;
  }

  // ===========================================================================
  // OBS-03: DLQ Growth Monitoring
  // ===========================================================================

  /** Previous DLQ count for growth calculation */
  private lastDlqCount: number = 0;
  private lastDlqCheckTime: number = 0;

  /**
   * Check DLQ job count and growth rate.
   * OBS-03: Alerts if count > 100 or growth > 50% in 1 hour.
   *
   * @param currentCount - Current number of jobs in DLQ
   */
  async checkDlqGrowth(currentCount: number): Promise<void> {
    const now = Date.now();
    const oneHourMs = 60 * 60 * 1000;

    // Check absolute count threshold
    if (currentCount >= this.thresholds.dlqCountWarning) {
      await this.evaluate({
        'dlq.job_count': currentCount,
      });
    }

    // Calculate growth rate if we have a previous measurement within 1-2 hours
    if (this.lastDlqCheckTime > 0) {
      const timeDiff = now - this.lastDlqCheckTime;

      // Only calculate growth if previous check was within 2 hours
      if (timeDiff <= 2 * oneHourMs && this.lastDlqCount > 0) {
        const growthPercent = ((currentCount - this.lastDlqCount) / this.lastDlqCount) * 100;

        if (growthPercent >= this.thresholds.dlqGrowthPercentWarning) {
          await this.evaluate({
            'dlq.growth_percent': growthPercent,
          });
        }
      }
    }

    // Update tracking for next check
    this.lastDlqCount = currentCount;
    this.lastDlqCheckTime = now;
  }

  // ===========================================================================
  // OBS-04: Memory Pressure Monitoring
  // ===========================================================================

  /**
   * Check heap memory pressure.
   * OBS-04: Alerts if heap usage > 85% (warning) or > 95% (critical).
   *
   * Uses process.memoryUsage() to get current heap statistics.
   */
  async checkMemoryPressure(): Promise<void> {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    // Log memory stats for observability
    alertLogger.debug({
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsedPercent: heapUsedPercent.toFixed(1),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
    }, 'Memory pressure check');

    // Only evaluate if above warning threshold
    if (heapUsedPercent >= this.thresholds.memoryPressureWarning) {
      await this.evaluate({
        'memory.heap_used_percent': heapUsedPercent,
      });
    }
  }

  /**
   * Check memory pressure with external metrics (for custom monitoring).
   *
   * @param heapUsedPercent - Heap usage as percentage (0-100)
   */
  async checkMemoryPressureWithMetrics(heapUsedPercent: number): Promise<void> {
    if (heapUsedPercent >= this.thresholds.memoryPressureWarning) {
      await this.evaluate({
        'memory.heap_used_percent': heapUsedPercent,
      });
    }
  }
}
