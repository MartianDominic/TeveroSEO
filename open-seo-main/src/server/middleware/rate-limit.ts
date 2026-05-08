/**
 * Rate limiting middleware using Redis sliding window algorithm.
 *
 * Provides distributed rate limiting for API endpoints to prevent
 * resource exhaustion attacks and ensure fair usage.
 *
 * @example
 * ```ts
 * // Check rate limit manually
 * const result = await rateLimit({
 *   key: `audit:${clientId}`,
 *   limit: 10,
 *   window: 60,
 * });
 * if (!result.allowed) {
 *   return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
 * }
 *
 * // Or use the wrapper for route handlers
 * const handler = withRateLimit(
 *   { key: (req) => `audit:${extractClientId(req)}`, limit: 10, window: 60 },
 *   async (request) => { ... }
 * );
 * ```
 */

import { redis } from "@/server/lib/redis";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "rate-limit" });

// --- Types ---

export interface RateLimitOptions {
  /** Unique key for this rate limit bucket (e.g., "audit:${clientId}") */
  key: string;
  /** Maximum number of requests allowed within the window */
  limit: number;
  /** Time window in seconds */
  window: number;
}

export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Number of remaining requests in the current window */
  remaining: number;
  /** Seconds until the rate limit resets (only set when not allowed) */
  retryAfter?: number;
  /** Total limit for reference */
  limit: number;
  /** Current request count in the window */
  current: number;
}

export interface RateLimitOptionsWithKeyFn {
  /** Function to extract the rate limit key from the request */
  key: (request: Request) => string | Promise<string>;
  /** Maximum number of requests allowed within the window */
  limit: number;
  /** Time window in seconds */
  window: number;
}

// --- Default Rate Limit Configurations ---

/**
 * Predefined rate limit configurations for common endpoints.
 * These can be used directly or as templates.
 */
export const RATE_LIMITS = {
  /** Run SEO checks - resource intensive, 10 req/min per client */
  AUDIT_RUN_CHECKS: {
    limit: 10,
    window: 60,
    keyPrefix: "ratelimit:audit:run-checks:",
  },
  /** Content validation - 10 req/min per client */
  CONTENT_VALIDATE: {
    limit: 10,
    window: 60,
    keyPrefix: "ratelimit:seo:content:validate:",
  },
  /** Link suggestions - lighter operation, 30 req/min per client */
  LINK_SUGGESTIONS: {
    limit: 30,
    window: 60,
    keyPrefix: "ratelimit:seo:links:suggestions:",
  },
  /** Default rate limit for unspecified endpoints */
  DEFAULT: {
    limit: 60,
    window: 60,
    keyPrefix: "ratelimit:default:",
  },
  /** Authentication - login, signup, token refresh */
  AUTH: {
    limit: 10,
    window: 60,
    keyPrefix: "ratelimit:auth:",
  },
  /** Password reset - very strict to prevent abuse */
  PASSWORD_RESET: {
    limit: 3,
    window: 300, // 5 minutes
    keyPrefix: "ratelimit:auth:password-reset:",
  },
  /** Signup - prevent enumeration attacks */
  SIGNUP: {
    limit: 5,
    window: 300, // 5 minutes
    keyPrefix: "ratelimit:auth:signup:",
  },
  /** API key generation - strict limits */
  API_KEY_GENERATE: {
    limit: 5,
    window: 60,
    keyPrefix: "ratelimit:auth:api-key:",
  },
  /** Content generation - AI operations, resource intensive */
  CONTENT_GENERATE: {
    limit: 20,
    window: 60,
    keyPrefix: "ratelimit:content:generate:",
  },
  /** Brief generation - AI operations */
  BRIEF_GENERATE: {
    limit: 10,
    window: 60,
    keyPrefix: "ratelimit:brief:generate:",
  },
  /** Keyword enrichment - external API calls */
  KEYWORD_ENRICH: {
    limit: 30,
    window: 60,
    keyPrefix: "ratelimit:keyword:enrich:",
  },
  /** SERP analysis - external API calls */
  SERP_ANALYZE: {
    limit: 20,
    window: 60,
    keyPrefix: "ratelimit:serp:analyze:",
  },
  /** Admin endpoints - strict limits to prevent abuse */
  ADMIN: {
    limit: 10,
    window: 60,
    keyPrefix: "ratelimit:admin:",
  },
} as const;

