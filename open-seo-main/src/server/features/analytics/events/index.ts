/**
 * Analytics Events
 * Re-exports event bus, types, and consumers for decoupled service communication.
 */

export * from './analytics-event-bus';
export {
  initAnalyticsEventConsumers,
  shutdownAnalyticsEventConsumers,
} from './analytics-event-consumer';

// EC-001 & EC-002: Event consumer exports
// Re-export specific items to avoid naming conflicts with analytics-event-bus
export {
  // Trend notification consumer
  handleTrendsComputed,
  createTrendNotificationHandler,
  extractSignificantChanges,
  type TrendsComputedEventPayload,
  type TrendNotificationConfig,
  type SignificantChange,
  // Anomaly alert consumer
  handleAnomalyDetected,
  createAnomalyAlertHandler,
  classifyAnomalySeverity,
  calculateHealthScoreImpact,
  isAlertRuleEnabled,
  type AnomalyDetectedEventPayload,
  // Note: AnomalyType is already exported from analytics-event-bus
  type AlertSeverity,
  type AnomalyProcessingResult,
} from './consumers';
