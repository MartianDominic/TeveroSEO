/**
 * Action-specific rate limiters for server actions.
 *
 * Different actions have different cost profiles:
 * - External API calls (DataForSEO) = expensive, needs tight limits
 * - File uploads = resource intensive, moderate limits
 * - CRUD operations = low cost, generous limits
 * - Read operations = lowest cost, most generous limits
 */

import { RateLimiter, checkRateLimit as baseCheckRateLimit, RateLimitError } from "../rate-limit";

/**
 * Rate limiter categories based on operation cost/risk.
 */
export const actionLimiters = {
  /**
   * External API calls (DataForSEO, SERP analysis).
   * These have direct monetary cost per request.
   * 20 requests per hour per user.
   */
  externalApi: new RateLimiter({
    maxRequests: 20,
    windowSeconds: 3600, // 1 hour
    prefix: "ratelimit:action:external-api",
  }),

  /**
   * Keyword research operations (DataForSEO).
   * These are expensive external API calls.
   * 20 requests per hour per user.
   */
  keywords: new RateLimiter({
    maxRequests: 20,
    windowSeconds: 3600, // 1 hour
    prefix: "ratelimit:action:keywords",
  }),

  /**
   * Domain analysis operations (DataForSEO).
   * These are expensive external API calls.
   * 30 requests per hour per user.
   */
  domainAnalysis: new RateLimiter({
    maxRequests: 30,
    windowSeconds: 3600, // 1 hour
    prefix: "ratelimit:action:domain",
  }),

  /**
   * File upload operations (logo, CSV imports).
   * Resource intensive operations.
   * 10 uploads per hour per user.
   */
  upload: new RateLimiter({
    maxRequests: 10,
    windowSeconds: 3600, // 1 hour
    prefix: "ratelimit:action:upload",
  }),

  /**
   * Revert/mutation operations.
   * Can modify CMS content - need to prevent abuse.
   * 30 reverts per hour per user.
   */
  revert: new RateLimiter({
    maxRequests: 30,
    windowSeconds: 3600, // 1 hour
    prefix: "ratelimit:action:revert",
  }),

  /**
   * Alert configuration changes.
   * Prevent alert bombing and config abuse.
   * 50 changes per hour per user.
   */
  alertConfig: new RateLimiter({
    maxRequests: 50,
    windowSeconds: 3600, // 1 hour
    prefix: "ratelimit:action:alert-config",
  }),

  /**
   * Saved views CRUD operations.
   * Low cost but prevent spam creation.
   * 60 operations per hour per user.
   */
  savedViews: new RateLimiter({
    maxRequests: 60,
    windowSeconds: 3600, // 1 hour
    prefix: "ratelimit:action:saved-views",
  }),

  /**
   * Team metrics and assignment operations.
   * Moderate cost with caching.
   * 60 operations per minute per user.
   */
  teamMetrics: new RateLimiter({
    maxRequests: 60,
    windowSeconds: 60, // 1 minute
    prefix: "ratelimit:action:team-metrics",
  }),

  /**
   * Opportunity analysis.
   * Aggregates data from multiple clients - can be expensive.
   * 30 operations per minute per user.
   */
  opportunities: new RateLimiter({
    maxRequests: 30,
    windowSeconds: 60, // 1 minute
    prefix: "ratelimit:action:opportunities",
  }),

  /**
   * Standard CRUD operations.
   * Low cost operations with basic limits.
   * 100 operations per minute per user.
   */
  crud: new RateLimiter({
    maxRequests: 100,
    windowSeconds: 60, // 1 minute
    prefix: "ratelimit:action:crud",
  }),

  /**
   * Read-only operations.
   * Lowest cost, most generous limits.
   * 200 reads per minute per user.
   */
  read: new RateLimiter({
    maxRequests: 200,
    windowSeconds: 60, // 1 minute
    prefix: "ratelimit:action:read",
  }),

  /**
   * Dashboard aggregation operations.
   * Heavy queries but heavily cached.
   * 60 operations per minute per user.
   */
  dashboard: new RateLimiter({
    maxRequests: 60,
    windowSeconds: 60, // 1 minute
    prefix: "ratelimit:action:dashboard",
  }),

  /**
   * Findings and export operations.
   * Can generate large datasets.
   * 30 operations per minute per user.
   */
  export: new RateLimiter({
    maxRequests: 30,
    windowSeconds: 60, // 1 minute
    prefix: "ratelimit:action:export",
  }),

  /**
   * Mapping operations (keyword-to-URL mapping).
   * Moderate cost operations.
   * 50 operations per minute per user.
   */
  mapping: new RateLimiter({
    maxRequests: 50,
    windowSeconds: 60, // 1 minute
    prefix: "ratelimit:action:mapping",
  }),
} as const;

/**
 * Type for limiter keys.
 */
export type ActionLimiterKey = keyof typeof actionLimiters;

/**
 * Check rate limit for a specific action type.
 * Throws RateLimitError if limit exceeded.
 *
 * @param limiterKey - The action limiter to use
 * @param identifier - User ID or other identifier
 * @throws RateLimitError if rate limit exceeded
 */
export async function checkActionRateLimit(
  limiterKey: ActionLimiterKey,
  identifier: string
): Promise<void> {
  const limiter = actionLimiters[limiterKey];
  await baseCheckRateLimit(limiter, identifier);
}

/**
 * Re-export RateLimitError for convenience.
 */
export { RateLimitError };
