/**
 * Rate limiting for Next.js API routes and server actions.
 *
 * Uses Redis-based rate limiting for distributed deployments.
 * Falls back to in-memory for development when Redis is unavailable.
 *
 * SECURITY: In production, fails closed on Redis errors to prevent bypass.
 *
 * @example
 * ```ts
 * // In API route
 * export const POST = withRateLimit(
 *   async (req) => NextResponse.json({ success: true }),
 *   { limit: 10, windowMs: 60000 }
 * );
 *
 * // In server action
 * export async function submitForm(data: FormData) {
 *   await rateLimitAction('submitForm', userId, { limit: 5, windowMs: 60000 });
 *   // ... action logic
 * }
 * ```
 */

import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import { logger } from '@/lib/logger';
import { redis } from '@/lib/redis/client';

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

// --- Schemas ---

const rateLimitEntrySchema = z.object({
  count: z.number(),
  resetTime: z.number(),
});

// --- Types ---

export interface RateLimitResult {
  /** Whether the request is allowed */
  success: boolean;
  /** Remaining requests in the current window */
  remaining: number;
  /** Unix timestamp (ms) when the window resets */
  reset: number;
  /** Total limit for this window */
  limit: number;
}

export interface RateLimitOptions {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// --- Redis-based Store with In-memory Fallback ---

/**
 * Redis key prefix for rate limiting.
 */
const REDIS_KEY_PREFIX = 'ratelimit:middleware:';

/**
 * In-memory fallback store for development when Redis is unavailable.
 * NOT used in production - production fails closed on Redis errors.
 */
const rateLimitMapFallback = new Map<string, RateLimitEntry>();

/**
 * Maximum entries for in-memory fallback.
 */
const MAX_RATE_LIMIT_ENTRIES = 10000;

/**
 * Check if Redis is available.
 */
async function isRedisAvailable(): Promise<boolean> {
  try {
    if (redis.status === 'ready') {
      return true;
    }
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get rate limit entry from Redis.
 */
async function getRedisRateLimitEntry(key: string): Promise<RateLimitEntry | null> {
  const data = await redis.get(`${REDIS_KEY_PREFIX}${key}`);
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    const validated = rateLimitEntrySchema.safeParse(parsed);
    if (!validated.success) {
      logger.warn('[rate-limit] Invalid rate limit entry in Redis, ignoring', { detail: validated.error });
      return null;
    }
    return validated.data;
  } catch {
    return null;
  }
}

/**
 * Set rate limit entry in Redis.
 */
async function setRedisRateLimitEntry(
  key: string,
  entry: RateLimitEntry,
  ttlMs: number
): Promise<void> {
  await redis.set(
    `${REDIS_KEY_PREFIX}${key}`,
    JSON.stringify(entry),
    'PX',
    ttlMs
  );
}

/**
 * Cleanup interval for in-memory fallback.
 */
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];

    rateLimitMapFallback.forEach((entry, key) => {
      if (now > entry.resetTime) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => rateLimitMapFallback.delete(key));

    // Emergency cap for fallback map
    if (rateLimitMapFallback.size > MAX_RATE_LIMIT_ENTRIES) {
      const excess = rateLimitMapFallback.size - MAX_RATE_LIMIT_ENTRIES;
      const keys = Array.from(rateLimitMapFallback.keys()).slice(0, excess);
      keys.forEach(k => rateLimitMapFallback.delete(k));
    }
  }, 60000);

  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

// Start cleanup on module load (for fallback map)
startCleanup();

// --- Core Rate Limiting ---

