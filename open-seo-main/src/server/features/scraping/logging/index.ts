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
  camoufoxLogger,
  cruxLogger,
  retentionLogger,
  workerLogger,
  dfsBudgetLogger,
  // Dynamic logger creation
  createComponentLogger,
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
} from './Logger';

// Export RequestContext type
export type { RequestContext } from './Logger';

// Re-export pino logger type for advanced usage
export type { Logger as PinoLogger } from 'pino';
