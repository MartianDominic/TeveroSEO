import type { Alert, AlertChannelHandler } from './AlertManager';

export interface PagerDutyAlertChannelConfig {
  routingKey: string;
  runbookBaseUrl?: string;
}

export class PagerDutyAlertChannel implements AlertChannelHandler {
  private routingKey: string;
  private runbookBaseUrl: string;

  constructor(config: PagerDutyAlertChannelConfig) {
    this.routingKey = config.routingKey;
    this.runbookBaseUrl = config.runbookBaseUrl || '';
  }

  async send(alert: Alert): Promise<void> {
    const severity = {
      critical: 'critical',
      warning: 'warning',
      info: 'info',
    }[alert.severity];

    const payload = {
      routing_key: this.routingKey,
      event_action: 'trigger',
      dedup_key: alert.name,
      payload: {
        summary: `[Scraping] ${alert.name}: ${alert.message}`,
        severity,
        source: 'scraping-service',
        timestamp: alert.timestamp.toISOString(),
        custom_details: {
          metric: alert.metric,
          value: alert.value,
          threshold: alert.threshold,
        },
      },
      links: alert.runbook
        ? [
            {
              href: `${this.runbookBaseUrl}${alert.runbook}`,
              text: 'Runbook',
            },
          ]
        : undefined,
    };

    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `PagerDuty API failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }
  }
}
