/**
 * Middleware exports for apps/web.
 *
 * Provides rate limiting, request logging, and other middleware utilities
 * for Next.js API routes and server actions.
 */

export {
  // Core rate limiting
  checkRateLimit,
  getRateLimitStatus,
  getClientIp,
  getClientIpFromRequest,

  // API route wrappers
  withRateLimit,
  withAuthRateLimit,
  withHeavyRateLimit,

  // Server action rate limiting
  rateLimitAction,

  // Predefined configurations
  RATE_LIMITS,

  // Testing utilities
  resetRateLimit,
  clearAllRateLimits,
  getRateLimitMapSize,

  // Types
  type RateLimitResult,
  type RateLimitOptions,
} from './rate-limit';

export {
  // Request logging
  withRequestLogging,
  logApiError,
  createApiLogger,
  CORRELATION_ID_HEADER,
  REQUEST_ID_HEADER,
} from './request-logger';
