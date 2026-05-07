import type { Redis } from 'ioredis';
import EventEmitter from 'events';

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

export interface AlertManagerConfig {
  redis?: Redis;
  runbookBaseUrl?: string;
}

export class AlertManager extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private cooldowns: Map<string, number> = new Map();
  private channels: Map<AlertChannel, AlertChannelHandler> = new Map();
  private alertConfigs: Map<string, AlertConfig> = new Map();
  private runbookBaseUrl: string;

  constructor(config: AlertManagerConfig = {}) {
    super();
    this.runbookBaseUrl = config.runbookBaseUrl || '';
    this.registerDefaultAlerts();
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
          console.error(`Failed to send alert to ${channel}:`, error);
        }
      }
    }

    this.alerts.set(alert.id, alert);
    this.cooldowns.set(alert.name, Date.now());

    this.emit('alert:fired', alert);
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
      this.emit('alert:resolved', alert);
    }
  }
}
