import type { Alert, AlertChannelHandler } from './AlertManager';

export interface SlackAlertChannelConfig {
  webhookUrl: string;
}

export class SlackAlertChannel implements AlertChannelHandler {
  private webhookUrl: string;

  constructor(config: SlackAlertChannelConfig) {
    this.webhookUrl = config.webhookUrl;
  }

  async send(alert: Alert): Promise<void> {
    const color = {
      critical: '#dc3545',
      warning: '#ffc107',
      info: '#17a2b8',
    }[alert.severity];

    const payload = {
      attachments: [
        {
          color,
          title: `[${alert.severity.toUpperCase()}] ${alert.name}`,
          text: alert.message,
          fields: [
            { title: 'Metric', value: alert.metric, short: true },
            { title: 'Value', value: String(alert.value), short: true },
            { title: 'Threshold', value: String(alert.threshold), short: true },
            { title: 'Time', value: alert.timestamp.toISOString(), short: true },
          ],
          footer: alert.runbook ? `Runbook: ${alert.runbook}` : undefined,
        },
      ],
    };

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Slack webhook failed: ${response.status} ${response.statusText}`
      );
    }
  }
}
