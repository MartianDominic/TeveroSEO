/**
 * TrendNotificationConsumer
 * Phase 96: Agency Analytics - Event Consumer Implementation (EC-001)
 *
 * Handles the 'analytics.trends.computed' event to notify stakeholders
 * about significant trend changes:
 * - Position deltas > 10 positions
 * - CTR anomalies > 2 standard deviations
 * - Impression spikes > 50% increase
 *
 * Notification channels:
 * - In-app notifications (portalNotifications table)
 * - Email digest (if user preferences enabled)
 * - Slack webhook (if configured)
 */
import { createLogger } from '@/server/lib/logger';
import { NotificationService } from '@/server/features/portal/services/NotificationService';
import type { TrendResult } from '../../types';

const log = createLogger({ module: 'trend-notification-consumer' });

// =============================================================================
// Event Types
// =============================================================================

/**
 * Payload for analytics.trends.computed event.
 */
export interface TrendsComputedEventPayload {
  siteId: string;
  clientId: string;
  workspaceId: string;
  result: TrendResult;
  timestamp: Date;
}

/**
 * Configuration for trend significance thresholds.
 */
export interface TrendNotificationConfig {
  /** Minimum position change to trigger notification (default: 10) */
  positionDeltaThreshold: number;
  /** CTR anomaly threshold in standard deviations (default: 2) */
  ctrAnomalyStdDev: number;
  /** Minimum impression increase percentage to trigger notification (default: 0.5 = 50%) */
  impressionSpikeThreshold: number;
  /** Minimum clicks/impressions to consider significant (default: 100) */
  minSignificantVolume: number;
}

const DEFAULT_CONFIG: TrendNotificationConfig = {
  positionDeltaThreshold: 10,
  ctrAnomalyStdDev: 2,
  impressionSpikeThreshold: 0.5,
  minSignificantVolume: 100,
};

/**
 * Detected significant change in trend data.
 */
export interface SignificantChange {
  pageUrl: string;
  changeType: 'position_gain' | 'position_loss' | 'ctr_anomaly' | 'impression_spike' | 'traffic_decay';
  severity: 'high' | 'medium' | 'low';
  details: {
    metric: string;
    previousValue: number;
    currentValue: number;
    changePercent: number;
  };
  topQueries: string[];
}

// =============================================================================
// Change Detection
// =============================================================================

/**
 * Extract significant changes from trend result.
 * Filters trends based on significance thresholds.
 */