// --- Redis Key Helpers ---

const RATE_LIMIT_PREFIX = "ratelimit:";

/**
 * Generate the Redis key for a rate limit bucket.
 */
function buildRedisKey(key: string): string {
  // Avoid double-prefixing if key already starts with ratelimit:
  if (key.startsWith(RATE_LIMIT_PREFIX)) {
    return key;
  }
  return `${RATE_LIMIT_PREFIX}${key}`;
}

// --- Sliding Window Rate Limiter ---

/**
 * Lua script for atomic rate limiting.
 * Performs cleanup, count check, and conditional add in a single atomic operation.
 *
 * KEYS[1] = rate limit key
 * ARGV[1] = current timestamp (ms)
 * ARGV[2] = window size (ms)
 * ARGV[3] = limit
 * ARGV[4] = unique entry ID
 *
 * Returns: [allowed (0/1), current_count, limit, oldest_timestamp_or_0]
 *
 * Note: redis.call('eval', ...) is the standard Redis Lua script execution method,
 * NOT JavaScript eval(). Lua scripts execute atomically on the Redis server.
 */
const RATE_LIMIT_LUA_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local entry_id = ARGV[4]

-- Remove expired entries
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- Count current entries
local count = redis.call('ZCARD', key)

-- Check if at or over limit
if count >= limit then
  -- Get oldest entry for retry-after calculation
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local oldest_ts = 0
  if oldest and #oldest >= 2 then
    oldest_ts = tonumber(oldest[2])
  end
  return {0, count, limit, oldest_ts}
end

-- Under limit - add new entry atomically
redis.call('ZADD', key, now, entry_id)
redis.call('EXPIRE', key, math.ceil(window / 1000) + 10)