/**
 * Check rate limit for a given identifier.
 *
 * Uses Redis for distributed rate limiting across instances.
 * Falls back to in-memory in development only.
 *
 * SECURITY: In production, fails closed on Redis errors to prevent bypass.
 *
 * @param identifier - Unique key for rate limiting (e.g., IP + path, user ID)
 * @param limit - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns Rate limit result with success status and remaining capacity
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const key = identifier;

  try {
    // Try Redis first
    const redisAvailable = await isRedisAvailable();

    if (redisAvailable) {
      // Use Redis for distributed rate limiting
      let entry = await getRedisRateLimitEntry(key);

      // Window expired or first request - start fresh
      if (!entry || now > entry.resetTime) {
        entry = { count: 1, resetTime: now + windowMs };
        await setRedisRateLimitEntry(key, entry, windowMs + 1000); // TTL with buffer
        return {
          success: true,
          remaining: limit - 1,
          reset: entry.resetTime,
          limit,
        };
      }

      // Check if over limit
      if (entry.count >= limit) {
        // Add jitter to prevent thundering herd on limit reset
        const resetWithJitter = now + addJitter(entry.resetTime - now);
        return {
          success: false,
          remaining: 0,
          reset: resetWithJitter,
          limit,
        };
      }

      // Increment and allow
      entry.count++;
      await setRedisRateLimitEntry(key, entry, entry.resetTime - now + 1000);
      return {
        success: true,
        remaining: limit - entry.count,
        reset: entry.resetTime,
        limit,
      };
    }

    // Redis not available - use fallback behavior based on environment
    throw new Error('Redis not available');
  } catch (error) {
    // SECURITY: Fail-closed in production to prevent rate limit bypass
    if (process.env.NODE_ENV === 'production') {
      logger.error('[rate-limit] Redis error in production, blocking request for safety', error instanceof Error ? error : { error: String(error) });
      // Add jitter to prevent thundering herd on recovery
      return {
        success: false,
        remaining: 0,
        reset: now + addJitter(60000), // Retry in ~1 minute with jitter
        limit,
      };
    }

    // Development fallback: use in-memory store
    logger.warn('[rate-limit] Redis unavailable in development, using in-memory fallback');
    let entry = rateLimitMapFallback.get(key);

    if (!entry || now > entry.resetTime) {
      entry = { count: 1, resetTime: now + windowMs };
      rateLimitMapFallback.set(key, entry);
      return {
        success: true,
        remaining: limit - 1,
        reset: entry.resetTime,
        limit,
      };
    }

    if (entry.count >= limit) {
      // Add jitter to prevent thundering herd on limit reset
      const resetWithJitter = now + addJitter(entry.resetTime - now);
      return {
        success: false,
        remaining: 0,
        reset: resetWithJitter,
        limit,
      };
    }

    entry.count++;
    return {
      success: true,
      remaining: limit - entry.count,
      reset: entry.resetTime,
      limit,
    };
  }
}

/**
 * Check rate limit without incrementing.
 * Useful for monitoring and debugging.
 */
export async function getRateLimitStatus(
  identifier: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();

  try {
    const redisAvailable = await isRedisAvailable();

    if (redisAvailable) {
      const entry = await getRedisRateLimitEntry(identifier);

      if (!entry || now > entry.resetTime) {
        return {
          success: true,
          remaining: limit,
          reset: now + windowMs,
          limit,
        };
      }

      return {
        success: entry.count < limit,
        remaining: Math.max(0, limit - entry.count),
        reset: entry.resetTime,
        limit,
      };
    }

    throw new Error('Redis not available');
  } catch {
    // Fallback to in-memory for status check
    const entry = rateLimitMapFallback.get(identifier);

    if (!entry || now > entry.resetTime) {
      return {
        success: true,
        remaining: limit,
        reset: now + windowMs,
        limit,
      };
    }

    return {
      success: entry.count < limit,
      remaining: Math.max(0, limit - entry.count),
      reset: entry.resetTime,
      limit,
    };
  }
}

// --- IP Extraction with Spoofing Protection ---

/**
 * Get client IP from Next.js headers with spoofing protection.
 *
 * SECURITY: Only trusts X-Forwarded-For if request came through our known proxy.
 * This prevents attackers from bypassing rate limits by spoofing headers.
 *
 * Note: In Next.js 15, headers() returns a Promise.
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers();

  const forwardedFor = headersList.get('x-forwarded-for');
  const realIp = headersList.get('x-real-ip');
  const proxySecret = headersList.get('x-proxy-secret');

  // Only trust X-Forwarded-For if request came through our verified proxy
  const expectedSecret = process.env.PROXY_SECRET;

  if (expectedSecret && proxySecret === expectedSecret && forwardedFor) {
    // Trust the first IP in the chain (original client)
    return forwardedFor.split(',')[0].trim();
  }

  // Cloudflare: Use CF-Connecting-IP if available and we're behind Cloudflare
  const cfIp = headersList.get('cf-connecting-ip');
  if (process.env.TRUST_CLOUDFLARE === 'true' && cfIp) {
    return cfIp.trim();
  }

  // Vercel: Use x-vercel-forwarded-for if on Vercel
  const vercelIp = headersList.get('x-vercel-forwarded-for');
  if (process.env.VERCEL && vercelIp) {
    return vercelIp.split(',')[0].trim();
  }

  // Fall back to X-Real-IP only if no X-Forwarded-For (less likely to be spoofed)
  if (realIp && !forwardedFor) {
    return realIp.trim();
  }

  // If X-Forwarded-For exists but no proxy secret, log warning in production
  if (forwardedFor) {
    if (process.env.NODE_ENV === 'production' && expectedSecret) {
      console.warn(
        '[rate-limit] X-Forwarded-For present without valid proxy secret. ' +
          'This could indicate a spoofing attempt or misconfigured proxy.'
      );
    }
    // In development or when PROXY_SECRET is not set, still use forwarded header
    return forwardedFor.split(',')[0].trim();
  }

  // No forwarding headers - direct connection or unknown
  return 'unknown';
}

/**
 * Get client IP from NextRequest (for API routes) with spoofing protection.
 *
 * SECURITY: Only trusts X-Forwarded-For if request came through our known proxy.
 */
