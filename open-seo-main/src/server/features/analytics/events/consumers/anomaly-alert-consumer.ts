/**
 * AnomalyAlertConsumer
 * Phase 96: Agency Analytics - Event Consumer Implementation (EC-002)
 *
 * Handles the 'analytics.anomaly.detected' event for proactive SEO alerting:
 * - Traffic drops > 30%
 * - Ranking losses on primary keywords
 * - Crawl errors spike
 * - Core Web Vitals degradation
 *
 * Alert severity classification:
 * - CRITICAL: Traffic drop > 50%
 * - HIGH: Ranking loss on top 10 keywords
 * - MEDIUM: CWV threshold breach
 * - LOW: Minor fluctuations
 */
import { createLogger } from '@/server/lib/logger';
import { db, alerts, alertRules } from '@/db';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { NotificationService } from '@/server/features/portal/services/NotificationService';

const log = createLogger({ module: 'anomaly-alert-consumer' });

// =============================================================================
// Types
// =============================================================================

/**
 * Anomaly types that can be detected.
 */
export type AnomalyType =
  | 'traffic_drop'
  | 'ranking_loss'
  | 'crawl_error_spike'
  | 'cwv_degradation'
  | 'impression_drop'
  | 'ctr_anomaly';

/**
 * Alert severity levels.
 */
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Payload for analytics.anomaly.detected event.
 */
export interface AnomalyDetectedEventPayload {
  siteId: string;
  clientId: string;
  workspaceId: string;
  anomalyType: AnomalyType;
  /** Affected URL or keyword */
  subject: string;
  /** Current metric value */
  currentValue: number;
  /** Previous/baseline metric value */
  previousValue: number;
  /** Percentage change (negative for drops) */
  changePercent: number;
  /** Additional context */
  metadata: {
    /** For ranking_loss: the keyword */
    keyword?: string;
    /** For ranking_loss: previous position */
    previousPosition?: number;
    /** For ranking_loss: current position */
    currentPosition?: number;
    /** For cwv_degradation: which metric */
    cwvMetric?: 'LCP' | 'FID' | 'CLS' | 'INP';
    /** For crawl_error_spike: error types */
    errorTypes?: string[];
    /** Detection period (days) */
    periodDays?: number;
    /** Confidence level */
    confidence?: 'high' | 'medium' | 'low';
  };
  timestamp: Date;
}

/**
 * Result of processing an anomaly event.
 */
export interface AnomalyProcessingResult {
  alertId: string | null;
  severity: AlertSeverity;
  notificationSent: boolean;
  batchedForDigest: boolean;
}

// =============================================================================
// Severity Classification
// =============================================================================

/**
 * Thresholds for severity classification.
 */
const SEVERITY_THRESHOLDS = {
  traffic_drop: {
    critical: -50, // 50%+ drop
    high: -40,     // 40%+ drop
    medium: -30,   // 30%+ drop
  },
  ranking_loss: {
    critical: 20,  // Lost 20+ positions
    high: 10,      // Lost 10+ positions
    medium: 5,     // Lost 5+ positions
  },
  crawl_error_spike: {
    critical: 100, // 100%+ increase
    high: 50,      // 50%+ increase
    medium: 25,    // 25%+ increase
  },
  impression_drop: {
    critical: -60, // 60%+ drop
    high: -40,     // 40%+ drop
    medium: -25,   // 25%+ drop
  },
  cwv_degradation: {
    critical: 100, // 100%+ degradation
    high: 50,      // 50%+ degradation
    medium: 25,    // 25%+ degradation
  },
  ctr_anomaly: {
    critical: -50, // 50%+ drop
    high: -30,     // 30%+ drop
    medium: -20,   // 20%+ drop
  },
} as const;

/**
 * Classify anomaly severity based on type and change percentage.
 */
export function classifyAnomalySeverity(
  anomalyType: AnomalyType,
  changePercent: number,
  metadata?: AnomalyDetectedEventPayload['metadata']
): AlertSeverity {
  const thresholds = SEVERITY_THRESHOLDS[anomalyType];

  // For ranking loss, use position delta instead of percentage
  if (anomalyType === 'ranking_loss' && metadata?.previousPosition && metadata?.currentPosition) {
    const positionDelta = metadata.currentPosition - metadata.previousPosition;
    if (positionDelta >= thresholds.critical) return 'critical';
    if (positionDelta >= thresholds.high) return 'high';
    if (positionDelta >= thresholds.medium) return 'medium';
    return 'low';
  }

  // For drops, changePercent is negative
  // For increases (errors, degradation), changePercent is positive
  const isDropMetric = ['traffic_drop', 'impression_drop', 'ctr_anomaly'].includes(anomalyType);
  const compareValue = isDropMetric ? changePercent : Math.abs(changePercent);

  if (isDropMetric) {
    // Lower (more negative) is worse
    if (compareValue <= thresholds.critical) return 'critical';
    if (compareValue <= thresholds.high) return 'high';
    if (compareValue <= thresholds.medium) return 'medium';
  } else {
    // Higher is worse
    if (compareValue >= thresholds.critical) return 'critical';
    if (compareValue >= thresholds.high) return 'high';
    if (compareValue >= thresholds.medium) return 'medium';
  }

  return 'low';
}

