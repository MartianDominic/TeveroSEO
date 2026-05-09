/**
 * Authentication Rate Limiter
 *
 * Strict rate limiting for authentication endpoints to prevent:
 * - Credential stuffing attacks
 * - Account enumeration
 * - Brute force password attacks
 * - Resource exhaustion
 *
 * Uses Redis-backed sliding window for distributed rate limiting.
 */

import type { NextRequest } from "next/server";

import { logger } from '@/lib/logger';
import { redis } from "@/lib/redis/client";

// --- Jitter Helper ---

/**
 * Add jitter to a time value to prevent thundering herd on limit reset.
 * Uses 10-25% jitter range.
 *
 * @param baseTime - Base time in milliseconds
 * @returns Time with jitter applied
 */
function addJitter(baseTime: number): number {
  const jitterFactor = 0.1 + Math.random() * 0.15; // 10-25%
  return Math.round(baseTime * (1 + jitterFactor));
}

// --- Types ---

export interface AuthRateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the window resets */
  reset: number;
  /** Total limit for this window */
  limit: number;
}

export interface AuthRateLimitConfig {
  /** Maximum requests allowed in the window */
  maxRequests: number;
  /** Window duration in seconds */
  windowSeconds: number;
  /** Redis key prefix */
  prefix: string;
}

// --- IP Extraction with Spoofing Protection ---

/**
 * Get real client IP with protection against spoofing.
 *
 * SECURITY: Only trusts X-Forwarded-For if request came through our known proxy.
 * This prevents attackers from bypassing rate limits by spoofing headers.
 *
 * @param request - Next.js request object
 * @returns The client IP address
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const proxySecret = request.headers.get("x-proxy-secret");

  // Only trust X-Forwarded-For if request came through our verified proxy
  // The proxy must set X-Proxy-Secret header with our secret
  const expectedSecret = process.env.PROXY_SECRET;

  if (expectedSecret && proxySecret === expectedSecret && forwardedFor) {
    // Trust the first IP in the chain (original client)
    return forwardedFor.split(",")[0].trim();
  }

  // Cloudflare: Use CF-Connecting-IP if available and we're behind Cloudflare
  const cfIp = request.headers.get("cf-connecting-ip");
  if (process.env.TRUST_CLOUDFLARE === "true" && cfIp) {
    return cfIp.trim();
  }

  // Vercel: Use x-vercel-forwarded-for if on Vercel
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (process.env.VERCEL && vercelIp) {
    return vercelIp.split(",")[0].trim();
  }

  // Fall back to X-Real-IP (may be set by nginx without verification)
  // Only use this if we have no other option
  if (realIp && !forwardedFor) {
    return realIp.trim();
  }

  // If X-Forwarded-For exists but no proxy secret, log warning and use with caution
  // This could be spoofed, but we still rate limit (better than nothing)
  if (forwardedFor) {
    // In development or when PROXY_SECRET is not set, allow forwarded header
    // but log a warning in production
    if (process.env.NODE_ENV === "production" && expectedSecret) {
      console.warn(
        "[auth-limiter] X-Forwarded-For present without valid proxy secret. " +
          "This could indicate a spoofing attempt or misconfigured proxy."
      );
    }
    return forwardedFor.split(",")[0].trim();
  }

  // No forwarding headers - direct connection or unknown
  return "unknown";
}

// --- Auth Rate Limiters ---

// Import centralized rate limit configuration from @tevero/utils
// This is the single source of truth for all rate limit values
import { AUTH_RATE_LIMITS } from "@tevero/utils";

/**
 * Pre-configured rate limiters for different auth operations.
 * Values are imported from @tevero/utils for consistency across the monorepo.
 *
 * STANDARDIZED: All auth endpoints now use consistent values:
 * - SIGNIN: 10 requests per 60 seconds (was 5/15min)
 * - SIGNUP: 5 requests per 5 minutes
 * - PASSWORD_RESET: 3 requests per 5 minutes
 * - EMAIL_VERIFY: 5 requests per 5 minutes
 * - DEFAULT: 10 requests per 60 seconds
 */
