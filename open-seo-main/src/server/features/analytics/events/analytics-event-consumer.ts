/**
 * AnalyticsEventConsumer
 * Subscribes to analytics events and triggers downstream actions.
 *
 * Current consumers:
 * - cannibalization:detected -> Log for alerting (NotificationService integration ready)
 * - trends:analyzed -> Log for alerting (NotificationService integration ready)
 * - analytics:sync-completed -> Log for monitoring
 *
 * Future consumers can subscribe to events without modifying emitting services.
 */
import { createLogger } from '@/server/lib/logger';
import {
  getAnalyticsEventBus,
  type AnalyticsEventPayload,
} from './analytics-event-bus';

const log = createLogger({ module: 'analytics-event-consumer' });

/**
 * Unsubscribe functions returned by event subscriptions.
 */
let unsubscribers: Array<() => void> = [];

/**
 * Initialize analytics event consumers.
 * Call this once at application startup.
 */
export function initAnalyticsEventConsumers(): void {
  const eventBus = getAnalyticsEventBus();

  // Cannibalization detection consumer
  const unsubCannibalization = eventBus.on('cannibalization:detected', handleCannibalizationDetected);

  // Trends analysis consumer
  const unsubTrends = eventBus.on('trends:analyzed', handleTrendsAnalyzed);

  // Sync completion consumer
  const unsubSync = eventBus.on('analytics:sync-completed', handleSyncCompleted);

  unsubscribers = [unsubCannibalization, unsubTrends, unsubSync];

  log.info('Analytics event consumers initialized', {
    consumerCount: unsubscribers.length,
  });
}

/**
 * Shutdown analytics event consumers.
 * Call this during graceful shutdown.
 */
export function shutdownAnalyticsEventConsumers(): void {
  for (const unsubscribe of unsubscribers) {
    unsubscribe();
  }
  unsubscribers = [];
  log.info('Analytics event consumers shutdown');
}

// =============================================================================
// Event Handlers
// =============================================================================

/**
 * Handle cannibalization detection events.
 * Logs severity breakdown and could trigger alerts for critical issues.
 */
async function handleCannibalizationDetected(
  payload: AnalyticsEventPayload<'cannibalization:detected'>
): Promise<void> {
  const { siteId, issueCount, severity, timestamp } = payload;

  log.info('Cannibalization detected event received', {
    siteId,
    issueCount,
    critical: severity.critical,
    high: severity.high,
    medium: severity.medium,
    low: severity.low,
    timestamp: timestamp.toISOString(),
  });

  // Alert threshold: notify if critical or high severity issues exist
  if (severity.critical > 0 || severity.high >= 3) {
    log.warn('Cannibalization alert threshold exceeded', {
      siteId,
      criticalCount: severity.critical,
      highCount: severity.high,
    });

    // TODO: Wire to NotificationService when client context is available
    // await NotificationService.queueNotification(
    //   clientId,
    //   'alert',
    //   'in_app',
    //   {
    //     title: 'Keyword Cannibalization Detected',
    //     body: `${severity.critical} critical and ${severity.high} high severity issues found`,
    //     url: `/analytics/cannibalization?siteId=${siteId}`,
    //   }
    // );
  }
}

/**
 * Handle trends analysis events.
 * Logs trend summary and could trigger alerts for significant changes.
 */
async function handleTrendsAnalyzed(
  payload: AnalyticsEventPayload<'trends:analyzed'>
): Promise<void> {
  const { siteId, growingCount, decayingCount, stableCount, timestamp } = payload;

  log.info('Trends analyzed event received', {
    siteId,
    growingCount,
    decayingCount,
    stableCount,
    timestamp: timestamp.toISOString(),
  });

  // Alert threshold: notify if significant decay detected
  const totalAnalyzed = growingCount + decayingCount + stableCount;
  const decayRate = totalAnalyzed > 0 ? decayingCount / totalAnalyzed : 0;

  if (decayingCount >= 10 || decayRate > 0.3) {
    log.warn('Significant traffic decay detected', {
      siteId,
      decayingCount,
      decayRate: Math.round(decayRate * 100),
    });

    // TODO: Wire to NotificationService when client context is available
    // await NotificationService.queueNotification(...)
  }
}

/**
 * Handle sync completion events.
 * Logs sync metrics for monitoring.
 */
async function handleSyncCompleted(
  payload: AnalyticsEventPayload<'analytics:sync-completed'>
): Promise<void> {
  const { siteId, recordCount, startDate, endDate, timestamp } = payload;

  log.info('Analytics sync completed event received', {
    siteId,
    recordCount,
    dateRange: `${startDate} to ${endDate}`,
    timestamp: timestamp.toISOString(),
  });

  // Could emit metrics to observability platform
  // metrics.gauge('analytics.sync.records', recordCount, { siteId });
}