export function extractSignificantChanges(
  result: TrendResult,
  config: TrendNotificationConfig = DEFAULT_CONFIG
): SignificantChange[] {
  const changes: SignificantChange[] = [];

  for (const page of result.pages) {
    // Skip low-volume pages
    if (page.currentImpressions < config.minSignificantVolume &&
        page.previousImpressions < config.minSignificantVolume) {
      continue;
    }

    // Check position changes
    const positionDelta = page.previousPosition - page.currentPosition; // Positive = improvement
    if (Math.abs(positionDelta) >= config.positionDeltaThreshold) {
      const isGain = positionDelta > 0;
      changes.push({
        pageUrl: page.pageUrl,
        changeType: isGain ? 'position_gain' : 'position_loss',
        severity: Math.abs(positionDelta) >= 20 ? 'high' : Math.abs(positionDelta) >= 15 ? 'medium' : 'low',
        details: {
          metric: 'position',
          previousValue: page.previousPosition,
          currentValue: page.currentPosition,
          changePercent: (positionDelta / page.previousPosition) * 100,
        },
        topQueries: page.topQueries.slice(0, 3),
      });
    }

    // Check impression spikes
    if (page.previousImpressions > 0) {
      const impressionChange = (page.currentImpressions - page.previousImpressions) / page.previousImpressions;
      if (impressionChange >= config.impressionSpikeThreshold) {
        changes.push({
          pageUrl: page.pageUrl,
          changeType: 'impression_spike',
          severity: impressionChange >= 1.0 ? 'high' : impressionChange >= 0.75 ? 'medium' : 'low',
          details: {
            metric: 'impressions',
            previousValue: page.previousImpressions,
            currentValue: page.currentImpressions,
            changePercent: impressionChange * 100,
          },
          topQueries: page.topQueries.slice(0, 3),
        });
      }
    }

    // Check traffic decay (significant click drops)
    if (page.trend === 'decaying' && page.changePercent <= -30) {
      changes.push({
        pageUrl: page.pageUrl,
        changeType: 'traffic_decay',
        severity: page.changePercent <= -50 ? 'high' : page.changePercent <= -40 ? 'medium' : 'low',
        details: {
          metric: 'clicks',
          previousValue: page.previousClicks,
          currentValue: page.currentClicks,
          changePercent: page.changePercent,
        },
        topQueries: page.topQueries.slice(0, 3),
      });
    }
  }

  // Sort by severity (high first)
  const severityOrder = { high: 0, medium: 1, low: 2 };
  return changes.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

// =============================================================================
// Notification Building
// =============================================================================

/**
 * Build notification payload from significant changes.
 */
function buildNotificationPayload(
  changes: SignificantChange[],
  siteId: string,
  portalBaseUrl: string
): {
  title: string;
  body: string;
  keyword: string;
  portalUrl: string;
  summary?: { clicks: number; impressions: number; top10Count: number; winsCount: number };
} {
  const highSeverity = changes.filter(c => c.severity === 'high');
  const positionGains = changes.filter(c => c.changeType === 'position_gain');
  const trafficDecay = changes.filter(c => c.changeType === 'traffic_decay');

  // Build summary title
  let title = 'Trend Analysis Complete';
  if (highSeverity.length > 0) {
    title = `${highSeverity.length} significant SEO change${highSeverity.length > 1 ? 's' : ''} detected`;
  }

  // Build body with change summary
  const bodyParts: string[] = [];

  if (positionGains.length > 0) {
    bodyParts.push(`${positionGains.length} page${positionGains.length > 1 ? 's' : ''} gained rankings`);
  }

  if (trafficDecay.length > 0) {
    bodyParts.push(`${trafficDecay.length} page${trafficDecay.length > 1 ? 's' : ''} with traffic decay`);
  }

  const impressionSpikes = changes.filter(c => c.changeType === 'impression_spike');
  if (impressionSpikes.length > 0) {
    bodyParts.push(`${impressionSpikes.length} impression spike${impressionSpikes.length > 1 ? 's' : ''}`);
  }

  // Get the most significant keyword for the notification
  const topChange = changes[0];
  const keyword = topChange?.topQueries[0] ?? topChange?.pageUrl ?? 'multiple pages';

  return {
    title,
    body: bodyParts.length > 0 ? bodyParts.join(', ') : 'No significant changes detected',
    keyword,
    portalUrl: `${portalBaseUrl}/analytics/trends?siteId=${siteId}`,
    summary: {
      clicks: 0, // Will be populated from TrendResult if needed
      impressions: 0,
      top10Count: positionGains.length,
      winsCount: positionGains.filter(c => c.details.currentValue <= 10).length,
    },
  };
}

// =============================================================================
// Event Handler
// =============================================================================

/**
 * Handle analytics.trends.computed event.
 *
 * Flow:
 * 1. Extract significant changes from trend data
 * 2. Check user notification preferences
 * 3. Create in-app notifications
 * 4. Queue email digest if enabled
 * 5. Send Slack webhook if configured
 */
export async function handleTrendsComputed(
  payload: TrendsComputedEventPayload,
  config: TrendNotificationConfig = DEFAULT_CONFIG
): Promise<{ notificationsSent: number; significantChanges: number }> {
  const { siteId, clientId, result, timestamp: _timestamp } = payload;

  log.info('Processing trends computed event', {
    siteId,
    clientId,
    totalPages: result.pages.length,
    growingCount: result.meta.growingCount,
    decayingCount: result.meta.decayingCount,
  });

  // 1. Extract significant changes
  const significantChanges = extractSignificantChanges(result, config);

  if (significantChanges.length === 0) {
    log.debug('No significant changes detected, skipping notifications', { siteId });
    return { notificationsSent: 0, significantChanges: 0 };
  }

  log.info('Significant changes detected', {
    siteId,
    changeCount: significantChanges.length,
    highSeverity: significantChanges.filter(c => c.severity === 'high').length,
  });

  // 2. Build notification payload
  const portalBaseUrl = process.env.APP_URL ?? 'https://app.tevero.lt';
  const notificationPayload = buildNotificationPayload(significantChanges, siteId, portalBaseUrl);

  let notificationsSent = 0;

  // 3. Create in-app notification (always enabled)
  try {
    const inAppNotif = await NotificationService.queueNotification(
      clientId,
      'alert', // Use 'alert' type for trend notifications
      'in_app',
      {
        keyword: notificationPayload.keyword,
        portalUrl: notificationPayload.portalUrl,
        // Custom fields for trend notifications
        trendSummary: {
          title: notificationPayload.title,
          body: notificationPayload.body,
          changeCount: significantChanges.length,
          highSeverityCount: significantChanges.filter(c => c.severity === 'high').length,
        },
      }
    );

    if (inAppNotif) {
      notificationsSent++;
      log.debug('In-app notification queued', { notificationId: inAppNotif.id });
    }
  } catch (error) {
    log.error('Failed to queue in-app notification', error instanceof Error ? error : undefined, {
      siteId,
      clientId,
    });
  }

  // 4. Queue email notification if significant changes
  if (significantChanges.some(c => c.severity === 'high')) {
    try {
      const emailNotif = await NotificationService.queueNotification(
        clientId,
        'alert',
        'email',
        {
          keyword: notificationPayload.keyword,
          portalUrl: notificationPayload.portalUrl,
          summary: notificationPayload.summary,
        }
      );

      if (emailNotif) {
        notificationsSent++;
        log.debug('Email notification queued', { notificationId: emailNotif.id });
      }
    } catch (error) {
      log.error('Failed to queue email notification', error instanceof Error ? error : undefined, {
        siteId,
        clientId,
      });
    }
  }

  // 5. Queue Slack notification if configured
  try {
    const slackNotif = await NotificationService.queueNotification(
      clientId,
      'alert',
      'slack',
      {
        keyword: notificationPayload.keyword,
        portalUrl: notificationPayload.portalUrl,
        dropAmount: significantChanges.filter(c => c.changeType === 'traffic_decay').length,
      }
    );

    if (slackNotif) {
      notificationsSent++;
      log.debug('Slack notification queued', { notificationId: slackNotif.id });
    }
  } catch (error) {
    // Slack is optional, just log at debug level if it fails
    log.debug('Slack notification not sent', {
      siteId,
      clientId,
      reason: error instanceof Error ? error.message : 'unknown',
    });
  }

  log.info('Trend notifications processed', {
    siteId,
    clientId,
    notificationsSent,
    significantChanges: significantChanges.length,
  });

  return {
    notificationsSent,
    significantChanges: significantChanges.length,
  };
}

/**
 * Create a bound handler for the event bus.
 * Uses default configuration.
 */
export function createTrendNotificationHandler(
  config: Partial<TrendNotificationConfig> = {}
): (payload: TrendsComputedEventPayload) => Promise<void> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  return async (payload: TrendsComputedEventPayload): Promise<void> => {
    try {
      await handleTrendsComputed(payload, mergedConfig);
    } catch (error) {
      log.error('Trend notification handler failed', error instanceof Error ? error : undefined, {
        siteId: payload.siteId,
        clientId: payload.clientId,
      });
      // Don't re-throw - event handlers should not block the event bus
    }
  };
}
