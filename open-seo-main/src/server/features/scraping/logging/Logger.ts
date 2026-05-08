/**
 * Structured Logger with Correlation ID Support
 * Phase 95-16: Metrics & Observability
 *
 * Provides:
 * - Structured JSON logging with pino
 * - Correlation ID propagation via AsyncLocalStorage
 * - Component-specific child loggers
 * - Request middleware for correlation ID injection
 */

import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

// =============================================================================
// Correlation ID Storage
// =============================================================================

/**
 * Context stored per async execution.
 */
interface RequestContext {
  correlationId: string;
  clientId?: string;
  jobId?: string;
  url?: string;
}

/**
 * AsyncLocalStorage for correlation ID propagation.
 */
const requestContextStorage = new AsyncLocalStorage<RequestContext>();

// =============================================================================
// Logger Configuration
// =============================================================================

/**
 * Main logger instance with structured output.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
    bindings: (bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
    }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'scraping',
    version: process.env.npm_package_version ?? 'unknown',
    env: process.env.NODE_ENV ?? 'development',
  },
  // Mixin adds correlation context to every log
  mixin: () => {
    const context = requestContextStorage.getStore();
    if (!context) {
      return {};
    }
    const result: Record<string, string | undefined> = {
      correlationId: context.correlationId,
    };
    if (context.clientId) {
      result.clientId = context.clientId;
    }
    if (context.jobId) {
      result.jobId = context.jobId;
    }
    if (context.url) {
      result.url = context.url;
    }
    return result;
  },
});

// =============================================================================
// Component-Specific Child Loggers
// =============================================================================

/**
 * Logger for TieredFetcher operations.
 */
export const fetcherLogger = logger.child({ component: 'fetcher' });

/**
 * Logger for cache operations.
 */
export const cacheLogger = logger.child({ component: 'cache' });

/**
 * Logger for queue operations.
 */
export const queueLogger = logger.child({ component: 'queue' });

/**
 * Logger for cost tracking.
 */
export const costLogger = logger.child({ component: 'cost' });

/**
 * Logger for domain learning.
 */
export const domainLogger = logger.child({ component: 'domain-learning' });

/**
 * Logger for alert manager.
 */
export const alertLogger = logger.child({ component: 'alerts' });

/**
 * Logger for migration operations.
 */
export const migrationLogger = logger.child({ component: 'migration' });

/**
 * Logger for circuit breaker operations.
 */
export const circuitLogger = logger.child({ component: 'circuit' });

// =============================================================================
// Correlation ID Utilities
// =============================================================================

/**
 * Generate a unique correlation ID.
 * Format: scrape-{timestamp}-{random}
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return `scrape-${timestamp}-${random}`;
}

/**
 * Get the current correlation ID from async context.
 */
export function getCorrelationId(): string | undefined {
  return requestContextStorage.getStore()?.correlationId;
}

/**
 * Get the full request context.
 */
export function getRequestContext(): RequestContext | undefined {
  return requestContextStorage.getStore();
}

/**
 * Execute a function with a specific correlation ID.
 */
export function withCorrelationId<T>(
  correlationId: string,
  fn: () => T
): T {
  return requestContextStorage.run({ correlationId }, fn);
}

/**
 * Execute a function with full request context.
 */
export function withRequestContext<T>(
  context: RequestContext,
  fn: () => T
): T {
  return requestContextStorage.run(context, fn);
}

/**
 * Execute an async function with full request context.
 */
export async function withRequestContextAsync<T>(
  context: RequestContext,
  fn: () => Promise<T>
): Promise<T> {
  return requestContextStorage.run(context, fn);
}

// =============================================================================
// Express Middleware
// =============================================================================

/**
 * Express middleware to extract or generate correlation ID.
 * Injects correlation ID into all logs within the request.
 */
export function correlationMiddleware(
  req: { headers: Record<string, string | string[] | undefined>; url?: string },
  res: { setHeader: (name: string, value: string) => void },
  next: () => void
): void {
  // Extract correlation ID from header or generate new one
  const headerValue = req.headers['x-correlation-id'];
  const correlationId =
    (typeof headerValue === 'string' ? headerValue : undefined) ??
    generateCorrelationId();

  // Set correlation ID in response header
  res.setHeader('x-correlation-id', correlationId);

  // Run request handler with correlation context
  const context: RequestContext = {
    correlationId,
    url: req.url,
  };

  requestContextStorage.run(context, () => {
    next();
  });
}

// =============================================================================
// BullMQ Job Context
// =============================================================================

/**
 * Create request context from a BullMQ job.
 */
export function createJobContext(job: {
  id?: string;
  data?: { url?: string; clientId?: string; correlationId?: string };
}): RequestContext {
  return {
    correlationId: job.data?.correlationId ?? generateCorrelationId(),
    jobId: job.id,
    clientId: job.data?.clientId,
    url: job.data?.url,
  };
}

/**
 * Execute a job processor with proper logging context.
 */
export async function withJobContext<T>(
  job: {
    id?: string;
    data?: { url?: string; clientId?: string; correlationId?: string };
  },
  fn: () => Promise<T>
): Promise<T> {
  const context = createJobContext(job);
  return withRequestContextAsync(context, fn);
}

// =============================================================================
// Logging Helpers
// =============================================================================

/**
 * Log a scrape operation start.
 */
export function logScrapeStart(url: string, tier: string): void {
  fetcherLogger.info({ url, tier }, 'Scrape started');
}

/**
 * Log a scrape operation completion.
 */
export function logScrapeComplete(params: {
  url: string;
  tier: string;
  cached: boolean;
  durationMs: number;
  costUsd: number;
  statusCode: number;
}): void {
  fetcherLogger.info(
    {
      url: params.url,
      tier: params.tier,
      cached: params.cached,
      durationMs: params.durationMs,
      costUsd: params.costUsd,
      statusCode: params.statusCode,
    },
    'Scrape completed'
  );
}

/**
 * Log a scrape operation failure.
 */
export function logScrapeError(params: {
  url: string;
  tier: string;
  error: string;
  durationMs: number;
}): void {
  fetcherLogger.error(
    {
      url: params.url,
      tier: params.tier,
      error: params.error,
      durationMs: params.durationMs,
    },
    'Scrape failed'
  );
}

/**
 * Log tier escalation.
 */
export function logTierEscalation(
  url: string,
  fromTier: string,
  toTier: string,
  reason: string
): void {
  fetcherLogger.info(
    { url, fromTier, toTier, reason },
    'Tier escalation'
  );
}

/**
 * Log cache operation.
 */
export function logCacheOperation(params: {
  operation: 'get' | 'set' | 'invalidate';
  url: string;
  level?: string;
  hit?: boolean;
  ttlMs?: number;
}): void {
  cacheLogger.debug(params, `Cache ${params.operation}`);
}

/**
 * Log circuit breaker state change.
 */
export function logCircuitStateChange(
  tier: string,
  oldState: string,
  newState: string
): void {
  circuitLogger.warn(
    { tier, oldState, newState },
    `Circuit state changed: ${oldState} -> ${newState}`
  );
}

/**
 * Log cost tracking.
 */
export function logCostRecord(params: {
  tier: string;
  costUsd: number;
  clientId?: string;
  domain: string;
}): void {
  costLogger.info(params, 'Cost recorded');
}

/**
 * Log queue operation.
 */
export function logQueueOperation(params: {
  operation: 'enqueue' | 'dequeue' | 'complete' | 'fail';
  queue: string;
  jobId?: string;
  url?: string;
}): void {
  queueLogger.debug(params, `Queue ${params.operation}`);
}