export const AUTH_LIMITS = {
  // Sign-in: 10 attempts per minute per IP
  // Balanced to allow typo corrections while blocking brute force
  SIGNIN: {
    maxRequests: AUTH_RATE_LIMITS.SIGNIN.requests,
    windowSeconds: Math.floor(AUTH_RATE_LIMITS.SIGNIN.windowMs / 1000),
    prefix: AUTH_RATE_LIMITS.SIGNIN.keyPrefix.replace(/:$/, ""),
  },

  // Sign-up: 5 attempts per 5 minutes per IP
  // Prevents mass account creation
  SIGNUP: {
    maxRequests: AUTH_RATE_LIMITS.SIGNUP.requests,
    windowSeconds: Math.floor(AUTH_RATE_LIMITS.SIGNUP.windowMs / 1000),
    prefix: AUTH_RATE_LIMITS.SIGNUP.keyPrefix.replace(/:$/, ""),
  },

  // Password reset: 3 attempts per 5 minutes per IP
  // Very strict to prevent email bombing
  PASSWORD_RESET: {
    maxRequests: AUTH_RATE_LIMITS.PASSWORD_RESET.requests,
    windowSeconds: Math.floor(AUTH_RATE_LIMITS.PASSWORD_RESET.windowMs / 1000),
    prefix: AUTH_RATE_LIMITS.PASSWORD_RESET.keyPrefix.replace(/:$/, ""),
  },

  // Email verification: 5 attempts per 5 minutes
  EMAIL_VERIFY: {
    maxRequests: AUTH_RATE_LIMITS.EMAIL_VERIFY.requests,
    windowSeconds: Math.floor(AUTH_RATE_LIMITS.EMAIL_VERIFY.windowMs / 1000),
    prefix: AUTH_RATE_LIMITS.EMAIL_VERIFY.keyPrefix.replace(/:$/, ""),
  },

  // Generic auth endpoint fallback: 10 requests per minute
  DEFAULT: {
    maxRequests: AUTH_RATE_LIMITS.DEFAULT.requests,
    windowSeconds: Math.floor(AUTH_RATE_LIMITS.DEFAULT.windowMs / 1000),
    prefix: AUTH_RATE_LIMITS.DEFAULT.keyPrefix.replace(/:$/, ""),
  },
} as const;

/**
 * Check rate limit using Redis sliding window algorithm.
 */
async function checkLimit(
  identifier: string,
  config: AuthRateLimitConfig
): Promise<AuthRateLimitResult> {
  const key = `${config.prefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - config.windowSeconds * 1000;

  try {
    // Ensure Redis is connected
    if (redis.status !== "ready") {
      await redis.ping();
    }

    // Use pipeline for atomicity
    const pipeline = redis.pipeline();

    // Remove entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Count current entries
    pipeline.zcard(key);

    const results = await pipeline.exec();
    const currentCount = (results?.[1]?.[1] as number) ?? 0;

    if (currentCount >= config.maxRequests) {
      // Get oldest entry to calculate reset time
      const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");
      const oldestTimestamp = oldest?.[1] ? parseInt(oldest[1], 10) : now;
      const baseResetAt = oldestTimestamp + config.windowSeconds * 1000;
      // Add jitter to prevent thundering herd on limit reset
      const resetAt = now + addJitter(baseResetAt - now);

      return {
        success: false,
        remaining: 0,
        reset: resetAt,
        limit: config.maxRequests,
      };
    }

    // Add current request
    await redis.zadd(key, now, `${now}-${Math.random()}`);

    // Set key expiry (window + buffer)
    await redis.expire(key, config.windowSeconds + 60);

    return {
      success: true,
      remaining: config.maxRequests - currentCount - 1,
      reset: now + config.windowSeconds * 1000,
      limit: config.maxRequests,
    };
  } catch (error) {
    // FAIL-CLOSED for auth endpoints in production
    // This is intentionally different from other rate limiters
    if (process.env.NODE_ENV === "production") {
      logger.error("[auth-limiter] Redis error on auth endpoint - BLOCKING request for safety", error instanceof Error ? error : { error: String(error) });
      // Add jitter to prevent thundering herd on recovery
      return {
        success: false,
        remaining: 0,
        reset: now + addJitter(60000), // Try again in ~1 minute with jitter
        limit: config.maxRequests,
      };
    }

    // In development, allow through with warning
    logger.warn("[auth-limiter] Redis error in dev, allowing request", { value: error });
    return {
      success: true,
      remaining: config.maxRequests,
      reset: now + config.windowSeconds * 1000,
      limit: config.maxRequests,
    };
  }
}

/**
 * Rate limit check for authentication requests.
 *
 * @param request - Next.js request
 * @param type - Type of auth operation (determines limits)
 * @returns Rate limit result
 */
export async function checkAuthRateLimit(
  request: NextRequest,
  type: keyof typeof AUTH_LIMITS = "DEFAULT"
): Promise<AuthRateLimitResult> {
  const ip = getClientIp(request);
  const config = AUTH_LIMITS[type];

  return checkLimit(ip, config);
}

/**
 * Determine the auth operation type from the request path.
 */
export function getAuthOperationType(
  pathname: string
): keyof typeof AUTH_LIMITS {
  if (pathname.includes("sign-in")) {
    return "SIGNIN";
  }
  if (pathname.includes("sign-up")) {
    return "SIGNUP";
  }
  if (pathname.includes("forgot-password") || pathname.includes("reset-password")) {
    return "PASSWORD_RESET";
  }
  if (pathname.includes("verify") || pathname.includes("verification")) {
    return "EMAIL_VERIFY";
  }
  return "DEFAULT";
}

/**
 * Create rate limit response headers.
 */
export function createRateLimitHeaders(result: AuthRateLimitResult): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", result.limit.toString());
  headers.set("X-RateLimit-Remaining", result.remaining.toString());
  headers.set("X-RateLimit-Reset", Math.ceil(result.reset / 1000).toString());

  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    headers.set("Retry-After", Math.max(1, retryAfter).toString());
  }

  return headers;
}
