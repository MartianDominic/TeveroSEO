/**
 * AnalyticsEventBus
 * Decoupled event communication for analytics services.
 *
 * Breaks circular dependencies by allowing services to communicate
 * through events rather than direct method calls.
 *
 * Usage:
 * - CannibalizationService emits 'cannibalization:detected' events
 * - AnalyticsService subscribes to events it needs
 * - No direct dependency between services
 */
import { createLogger } from '@/server/lib/logger';
import { EventEmitter } from 'events';

const logger = createLogger({ module: 'analytics-event-bus' });

// =============================================================================
// Event Types
// =============================================================================

/**
 * Event payload for cannibalization detection.
 */
export interface CannibalizationDetectedEvent {
  type: 'cannibalization:detected';
  payload: {
    siteId: string;
    issueCount: number;
    severity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    timestamp: Date;
  };
}

/**
 * Event payload for trend detection completion.
 */
export interface TrendsAnalyzedEvent {
  type: 'trends:analyzed';
  payload: {
    siteId: string;
    growingCount: number;
    decayingCount: number;
    stableCount: number;
    timestamp: Date;
  };
}

/**
 * Event payload for cluster metrics update.
 */
export interface ClusterMetricsUpdatedEvent {
  type: 'cluster:metrics-updated';
  payload: {
    clusterId: string;
    siteId: string;
    totalClicks: number;
    totalImpressions: number;
    coverage: number;
    timestamp: Date;
  };
}

/**
 * Event payload for content group changes.
 */
export interface ContentGroupChangedEvent {
  type: 'content-group:changed';
  payload: {
    groupId: string;
    siteId: string;
    changeType: 'created' | 'updated' | 'deleted' | 'pages-changed';
    timestamp: Date;
  };
}

/**
 * Event payload for analytics sync completion.
 */
export interface AnalyticsSyncCompletedEvent {
  type: 'analytics:sync-completed';
  payload: {
    siteId: string;
    recordCount: number;
    startDate: string;
    endDate: string;
    timestamp: Date;
  };
}

/**
 * Event payload for trend computation completion (EC-001).
 * Emitted when trend analysis completes with full result data.
 */
export interface TrendsComputedEvent {
  type: 'analytics.trends.computed';
  payload: {
    siteId: string;
    clientId: string;
    workspaceId: string;
    result: {
      pages: Array<{
        pageUrl: string;
        currentClicks: number;
        previousClicks: number;
        currentImpressions: number;
        previousImpressions: number;
        currentPosition: number;
        previousPosition: number;
        changePercent: number;
        trend: 'growing' | 'decaying' | 'stable';
        confidence: 'high' | 'medium' | 'low';
        topQueries: string[];
      }>;
      meta: {
        totalAnalyzed: number;
        growingCount: number;
        decayingCount: number;
        stableCount: number;
        periodDays: number;
        threshold: number;
      };
    };
    timestamp: Date;
  };
}

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
 * Event payload for anomaly detection (EC-002).
 * Emitted when an SEO anomaly is detected.
 */
export interface AnomalyDetectedEvent {
  type: 'analytics.anomaly.detected';
  payload: {
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
      keyword?: string;
      previousPosition?: number;
      currentPosition?: number;
      cwvMetric?: 'LCP' | 'FID' | 'CLS' | 'INP';
      errorTypes?: string[];
      periodDays?: number;
      confidence?: 'high' | 'medium' | 'low';
    };
    timestamp: Date;
  };
}

/**
 * Union type of all analytics events.
 */
export type AnalyticsEvent =
  | CannibalizationDetectedEvent
  | TrendsAnalyzedEvent
  | ClusterMetricsUpdatedEvent
  | ContentGroupChangedEvent
  | AnalyticsSyncCompletedEvent
  | TrendsComputedEvent
  | AnomalyDetectedEvent;

/**
 * Event type string literals for type-safe subscription.
 */
export type AnalyticsEventType = AnalyticsEvent['type'];

/**
 * Extract payload type from event type.
 */
export type AnalyticsEventPayload<T extends AnalyticsEventType> =
  Extract<AnalyticsEvent, { type: T }>['payload'];

// =============================================================================
// Event Handler Types
// =============================================================================

/**
 * Handler function for an analytics event.
 */
export type AnalyticsEventHandler<T extends AnalyticsEventType> = (
  payload: AnalyticsEventPayload<T>
) => void | Promise<void>;

// =============================================================================
// AnalyticsEventBus Class
// =============================================================================