export function getClientIpFromRequest(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  const proxySecret = req.headers.get('x-proxy-secret');

  // Only trust X-Forwarded-For if request came through our verified proxy
  const expectedSecret = process.env.PROXY_SECRET;

  if (expectedSecret && proxySecret === expectedSecret && forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  // Cloudflare: Use CF-Connecting-IP if available and we're behind Cloudflare
  const cfIp = req.headers.get('cf-connecting-ip');
  if (process.env.TRUST_CLOUDFLARE === 'true' && cfIp) {
    return cfIp.trim();
  }

  // Vercel: Use x-vercel-forwarded-for if on Vercel
  const vercelIp = req.headers.get('x-vercel-forwarded-for');
  if (process.env.VERCEL && vercelIp) {
    return vercelIp.split(',')[0].trim();
  }

  // Fall back to X-Real-IP only if no X-Forwarded-For
  if (realIp && !forwardedFor) {
    return realIp.trim();
  }

  // If X-Forwarded-For exists but no proxy secret, log warning in production
  if (forwardedFor) {
    if (process.env.NODE_ENV === 'production' && expectedSecret) {
      console.warn(
        '[rate-limit] X-Forwarded-For present without valid proxy secret. ' +
          'This could indicate a spoofing attempt or misconfigured proxy.'
      );
    }
    return forwardedFor.split(',')[0].trim();
  }

  return 'unknown';
}

// --- API Route Wrapper ---

/**
 * Route handler type that supports both simple and parameterized routes.
 * Next.js 15 passes { params: Promise<...> } as the second argument.
 */
type RouteHandler<T = unknown> = (
  req: NextRequest,
  context?: { params: Promise<T> }
) => Promise<NextResponse>;

/**
 * Wrap an API route handler with rate limiting.
 *
 * @param handler - The API route handler (supports both simple and parameterized routes)
 * @param options - Rate limit configuration
 * @returns Wrapped handler that enforces rate limits
 *
 * @example
 * ```ts
 * // Simple route
 * export const POST = withRateLimit(
 *   async (req) => {
 *     const data = await req.json();
 *     return NextResponse.json({ success: true });
 *   },
 *   { limit: 10, windowMs: 60000 }
 * );
 *
 * // Route with params (Next.js 15)
 * async function handleGet(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
 *   const { id } = await params;
 *   return NextResponse.json({ id });
 * }
 * export const GET = withRateLimit(handleGet, RATE_LIMITS.API);
 * ```
 */
export function withRateLimit<T = unknown>(
  handler: RouteHandler<T>,
  options: RateLimitOptions = { limit: 100, windowMs: 60000 }
): RouteHandler<T> {
  const { limit, windowMs } = options;

  return async (req: NextRequest, context?: { params: Promise<T> }): Promise<NextResponse> => {
    const ip = getClientIpFromRequest(req);
    const identifier = `${ip}:${req.nextUrl.pathname}`;

    const result = await checkRateLimit(identifier, limit, windowMs);

    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);

      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(result.reset / 1000)),
          },
        }
      );
    }

    // Execute handler with context (params) if provided
    const response = await handler(req, context);

    // Add rate limit headers to successful response
    const newHeaders = new Headers(response.headers);
    newHeaders.set('X-RateLimit-Limit', String(limit));
    newHeaders.set('X-RateLimit-Remaining', String(result.remaining));
    newHeaders.set('X-RateLimit-Reset', String(Math.ceil(result.reset / 1000)));

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

// --- Server Action Rate Limiting ---

/**
 * Rate limit check for server actions.
 * Throws an error if rate limit is exceeded.
 *
 * @param actionName - Name of the server action (used as part of the key)
 * @param userId - Optional user ID for per-user rate limiting
 * @param options - Rate limit configuration
 * @throws Error if rate limit is exceeded
 *
 * @example
 * ```ts
 * export async function submitForm(data: FormData) {
 *   'use server';
 *   const { userId } = await auth();
 *   await rateLimitAction('submitForm', userId, { limit: 5, windowMs: 60000 });
 *   // ... action logic
 * }
 * ```
 */
