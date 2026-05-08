/**
 * AnalyticsEventConsumer
 * Subscribes to analytics events and triggers downstream actions.
 *
 * Current consumers:
 * - cannibalization:detected -> Log for alerting (NotificationService integration ready)
 * - trends:analyzed -> Log for alerting (NotificationService integration ready)
 * - analytics:sync-completed -> Cache warming + trend calculation trigger (CACHE-02, BMQ-003 FIX)
 *
 * BMQ-003 FIX: Event-driven job dependencies
 * - Trend calculation now triggers after GSC sync completes (event-driven)
 * - Fallback cron at 2:45 AM still runs as safety net
 *
 * Future consumers can subscribe to events without modifying emitting services.
 *
 * @see .planning/phases/96-agency-analytics/CACHING-STRATEGY.md for cache design
 */
import { createLogger } from '@/server/lib/logger';
import { Queue } from 'bullmq';
import {
  getAnalyticsEventBus,
  type AnalyticsEventPayload,
} from './analytics-event-bus';
import { warmAnalyticsCacheForSite } from '@/server/cache';
import { getSharedBullMQConnection } from '@/server/lib/redis';
import type { TrendCalculationJobData } from '@/server/workers/trend-calculation-worker';

const log = createLogger({ module: 'analytics-event-consumer' });

// =============================================================================
// BMQ-003 FIX: Trend Calculation Queue for Event-Driven Dependencies
// =============================================================================

/**
 * Lazy-initialized trend calculation queue for event-driven job triggering.
 * BMQ-003 FIX: Trend analysis now triggered after GSC sync completes.
 */
let trendCalculationQueue: Queue<TrendCalculationJobData> | null = null;

function getTrendCalculationQueue(): Queue<TrendCalculationJobData> {
  if (!trendCalculationQueue) {
    trendCalculationQueue = new Queue<TrendCalculationJobData>('trend-calculation', {
      connection: getSharedBullMQConnection('consumer:trend-calculation'),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400, count: 100 },
        removeOnFail: { age: 604800, count: 500 },
        // BMQ-003: MEDIUM priority - runs after GSC sync (HIGH), before maintenance (LOW)
        priority: 2,
      },
    });
  }
  return trendCalculationQueue;
}

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
export async function shutdownAnalyticsEventConsumers(): Promise<void> {
  for (const unsubscribe of unsubscribers) {
    unsubscribe();
  }
  unsubscribers = [];

  // Close trend calculation queue if initialized
  if (trendCalculationQueue) {
    try {
      await trendCalculationQueue.close();
      trendCalculationQueue = null;
    } catch (error) {
      log.warn('Failed to close trend calculation queue', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

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
 * CACHE-02 FIX: Triggers cache warming after GSC sync completes.
 * BMQ-003 FIX: Triggers trend calculation after GSC sync completes (event-driven dependency).
 *
 * Cache warming and trend calculation run asynchronously and do not block the event handler.
 * This ensures the first user to load the dashboard after overnight sync
 * gets warm cache hits instead of cold database queries.
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

  // BMQ-003 FIX: Trigger trend calculation via event-driven dependency
  // This runs AFTER GSC sync completes, ensuring fresh data is available
  setImmediate(async () => {
    try {
      const queue = getTrendCalculationQueue();
      const jobId = `trend-event:${siteId}:${startDate}`;

      await queue.add(
        'event-triggered',
        {
          workspaceId: siteId, // Use siteId as workspaceId for trend analysis
          siteId,
          calculationType: 'incremental',
          dateRange: { start: startDate, end: endDate },
        },
        {
          jobId, // Dedupe: only one trend job per site per day
          priority: 2, // MEDIUM priority
        }
      );

      log.info('Trend calculation triggered after GSC sync (BMQ-003)', {
        siteId,
        jobId,
        triggeredBy: 'analytics:sync-completed',
      });
    } catch (error) {
      // Non-fatal: cron fallback at 2:45 AM will still run
      log.warn('Failed to trigger event-driven trend calculation', {
        siteId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // CACHE-02 FIX: Trigger cache warming asynchronously (non-blocking)
  // Use setImmediate to not block the event handler completion
  setImmediate(() => {
    warmAnalyticsCacheForSite(siteId)
      .then((result) => {
        if (result.success) {
          log.info('Cache warming triggered after sync', {
            siteId,
            warmedCount: result.warmedCount,
            durationMs: result.durationMs,
          });
        } else {
          log.warn('Cache warming had partial failures', {
            siteId,
            warmedCount: result.warmedCount,
            failedCount: result.failedCount,
            durationMs: result.durationMs,
          });
        }
      })
      .catch((error) => {
        log.error('Cache warming failed', error instanceof Error ? error : undefined, {
          siteId,
        });
      });
  });

  // Could emit metrics to observability platform
  // metrics.gauge('analytics.sync.records', recordCount, { siteId });
}
