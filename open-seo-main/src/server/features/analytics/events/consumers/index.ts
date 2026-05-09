/**
 * Analytics Event Consumers
 * Phase 96: Agency Analytics - Event Consumer Implementation
 *
 * Exports all event consumers and their types for the analytics event bus.
 */

// EC-001: Trend Notification Consumer
export {
  handleTrendsComputed,
  createTrendNotificationHandler,
  extractSignificantChanges,
  type TrendsComputedEventPayload,
  type TrendNotificationConfig,
  type SignificantChange,
} from './trend-notification-consumer';

// EC-002: Anomaly Alert Consumer
export {
  handleAnomalyDetected,
  createAnomalyAlertHandler,
  classifyAnomalySeverity,
  calculateHealthScoreImpact,
  isAlertRuleEnabled,
  type AnomalyDetectedEventPayload,
  type AnomalyType,
  type AlertSeverity,
  type AnomalyProcessingResult,
} from './anomaly-alert-consumer';