// =============================================================================
// Alert Creation
// =============================================================================

/**
 * Build alert title based on anomaly type.
 */
function buildAlertTitle(payload: AnomalyDetectedEventPayload): string {
  const { anomalyType, subject, changePercent, metadata } = payload;

  switch (anomalyType) {
    case 'traffic_drop':
      return `Traffic dropped ${Math.abs(changePercent).toFixed(0)}% on ${subject}`;
    case 'ranking_loss':
      if (metadata?.keyword && metadata?.currentPosition) {
        return `"${metadata.keyword}" dropped to position ${metadata.currentPosition}`;
      }
      return `Ranking loss detected for ${subject}`;
    case 'crawl_error_spike':
      return `Crawl errors increased ${changePercent.toFixed(0)}%`;
    case 'cwv_degradation':
      return `${metadata?.cwvMetric ?? 'CWV'} degraded ${changePercent.toFixed(0)}%`;
    case 'impression_drop':
      return `Impressions dropped ${Math.abs(changePercent).toFixed(0)}% on ${subject}`;
    case 'ctr_anomaly':
      return `CTR anomaly detected: ${Math.abs(changePercent).toFixed(0)}% change`;
    default:
      return `Anomaly detected: ${anomalyType}`;
  }
}

/**
 * Build alert message with details.
 */
function buildAlertMessage(payload: AnomalyDetectedEventPayload): string {
  const { anomalyType, currentValue, previousValue, changePercent, metadata } = payload;

  const parts: string[] = [];

  switch (anomalyType) {
    case 'traffic_drop':
    case 'impression_drop':
      parts.push(`Current: ${currentValue.toLocaleString()} (was ${previousValue.toLocaleString()})`);
      parts.push(`Change: ${changePercent.toFixed(1)}%`);
      break;
    case 'ranking_loss':
      if (metadata?.previousPosition && metadata?.currentPosition) {
        parts.push(`Position moved from ${metadata.previousPosition} to ${metadata.currentPosition}`);
        parts.push(`Delta: ${metadata.currentPosition - metadata.previousPosition} positions`);
      }
      break;
    case 'cwv_degradation':
      parts.push(`${metadata?.cwvMetric ?? 'Metric'}: ${currentValue}ms (was ${previousValue}ms)`);
      break;
    case 'crawl_error_spike':
      parts.push(`Error count: ${currentValue} (was ${previousValue})`);
      if (metadata?.errorTypes?.length) {
        parts.push(`Error types: ${metadata.errorTypes.join(', ')}`);
      }
      break;
    default:
      parts.push(`Value changed from ${previousValue} to ${currentValue}`);
  }

  if (metadata?.periodDays) {
    parts.push(`Detected over ${metadata.periodDays} day period`);
  }

  return parts.join('. ');
}

/**
 * Create alert record in database.
 */
async function createAlertRecord(
  payload: AnomalyDetectedEventPayload,
  severity: AlertSeverity
): Promise<string> {
  const alertId = `alert_${nanoid(12)}`;

  await db.insert(alerts).values({
    id: alertId,
    clientId: payload.clientId,
    alertType: payload.anomalyType,
    severity: severity === 'critical' ? 'critical' : severity === 'high' ? 'warning' : 'info',
    status: 'pending',
    title: buildAlertTitle(payload),
    message: buildAlertMessage(payload),
    metadata: {
      siteId: payload.siteId,
      subject: payload.subject,
      currentValue: payload.currentValue,
      previousValue: payload.previousValue,
      changePercent: payload.changePercent,
      ...payload.metadata,
      detectedAt: payload.timestamp.toISOString(),
    },
  });

  return alertId;
}

// =============================================================================
// Health Score Update
// =============================================================================

/**
 * Calculate health score impact based on anomaly severity.
 * Returns a negative number representing score reduction.
 */
export function calculateHealthScoreImpact(severity: AlertSeverity): number {
  switch (severity) {
    case 'critical':
      return -20;
    case 'high':
      return -10;
    case 'medium':
      return -5;
    case 'low':
      return -2;
    default:
      return 0;
  }
}

// =============================================================================
// Event Handler
// =============================================================================

/**
 * Handle analytics.anomaly.detected event.
 *
 * Flow:
 * 1. Classify anomaly severity (CRITICAL/HIGH/MEDIUM/LOW)
 * 2. Create alert record in database
 * 3. Trigger immediate notification for CRITICAL/HIGH
 * 4. Batch LOW/MEDIUM for daily digest
 * 5. Update client health score (TODO: implement health score service)
 */