/**
 * Event bus for decoupled analytics service communication.
 *
 * @example
 * // In CannibalizationService
 * const eventBus = getAnalyticsEventBus();
 * eventBus.emit('cannibalization:detected', {
 *   siteId: 'abc123',
 *   issueCount: 15,
 *   severity: { critical: 2, high: 5, medium: 6, low: 2 },
 *   timestamp: new Date(),
 * });
 *
 * // In AnalyticsService
 * eventBus.on('cannibalization:detected', (payload) => {
 *   // Update dashboards, send alerts, etc.
 * });
 */
export class AnalyticsEventBus {
  private emitter: EventEmitter;
  private handlerCounts: Map<string, number> = new Map();

  constructor() {
    this.emitter = new EventEmitter();
    // Increase max listeners for high-throughput scenarios
    this.emitter.setMaxListeners(100);
  }

  /**
   * Subscribe to an analytics event.
   *
   * @param eventType - Event type to subscribe to
   * @param handler - Handler function called when event is emitted
   * @returns Unsubscribe function
   */
  on<T extends AnalyticsEventType>(
    eventType: T,
    handler: AnalyticsEventHandler<T>
  ): () => void {
    const wrappedHandler = async (payload: AnalyticsEventPayload<T>) => {
      try {
        await handler(payload);
      } catch (error) {
        logger.error(`Event handler failed for ${eventType}`, error instanceof Error ? error : undefined, {
          eventType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    this.emitter.on(eventType, wrappedHandler);

    // Track handler count
    const currentCount = this.handlerCounts.get(eventType) ?? 0;
    this.handlerCounts.set(eventType, currentCount + 1);

    logger.debug(`Event handler subscribed`, { eventType, handlerCount: currentCount + 1 });

    // Return unsubscribe function
    return () => {
      this.emitter.off(eventType, wrappedHandler);
      const newCount = (this.handlerCounts.get(eventType) ?? 1) - 1;
      this.handlerCounts.set(eventType, newCount);
      logger.debug(`Event handler unsubscribed`, { eventType, handlerCount: newCount });
    };
  }

  /**
   * Subscribe to an event for one occurrence only.
   *
   * @param eventType - Event type to subscribe to
   * @param handler - Handler function called once when event is emitted
   */
  once<T extends AnalyticsEventType>(
    eventType: T,
    handler: AnalyticsEventHandler<T>
  ): void {
    const wrappedHandler = async (payload: AnalyticsEventPayload<T>) => {
      try {
        await handler(payload);
      } catch (error) {
        logger.error(`One-time event handler failed for ${eventType}`, error instanceof Error ? error : undefined, {
          eventType,
        });
      }
    };

    this.emitter.once(eventType, wrappedHandler);
  }

  /**
   * Emit an analytics event.
   *
   * @param eventType - Event type to emit
   * @param payload - Event payload
   */
  emit<T extends AnalyticsEventType>(
    eventType: T,
    payload: AnalyticsEventPayload<T>
  ): void {
    const handlerCount = this.handlerCounts.get(eventType) ?? 0;

    logger.debug(`Emitting event`, { eventType, handlerCount });

    this.emitter.emit(eventType, payload);
  }

  /**
   * Remove all handlers for a specific event type.
   *
   * @param eventType - Event type to clear handlers for
   */
  removeAllListeners(eventType?: AnalyticsEventType): void {
    if (eventType) {
      this.emitter.removeAllListeners(eventType);
      this.handlerCounts.set(eventType, 0);
      logger.debug(`All handlers removed for event`, { eventType });
    } else {
      this.emitter.removeAllListeners();
      this.handlerCounts.clear();
      logger.debug(`All event handlers removed`);
    }
  }

  /**
   * Get the number of handlers for an event type.
   *
   * @param eventType - Event type to check
   * @returns Number of registered handlers
   */
  listenerCount(eventType: AnalyticsEventType): number {
    return this.emitter.listenerCount(eventType);
  }
}

// =============================================================================
// Singleton Instance
// =============================================================================

let instance: AnalyticsEventBus | null = null;

/**
 * Get the singleton AnalyticsEventBus instance.
 */
export function getAnalyticsEventBus(): AnalyticsEventBus {
  if (!instance) {
    instance = new AnalyticsEventBus();
  }
  return instance;
}

/**
 * Reset the singleton instance (for testing).
 */
export function resetAnalyticsEventBus(): void {
  if (instance) {
    instance.removeAllListeners();
  }
  instance = null;
}