return {1, count + 1, limit, 0}
`;

/**
 * Execute the rate limit Lua script atomically on Redis.
 * This wrapper provides type safety and handles the Redis eval call.
 */
async function executeRateLimitScript(
  redisKey: string,
  now: number,
  windowMs: number,
  limit: number,
  entryId: string
): Promise<[number, number, number, number]> {
  // Redis eval executes Lua scripts atomically on the server
  // This is NOT JavaScript eval - it's the standard ioredis method for Lua scripts
  const result = await redis.eval(
    RATE_LIMIT_LUA_SCRIPT,
    1,
    redisKey,
    now.toString(),
    windowMs.toString(),
    limit.toString(),
    entryId
  );
  return result as [number, number, number, number];
}

/**
 * Check and update rate limit using sliding window algorithm.
 *
 * Uses a Lua script for atomic operations to prevent race conditions
 * where multiple concurrent requests could all pass the count check
 * before any of them add their entry.
 *
 * @param options - Rate limit configuration
 * @returns Rate limit result with allowed status and remaining capacity
 */
export async function rateLimit(
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { key, limit, window } = options;
  const redisKey = buildRedisKey(key);
  const now = Date.now();
  const windowMs = window * 1000;

  // Generate unique entry ID with timestamp and random suffix
  const entryId = `${now}:${crypto.randomUUID()}`;

  try {
    // Execute Lua script for atomic rate limiting
    const [allowed, currentCount, maxLimit, oldestTimestamp] =
      await executeRateLimitScript(redisKey, now, windowMs, limit, entryId);

    if (allowed === 0) {
      // Calculate retry-after from oldest entry
      let retryAfter = window;
      if (oldestTimestamp > 0) {
        retryAfter = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
        retryAfter = Math.max(1, Math.min(retryAfter, window));
      }

      log.warn("Rate limit exceeded", {
        key: redisKey,
        current: currentCount,
        limit: maxLimit,
        retryAfter,
      });

      return {
        allowed: false,
        remaining: 0,
        retryAfter,
        limit: maxLimit,
        current: currentCount,
      };
    }

    const remaining = Math.max(0, maxLimit - currentCount);

    log.debug("Rate limit check passed", {
      key: redisKey,
      current: currentCount,
      remaining,
      limit: maxLimit,
    });

    return {
      allowed: true,
      remaining,
      limit: maxLimit,
      current: currentCount,
    };
  } catch (error) {
    // HIGH-05 FIX: Fail closed on Redis errors in production
    // This prevents brute force attacks during Redis outages
    log.error(
      "Rate limit check failed - failing closed",
      error instanceof Error ? error : new Error(String(error)),
      { key: redisKey }
    );

    if (process.env.NODE_ENV === "production") {
      // In production: fail closed to prevent abuse during outages
      return {
        allowed: false,
        remaining: 0,
        retryAfter: 60, // Ask client to retry in 60 seconds
        limit,
        current: limit, // Report as at limit
      };
    }

    // In development/test: fail open with warning for easier debugging
    log.warn("Rate limit Redis unavailable - allowing request in non-production");
    return {
      allowed: true,
      remaining: limit,
      limit,
      current: 0,
    };
  }
}

// --- Rate Limit Response Helpers ---

/**
 * Create a 429 Too Many Requests response with standard headers.
 */
export function rateLimitExceededResponse(result: RateLimitResult): Response {
  const headers = new Headers({
    "Content-Type": "application/json",
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": "0",
    "X-RateLimit-Reset": (
      Math.floor(Date.now() / 1000) + (result.retryAfter ?? 60)
    ).toString(),
    "Retry-After": (result.retryAfter ?? 60).toString(),
  });

  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      message: `Too many requests. Please retry after ${result.retryAfter ?? 60} seconds.`,
      retryAfter: result.retryAfter ?? 60,
    }),
    {
      status: 429,
      headers,
    }
  );
}

/**
 * Add rate limit headers to a successful response.
 */
export function addRateLimitHeaders(
  response: Response,
  result: RateLimitResult
): Response {
  const newHeaders = new Headers(response.headers);
  newHeaders.set("X-RateLimit-Limit", result.limit.toString());
  newHeaders.set("X-RateLimit-Remaining", result.remaining.toString());

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// --- Route Handler Wrapper ---

/**
 * Handler function type for route handlers.
 */
export type RouteHandler = (request: Request) => Promise<Response>;

/**
 * Wrap a route handler with rate limiting.
 *
 * @param options - Rate limit configuration with key function
 * @param handler - The route handler to wrap
 * @returns Wrapped handler that enforces rate limits
 *
 * @example
 * ```ts
 * export const POST = withRateLimit(
 *   {
 *     key: (req) => {
 *       const url = new URL(req.url);
 *       const clientId = url.searchParams.get("clientId") ?? "anonymous";
 *       return `audit:${clientId}`;
 *     },
 *     limit: 10,
 *     window: 60,
 *   },
 *   async (request) => {
 *     // Your handler logic here
 *     return Response.json({ success: true });
 *   }
 * );
 * ```
 */
export function withRateLimit(
  options: RateLimitOptionsWithKeyFn,
  handler: RouteHandler
): RouteHandler {
  return async (request: Request): Promise<Response> => {
    // Extract the key
    const key = await Promise.resolve(options.key(request));

    // Check rate limit
    const result = await rateLimit({
      key,
      limit: options.limit,
      window: options.window,
    });

    if (!result.allowed) {
      return rateLimitExceededResponse(result);
    }

    // Execute the handler
    const response = await handler(request);

    // Add rate limit headers to successful responses
    return addRateLimitHeaders(response, result);
  };
}

// --- Utility Functions ---

/**
 * Extract client ID from request for rate limiting.
 * Tries multiple sources: header, query param, body.
 */
export async function extractClientIdFromRequest(
  request: Request
): Promise<string> {
  // 1. Try X-Client-ID header
  const headerClientId = request.headers.get("X-Client-ID");
  if (headerClientId) {
    return headerClientId;
  }

  // 2. Try query parameter
  const url = new URL(request.url);
  const queryClientId = url.searchParams.get("clientId");
  if (queryClientId) {
    return queryClientId;
  }

  // 3. Try request body for POST requests (clone to avoid consuming body)
  if (request.method === "POST") {
    try {
      const clonedRequest = request.clone();
      const body = (await clonedRequest.json()) as Record<string, unknown>;
      if (body && typeof body.clientId === "string") {
        return body.clientId;
      }
    } catch {
      // Body parsing failed, fall through
    }
  }

  // 4. Fallback to IP address or "anonymous"
  const forwarded = request.headers.get("X-Forwarded-For");
  if (forwarded) {
    return `ip:${forwarded.split(",")[0].trim()}`;
  }

  return "anonymous";
}

/**
 * Create a rate limiter for a specific endpoint configuration.
 * Returns a function that only needs the client ID.
 */
export function createEndpointRateLimiter(config: {
  keyPrefix: string;
  limit: number;
  window: number;
}): (clientId: string) => Promise<RateLimitResult> {
  return (clientId: string) =>
    rateLimit({
      key: `${config.keyPrefix}${clientId}`,
      limit: config.limit,
      window: config.window,
    });
}

// --- Pre-configured Rate Limiters ---

/**
 * Rate limiter for /api/audit/run-checks endpoint.
 * 10 requests per minute per client.
 */
export const auditRunChecksRateLimiter = createEndpointRateLimiter(
  RATE_LIMITS.AUDIT_RUN_CHECKS
);

/**
 * Rate limiter for /api/seo/content/validate endpoint.
 * 10 requests per minute per client.
 */
export const contentValidateRateLimiter = createEndpointRateLimiter(
  RATE_LIMITS.CONTENT_VALIDATE
);

/**
 * Rate limiter for /api/seo/links/suggestions endpoint.
 * 30 requests per minute per client.
 */
export const linkSuggestionsRateLimiter = createEndpointRateLimiter(
  RATE_LIMITS.LINK_SUGGESTIONS
);

/**
 * Rate limiter for authentication endpoints.
 * 10 requests per minute per IP.
 */
export const authRateLimiter = createEndpointRateLimiter(RATE_LIMITS.AUTH);

/**
 * Rate limiter for password reset.
 * 3 requests per 5 minutes per IP.
 */
export const passwordResetRateLimiter = createEndpointRateLimiter(
  RATE_LIMITS.PASSWORD_RESET
);

/**
 * Rate limiter for signup.
 * 5 requests per 5 minutes per IP.
 */
export const signupRateLimiter = createEndpointRateLimiter(RATE_LIMITS.SIGNUP);

/**
 * Rate limiter for content generation.
 * 20 requests per minute per client.
 */
export const contentGenerateRateLimiter = createEndpointRateLimiter(
  RATE_LIMITS.CONTENT_GENERATE
);

/**
 * Rate limiter for brief generation.
 * 10 requests per minute per client.
 */
export const briefGenerateRateLimiter = createEndpointRateLimiter(
  RATE_LIMITS.BRIEF_GENERATE
);

/**
 * Rate limiter for keyword enrichment.
 * 30 requests per minute per client.
 */
export const keywordEnrichRateLimiter = createEndpointRateLimiter(
  RATE_LIMITS.KEYWORD_ENRICH
);

/**
 * Rate limiter for SERP analysis.
 * 20 requests per minute per client.
 */
export const serpAnalyzeRateLimiter = createEndpointRateLimiter(
  RATE_LIMITS.SERP_ANALYZE
);

/**
 * Rate limiter for admin endpoints.
 * 10 requests per minute per user.
 * Phase 72-03: SaaS Readiness - Admin endpoint protection.
 */
export const adminRateLimiter = createEndpointRateLimiter(RATE_LIMITS.ADMIN);

// --- Phase 96-Security: Scraping Admin Rate Limiters ---

/**
 * Scraping admin rate limit configurations.
 * Tiered limits based on operation severity.
 */
export const SCRAPING_ADMIN_RATE_LIMITS = {
  /** Critical operations (emergency-stop, resume) - 2 req/min */
  CRITICAL_OPS: {
    limit: 2,
    window: 60,
    keyPrefix: "ratelimit:scraping:admin:critical:",
  },
  /** State change operations (migration advance/rollback) - 5 req/min */
  STATE_CHANGE: {
    limit: 5,
    window: 60,
    keyPrefix: "ratelimit:scraping:admin:state:",
  },
  /** Resource intensive operations (cache warm, domain reset) - 10 req/min */
  RESOURCE_INTENSIVE: {
    limit: 10,
    window: 60,
    keyPrefix: "ratelimit:scraping:admin:resource:",
  },
  /** General admin operations (metrics, status) - 30 req/min */
  GENERAL_ADMIN: {
    limit: 30,
    window: 60,
    keyPrefix: "ratelimit:scraping:admin:general:",
  },
  /** Circuit breaker operations - 5 req/min */
  CIRCUIT_OPS: {
    limit: 5,
    window: 60,
    keyPrefix: "ratelimit:scraping:admin:circuit:",
  },
} as const;

/**
 * Rate limiter for critical scraping operations.
 * 2 requests per minute per IP.
 * Phase 96-Security: Prevent DoS on emergency controls.
 */
export const scrapingCriticalOpsRateLimiter = createEndpointRateLimiter(
  SCRAPING_ADMIN_RATE_LIMITS.CRITICAL_OPS
);

/**
 * Rate limiter for state change operations.
 * 5 requests per minute per IP.
 * Phase 96-Security: Migration advance/rollback protection.
 */
export const scrapingStateChangeRateLimiter = createEndpointRateLimiter(
  SCRAPING_ADMIN_RATE_LIMITS.STATE_CHANGE
);

/**
 * Rate limiter for resource intensive operations.
 * 10 requests per minute per IP.
 * Phase 96-Security: Cache warming, domain reset protection.
 */
export const scrapingResourceIntensiveRateLimiter = createEndpointRateLimiter(
  SCRAPING_ADMIN_RATE_LIMITS.RESOURCE_INTENSIVE
);

/**
 * Rate limiter for general admin operations.
 * 30 requests per minute per IP.
 * Phase 96-Security: Read-only admin endpoints.
 */
export const scrapingGeneralAdminRateLimiter = createEndpointRateLimiter(
  SCRAPING_ADMIN_RATE_LIMITS.GENERAL_ADMIN
);

/**
 * Rate limiter for circuit breaker operations.
 * 5 requests per minute per IP.
 * Phase 96-Security: Circuit reset/open/close protection.
 */
export const scrapingCircuitOpsRateLimiter = createEndpointRateLimiter(
  SCRAPING_ADMIN_RATE_LIMITS.CIRCUIT_OPS
);

// --- Express Middleware Wrappers ---

/**
 * Extract IP from Express request for rate limiting.
 */
function extractIpFromExpressRequest(req: {
  ip?: string;
  headers: { [key: string]: string | string[] | undefined };
}): string {
  // Try X-Forwarded-For header first (common for proxied requests)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(",")[0];
    return ip.trim();
  }
  // Fall back to req.ip
  return req.ip ?? "unknown";
}

/**
 * Create Express middleware for rate limiting.
 * Returns middleware that checks rate limits and returns 429 if exceeded.
 *
 * @param rateLimiter - Rate limiter function from createEndpointRateLimiter
 * @param errorMessage - Custom error message for rate limit exceeded
 * @returns Express middleware function
 *
 * @example
 * ```typescript
 * import { createExpressRateLimitMiddleware, scrapingCriticalOpsRateLimiter } from '../../../middleware/rate-limit';
 *
 * const criticalRateLimit = createExpressRateLimitMiddleware(
 *   scrapingCriticalOpsRateLimiter,
 *   'Too many critical operation requests'
 * );
 *
 * router.post('/emergency-stop', criticalRateLimit, requireAdmin, handler);
 * ```
 */
export function createExpressRateLimitMiddleware(
  rateLimiter: (key: string) => Promise<RateLimitResult>,
  errorMessage = "Too many requests"
): (
  req: { ip?: string; headers: { [key: string]: string | string[] | undefined } },
  res: { status: (code: number) => { json: (body: unknown) => void }; set: (name: string, value: string) => void },
  next: () => void
) => Promise<void> {
  return async (req, res, next): Promise<void> => {
    const ip = extractIpFromExpressRequest(req);
    const result = await rateLimiter(ip);

    // Set rate limit headers
    res.set("X-RateLimit-Limit", result.limit.toString());
    res.set("X-RateLimit-Remaining", result.remaining.toString());

    if (!result.allowed) {
      res.set("Retry-After", (result.retryAfter ?? 60).toString());
      res.set(
        "X-RateLimit-Reset",
        (Math.floor(Date.now() / 1000) + (result.retryAfter ?? 60)).toString()
      );
      res.status(429).json({
        error: errorMessage,
        message: `Rate limit exceeded. Please retry after ${result.retryAfter ?? 60} seconds.`,
        retryAfter: result.retryAfter ?? 60,
      });
      return;
    }

    next();
  };
}

// --- Pre-built Express Rate Limit Middleware ---

/**
 * Express middleware for critical scraping operations (2 req/min).
 * Use for: emergency-stop, resume
 */
export const expressScrapingCriticalRateLimit = createExpressRateLimitMiddleware(
  scrapingCriticalOpsRateLimiter,
  "Too many critical operation requests"
);

/**
 * Express middleware for state change operations (5 req/min).
 * Use for: migration advance, rollback
 */
export const expressScrapingStateChangeRateLimit = createExpressRateLimitMiddleware(
  scrapingStateChangeRateLimiter,
  "Too many state change requests"
);

/**
 * Express middleware for resource intensive operations (10 req/min).
 * Use for: cache warm, domain reset, queue drain, cache invalidate
 */
export const expressScrapingResourceIntensiveRateLimit = createExpressRateLimitMiddleware(
  scrapingResourceIntensiveRateLimiter,
  "Too many resource-intensive requests"
);

/**
 * Express middleware for general admin operations (30 req/min).
 * Use for: read-only endpoints, metrics, status
 */
export const expressScrapingGeneralAdminRateLimit = createExpressRateLimitMiddleware(
  scrapingGeneralAdminRateLimiter,
  "Too many admin requests"
);

/**
 * Express middleware for circuit breaker operations (5 req/min).
 * Use for: circuit reset, open, close
 */
export const expressScrapingCircuitOpsRateLimit = createExpressRateLimitMiddleware(
  scrapingCircuitOpsRateLimiter,
  "Too many circuit breaker requests"
);

// --- Phase 96: Portal Rate Limiters ---

/**
 * Portal rate limit configurations.
 * Keyed by clientId to give each client their own quota.
 */
export const PORTAL_RATE_LIMITS = {
  /** Standard portal endpoints - 60 req/min per client */
  STANDARD: {
    limit: 60,
    window: 60,
    keyPrefix: "ratelimit:portal:standard:",
  },
  /** Expensive portal analytics operations - 30 req/min per client */
  EXPENSIVE: {
    limit: 30,
    window: 60,
    keyPrefix: "ratelimit:portal:expensive:",
  },
  /** Batch/export portal operations - 10 req/min per client */
  BATCH: {
    limit: 10,
    window: 60,
    keyPrefix: "ratelimit:portal:batch:",
  },
  /** Portal export operations - 5 req/hour per client (strict limit for file downloads) */
  EXPORT: {
    limit: 5,
    window: 3600, // 1 hour in seconds
    keyPrefix: "ratelimit:portal:export:",
  },
} as const;

/**
 * Rate limiter for standard portal endpoints.
 * 60 requests per minute per client.
 * Phase 96: Portal rate limiting by clientId.
 */
export const portalStandardRateLimiter = createEndpointRateLimiter(
  PORTAL_RATE_LIMITS.STANDARD
);

/**
 * Rate limiter for expensive portal analytics operations.
 * 30 requests per minute per client.
 * Phase 96: Portal analytics rate limiting (trends, cannibalization, striking distance).
 */
export const portalExpensiveRateLimiter = createEndpointRateLimiter(
  PORTAL_RATE_LIMITS.EXPENSIVE
);

/**
 * Rate limiter for portal batch/export operations.
 * 10 requests per minute per client.
 * Phase 96: Portal export and bulk operations.
 */
export const portalBatchRateLimiter = createEndpointRateLimiter(
  PORTAL_RATE_LIMITS.BATCH
);

/**
 * Rate limiter for portal file export operations.
 * 5 requests per hour per client.
 * Phase 96-05: Portal analytics export (CSV/PDF download).
 */
export const portalExportRateLimiter = createEndpointRateLimiter(
  PORTAL_RATE_LIMITS.EXPORT
);

// --- Phase 96: Analytics Rate Limiters ---

/**
 * Analytics rate limit configurations.
 */
export const ANALYTICS_RATE_LIMITS = {
  /** Standard analytics endpoints - 60 req/min per workspace */
  STANDARD: {
    limit: 60,
    window: 60,
    keyPrefix: "ratelimit:analytics:standard:",
  },
  /** Expensive analytics operations - 30 req/min per workspace */
  EXPENSIVE: {
    limit: 30,
    window: 60,
    keyPrefix: "ratelimit:analytics:expensive:",
  },
  /** Batch operations - 100 req/hour per workspace */
  BATCH: {
    limit: 100,
    window: 3600,
    keyPrefix: "ratelimit:analytics:batch:",
  },
  /** Export operations - 10 req/hour per workspace */
  EXPORT: {
    limit: 10,
    window: 3600,
    keyPrefix: "ratelimit:analytics:export:",
  },
  /** Sync trigger operations - 5 req/hour per workspace */
  SYNC: {
    limit: 5,
    window: 3600,
    keyPrefix: "ratelimit:analytics:sync:",
  },
} as const;

/**
 * Rate limiter for standard analytics endpoints.
 * 60 requests per minute per workspace.
 * Phase 96-03: Analytics rate limiting.
 */
export const analyticsStandardRateLimiter = createEndpointRateLimiter(
  ANALYTICS_RATE_LIMITS.STANDARD
);

/**
 * Rate limiter for expensive analytics operations.
 * 30 requests per minute per workspace.
 * Phase 96-03: Trend detection, cannibalization analysis.
 */
export const analyticsExpensiveRateLimiter = createEndpointRateLimiter(
  ANALYTICS_RATE_LIMITS.EXPENSIVE
);

/**
 * Rate limiter for batch analytics operations.
 * 100 requests per hour per workspace.
 * Phase 96-04: Batch indexing requests.
 */
export const analyticsBatchRateLimiter = createEndpointRateLimiter(
  ANALYTICS_RATE_LIMITS.BATCH
);

/**
 * Rate limiter for export operations.
 * 10 requests per hour per workspace.
 * Phase 96-03: CSV/JSON data exports.
 */
export const analyticsExportRateLimiter = createEndpointRateLimiter(
  ANALYTICS_RATE_LIMITS.EXPORT
);

/**
 * Rate limiter for sync trigger operations.
 * 5 requests per hour per workspace.
 * Phase 96-security: Prevent GSC/GA4 API quota exhaustion.
 */
export const analyticsSyncRateLimiter = createEndpointRateLimiter(
  ANALYTICS_RATE_LIMITS.SYNC
);

// --- Testing Utilities ---

/**
 * Reset a rate limit key. Use only in tests.
 */
export async function resetRateLimit(key: string): Promise<void> {
  const redisKey = buildRedisKey(key);
  await redis.del(redisKey);
}

/**
 * Get current rate limit status without incrementing.
 * Useful for debugging and monitoring.
 */
export async function getRateLimitStatus(
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const { key, limit, window } = options;
  const redisKey = buildRedisKey(key);
  const now = Date.now();
  const windowStart = now - window * 1000;

  try {
    // Remove expired and count
    await redis.zremrangebyscore(redisKey, 0, windowStart);
    const currentCount = await redis.zcard(redisKey);

    const remaining = Math.max(0, limit - currentCount);

    return {
      allowed: currentCount < limit,
      remaining,
      limit,
      current: currentCount,
    };
  } catch (error) {
    log.error(
      "Rate limit status check failed",
      error instanceof Error ? error : new Error(String(error)),
      { key: redisKey }
    );

    return {
      allowed: true,
      remaining: limit,
      limit,
      current: 0,
    };
  }
}