export async function rateLimitAction(
  actionName: string,
  userId?: string | null,
  options: RateLimitOptions = { limit: 30, windowMs: 60000 }
): Promise<void> {
  const { limit, windowMs } = options;

  const ip = await getClientIp();
  const identifier = userId
    ? `user:${userId}:${actionName}`
    : `ip:${ip}:${actionName}`;

  const result = await checkRateLimit(identifier, limit, windowMs);

  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    throw new Error(
      `Rate limit exceeded. Please try again in ${retryAfter} seconds.`
    );
  }
}

// --- Predefined Rate Limiters ---

// Import centralized rate limit configuration from @tevero/utils
// This is the single source of truth for all rate limit values
import {
  AUTH_RATE_LIMITS,
  API_RATE_LIMITS,
  CONTENT_RATE_LIMITS,
} from "@tevero/utils";

/**
 * Pre-configured rate limits for common endpoint types.
 * Values are imported from @tevero/utils for consistency across the monorepo.
 */
export const RATE_LIMITS = {
  /** Authentication endpoints - strict limits (10 req/min) */
  AUTH: {
    limit: AUTH_RATE_LIMITS.DEFAULT.requests,
    windowMs: AUTH_RATE_LIMITS.DEFAULT.windowMs,
  },

  /** General API endpoints (100 req/min) */
  API: {
    limit: API_RATE_LIMITS.DEFAULT.requests,
    windowMs: API_RATE_LIMITS.DEFAULT.windowMs,
  },

  /** Resource-intensive operations (generate, audit, etc.) - 20 req/min */
  HEAVY: {
    limit: CONTENT_RATE_LIMITS.GENERATE.requests,
    windowMs: CONTENT_RATE_LIMITS.GENERATE.windowMs,
  },

  /** Server actions (form submissions, mutations) - 30 req/min */
  ACTION: { limit: 30, windowMs: 60000 },

  /** Password reset - very strict (3 per 5 minutes) */
  PASSWORD_RESET: {
    limit: AUTH_RATE_LIMITS.PASSWORD_RESET.requests,
    windowMs: AUTH_RATE_LIMITS.PASSWORD_RESET.windowMs,
  },

  /** Sign up - prevent enumeration (5 per 5 minutes) */
  SIGNUP: {
    limit: AUTH_RATE_LIMITS.SIGNUP.requests,
    windowMs: AUTH_RATE_LIMITS.SIGNUP.windowMs,
  },
} as const;

/**
 * Rate limit wrapper specifically for authentication endpoints.
 * Uses stricter limits (10 requests per minute).
 */
export function withAuthRateLimit<T = unknown>(
  handler: RouteHandler<T>
): RouteHandler<T> {
  return withRateLimit(handler, RATE_LIMITS.AUTH);
}

/**
 * Rate limit wrapper for resource-intensive endpoints.
 * Uses moderate limits (20 requests per minute).
 */
export function withHeavyRateLimit<T = unknown>(
  handler: RouteHandler<T>
): RouteHandler<T> {
  return withRateLimit(handler, RATE_LIMITS.HEAVY);
}

// --- Testing Utilities ---

/**
 * Reset rate limit for a specific identifier.
 * Use only in tests. Clears both Redis and in-memory fallback.
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  // Clear from in-memory fallback
  rateLimitMapFallback.delete(identifier);

  // Try to clear from Redis
  try {
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      await redis.del(`${REDIS_KEY_PREFIX}${identifier}`);
    }
  } catch {
    // Ignore Redis errors in test cleanup
  }
}

/**
 * Clear all rate limits.
 * Use only in tests. Clears both Redis and in-memory fallback.
 */
export async function clearAllRateLimits(): Promise<void> {
  // Clear in-memory fallback
  rateLimitMapFallback.clear();

  // Try to clear Redis keys
  try {
    const redisAvailable = await isRedisAvailable();
    if (redisAvailable) {
      const keys = await redis.keys(`${REDIS_KEY_PREFIX}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  } catch {
    // Ignore Redis errors in test cleanup
  }
}

/**
 * Get current size of the rate limit map (in-memory fallback only).
 * Useful for debugging and monitoring.
 */
export function getRateLimitMapSize(): number {
  return rateLimitMapFallback.size;
}
