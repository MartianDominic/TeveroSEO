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
 * Check and update rate limit using sliding window algorithm.
 *
 * Uses Redis sorted sets to track request timestamps within the window.
 * This provides more accurate rate limiting than fixed windows.
 *
 * Algorithm:
 * 1. Remove expired entries (older than window)
 * 2. Count current entries
 * 3. If under limit, add new entry with current timestamp
 * 4. Return result with remaining capacity
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
  const windowStart = now - window * 1000;

  try {
    // Use a pipeline for atomic operations
    const pipeline = redis.pipeline();

    // 1. Remove entries older than the window
    pipeline.zremrangebyscore(redisKey, 0, windowStart);

    // 2. Count current entries
    pipeline.zcard(redisKey);

    // Execute the pipeline
    const results = await pipeline.exec();

    if (!results) {
      throw new Error("Redis pipeline returned null");
    }

    // Extract count from results: [error, result][]
    const countResult = results[1];
    if (countResult[0]) {
      throw countResult[0];
    }
    const currentCount = (countResult[1] as number) ?? 0;

    // 3. Check if request is allowed
    if (currentCount >= limit) {
      // Get the oldest entry to calculate retry-after
      const oldestEntries = await redis.zrange(redisKey, 0, 0, "WITHSCORES");
      let retryAfter = window;

      if (oldestEntries.length >= 2) {
        const oldestTimestamp = parseInt(oldestEntries[1], 10);
        retryAfter = Math.ceil((oldestTimestamp + window * 1000 - now) / 1000);
        retryAfter = Math.max(1, Math.min(retryAfter, window));
      }

      log.warn("Rate limit exceeded", {
        key: redisKey,
        current: currentCount,
        limit,
        retryAfter,
      });

      return {
        allowed: false,
        remaining: 0,
        retryAfter,
        limit,
        current: currentCount,
      };
    }

    // 4. Add new entry with current timestamp as score
    // Use timestamp + random suffix to avoid collisions
    const entryId = `${now}:${Math.random().toString(36).slice(2, 8)}`;
    await redis.zadd(redisKey, now, entryId);

    // 5. Set TTL on the key to auto-cleanup
    await redis.expire(redisKey, window + 10);

    const newCount = currentCount + 1;
    const remaining = Math.max(0, limit - newCount);

    log.debug("Rate limit check passed", {
      key: redisKey,
      current: newCount,
      remaining,
      limit,
    });

    return {
      allowed: true,
      remaining,
      limit,
      current: newCount,
    };
  } catch (error) {
    // On Redis errors, fail open (allow the request) but log the error
    log.error(
      "Rate limit check failed",
      error instanceof Error ? error : new Error(String(error)),
      { key: redisKey }
    );

    // Fail open - allow request but report degraded state
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
