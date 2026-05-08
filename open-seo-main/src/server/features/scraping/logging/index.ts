/**
 * Logging Module Exports
 * Phase 95-16: Metrics & Observability
 */

export {
  // Main logger
  logger,
  // Component loggers
  fetcherLogger,
  cacheLogger,
  queueLogger,
  costLogger,
  domainLogger,
  alertLogger,
  migrationLogger,
  circuitLogger,
  // Correlation ID utilities
  generateCorrelationId,
  getCorrelationId,
  getRequestContext,
  withCorrelationId,
  withRequestContext,
  withRequestContextAsync,
  // Middleware
  correlationMiddleware,
  // Job context
  createJobContext,
  withJobContext,
  // Logging helpers
  logScrapeStart,
  logScrapeComplete,
  logScrapeError,
  logTierEscalation,
  logCacheOperation,
  logCircuitStateChange,
  logCostRecord,
  logQueueOperation,
  // Types
  type RequestContext,
} from './Logger';

// Re-export RequestContext type
export type { RequestContext } from './Logger';