export async function handleAnomalyDetected(
  payload: AnomalyDetectedEventPayload
): Promise<AnomalyProcessingResult> {
  const { siteId, clientId, anomalyType, changePercent, metadata, timestamp: _timestamp } = payload;

  log.info('Processing anomaly detected event', {
    siteId,
    clientId,
    anomalyType,
    changePercent,
    subject: payload.subject,
  });

  // 1. Classify severity
  const severity = classifyAnomalySeverity(anomalyType, changePercent, metadata);

  log.debug('Anomaly severity classified', {
    anomalyType,
    changePercent,
    severity,
  });

  // 2. Create alert record
  let alertId: string | null = null;
  try {
    alertId = await createAlertRecord(payload, severity);
    log.info('Alert record created', { alertId, severity });
  } catch (error) {
    log.error('Failed to create alert record', error instanceof Error ? error : undefined, {
      siteId,
      clientId,
      anomalyType,
    });
  }

  let notificationSent = false;
  let batchedForDigest = false;

  // 3. Immediate notification for CRITICAL/HIGH
  if (severity === 'critical' || severity === 'high') {
    try {
      // In-app notification
      const inAppNotif = await NotificationService.queueNotification(
        clientId,
        'alert',
        'in_app',
        {
          keyword: metadata?.keyword ?? payload.subject,
          position: metadata?.currentPosition,
          previousPosition: metadata?.previousPosition,
          portalUrl: `${process.env.APP_URL ?? 'https://app.tevero.lt'}/alerts/${alertId}`,
          dropAmount: Math.abs(changePercent),
        }
      );

      if (inAppNotif) {
        notificationSent = true;
      }

      // Email notification for critical
      if (severity === 'critical') {
        const emailNotif = await NotificationService.queueNotification(
          clientId,
          'alert',
          'email',
          {
            keyword: metadata?.keyword ?? payload.subject,
            position: metadata?.currentPosition,
            previousPosition: metadata?.previousPosition,
            portalUrl: `${process.env.APP_URL ?? 'https://app.tevero.lt'}/alerts/${alertId}`,
            dropAmount: Math.abs(changePercent),
          }
        );

        if (emailNotif) {
          notificationSent = true;
        }
      }

      // Slack notification
      const slackNotif = await NotificationService.queueNotification(
        clientId,
        'alert',
        'slack',
        {
          keyword: metadata?.keyword ?? payload.subject,
          position: metadata?.currentPosition,
          previousPosition: metadata?.previousPosition,
          portalUrl: `${process.env.APP_URL ?? 'https://app.tevero.lt'}/alerts/${alertId}`,
          dropAmount: Math.abs(changePercent),
        }
      );

      if (slackNotif) {
        notificationSent = true;
      }

      log.info('Immediate notifications sent', {
        alertId,
        severity,
        notificationSent,
      });
    } catch (error) {
      log.error('Failed to send immediate notifications', error instanceof Error ? error : undefined, {
        alertId,
        severity,
      });
    }
  } else {
    // 4. Batch LOW/MEDIUM for daily digest
    // These alerts are stored in the alerts table and will be included
    // in the daily digest email job (handled separately)
    batchedForDigest = true;
    log.debug('Alert batched for daily digest', {
      alertId,
      severity,
    });
  }

  // 5. Update client health score (placeholder)
  // TODO: Implement health score service integration
  // const healthImpact = calculateHealthScoreImpact(severity);
  // await healthScoreService.applyImpact(clientId, healthImpact);

  return {
    alertId,
    severity,
    notificationSent,
    batchedForDigest,
  };
}

/**
 * Create a bound handler for the event bus.
 */
export function createAnomalyAlertHandler(): (
  payload: AnomalyDetectedEventPayload
) => Promise<void> {
  return async (payload: AnomalyDetectedEventPayload): Promise<void> => {
    try {
      await handleAnomalyDetected(payload);
    } catch (error) {
      log.error('Anomaly alert handler failed', error instanceof Error ? error : undefined, {
        siteId: payload.siteId,
        clientId: payload.clientId,
        anomalyType: payload.anomalyType,
      });
      // Don't re-throw - event handlers should not block the event bus
    }
  };
}

/**
 * Alert rule type mapping for anomaly types.
 * Maps anomaly types to existing alert rule types in the database.
 */
type AlertRuleType = 'ranking_drop' | 'sync_failure' | 'connection_expiry';

/**
 * Check if client has alert rule configured for anomaly type.
 * Used to determine if we should process the anomaly.
 */
export async function isAlertRuleEnabled(
  clientId: string,
  anomalyType: AnomalyType
): Promise<boolean> {
  // Map anomaly types to alert rule types
  const ruleTypeMap: Record<AnomalyType, AlertRuleType> = {
    traffic_drop: 'ranking_drop', // Reuse existing rule type
    ranking_loss: 'ranking_drop',
    crawl_error_spike: 'sync_failure', // Map to sync failure rules
    cwv_degradation: 'sync_failure',
    impression_drop: 'ranking_drop',
    ctr_anomaly: 'ranking_drop',
  };

  const ruleType = ruleTypeMap[anomalyType];

  const [rule] = await db
    .select()
    .from(alertRules)
    .where(
      and(
        eq(alertRules.clientId, clientId),
        eq(alertRules.alertType, ruleType)
      )
    )
    .limit(1);

  return rule?.enabled ?? true; // Default to enabled if no rule exists
}
