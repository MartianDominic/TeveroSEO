/**
 * Analytics Events
 * Re-exports event bus, types, and consumers for decoupled service communication.
 */

export * from './analytics-event-bus';
export {
  initAnalyticsEventConsumers,
  shutdownAnalyticsEventConsumers,
} from './analytics-event-consumer';
