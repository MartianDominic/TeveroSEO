/**
 * Rate limiting for Next.js API routes and server actions.
 *
 * Provides in-memory rate limiting for development and single-instance deployments.
 * For production multi-instance deployments, use Redis-based rate limiting.
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

import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

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

// --- In-memory Store ---

/**
 * In-memory rate limit store.
 * For production multi-instance deployments, replace with Redis.
 */
const rateLimitMap = new Map<string, RateLimitEntry>();

/**
 * Maximum entries to prevent unbounded memory growth.
 * 10K entries at ~100 bytes each = ~1MB max memory.
 */
const MAX_RATE_LIMIT_ENTRIES = 10000;

/**
 * Cleanup interval to prevent memory leaks.
 * Runs every minute to remove expired entries.
 */
let cleanupInterval: NodeJS.Timeout | null = null;

function startCleanup(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    const now = Date.now();
    const keysToDelete: string[] = [];

    rateLimitMap.forEach((entry, key) => {
      if (now > entry.resetTime) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => rateLimitMap.delete(key));

    // Emergency cap - remove oldest entries if still too large
    // This handles cases where cleanup doesn't keep up with new entries
    if (rateLimitMap.size > MAX_RATE_LIMIT_ENTRIES) {
      const excess = rateLimitMap.size - MAX_RATE_LIMIT_ENTRIES;
      // Map maintains insertion order, so first entries are oldest
      const keys = Array.from(rateLimitMap.keys()).slice(0, excess);
      keys.forEach(k => rateLimitMap.delete(k));
    }
  }, 60000); // Every minute

  // Don't keep the process alive just for cleanup
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

// Start cleanup on module load
startCleanup();

// --- Core Rate Limiting ---

/**
 * Check rate limit for a given identifier.
 *
 * Uses a sliding window algorithm based on request timestamps.
 * Increments the counter on each call.
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

  let entry = rateLimitMap.get(key);

  // Window expired or first request - start fresh
  if (!entry || now > entry.resetTime) {
    entry = { count: 1, resetTime: now + windowMs };
    rateLimitMap.set(key, entry);
    return {
      success: true,
      remaining: limit - 1,
      reset: entry.resetTime,
      limit,
    };
  }

  // Check if over limit
  if (entry.count >= limit) {
    return {
      success: false,
      remaining: 0,
      reset: entry.resetTime,
      limit,
    };
  }

  // Increment and allow
  entry.count++;
  return {
    success: true,
    remaining: limit - entry.count,
    reset: entry.resetTime,
    limit,
  };
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
  const entry = rateLimitMap.get(identifier);

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

// --- IP Extraction ---

/**
 * Get client IP from Next.js headers.
 * Handles proxied requests (X-Forwarded-For, X-Real-IP).
 * Note: In Next.js 15, headers() returns a Promise.
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers();

  // Try X-Forwarded-For first (most common for proxied requests)
  const forwarded = headersList.get('x-forwarded-for');
  if (forwarded) {
    // Take the first IP (original client)
    return forwarded.split(',')[0].trim();
  }

  // Try X-Real-IP (nginx default)
  const realIp = headersList.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // Fallback
  return 'unknown';
}

/**
 * Get client IP from NextRequest (for API routes).
 */
export function getClientIpFromRequest(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}

// --- API Route Wrapper ---

/**
 * Wrap an API route handler with rate limiting.
 *
 * @param handler - The API route handler
 * @param options - Rate limit configuration
 * @returns Wrapped handler that enforces rate limits
 *
 * @example
 * ```ts
 * export const POST = withRateLimit(
 *   async (req) => {
 *     const data = await req.json();
 *     return NextResponse.json({ success: true });
 *   },
 *   { limit: 10, windowMs: 60000 }
 * );
 * ```
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: RateLimitOptions = { limit: 100, windowMs: 60000 }
): (req: NextRequest) => Promise<NextResponse> {
  const { limit, windowMs } = options;

  return async (req: NextRequest): Promise<NextResponse> => {
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

    // Execute handler
    const response = await handler(req);

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

/**
 * Pre-configured rate limits for common endpoint types.
 */
export const RATE_LIMITS = {
  /** Authentication endpoints - strict limits */
  AUTH: { limit: 10, windowMs: 60000 },

  /** General API endpoints */
  API: { limit: 100, windowMs: 60000 },

  /** Resource-intensive operations (generate, audit, etc.) */
  HEAVY: { limit: 20, windowMs: 60000 },

  /** Server actions (form submissions, mutations) */
  ACTION: { limit: 30, windowMs: 60000 },

  /** Password reset - very strict */
  PASSWORD_RESET: { limit: 3, windowMs: 300000 }, // 3 per 5 minutes

  /** Sign up - prevent enumeration */
  SIGNUP: { limit: 5, windowMs: 300000 }, // 5 per 5 minutes
} as const;

/**
 * Rate limit wrapper specifically for authentication endpoints.
 * Uses stricter limits (10 requests per minute).
 */
export function withAuthRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return withRateLimit(handler, RATE_LIMITS.AUTH);
}

/**
 * Rate limit wrapper for resource-intensive endpoints.
 * Uses moderate limits (20 requests per minute).
 */
export function withHeavyRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>
): (req: NextRequest) => Promise<NextResponse> {
  return withRateLimit(handler, RATE_LIMITS.HEAVY);
}

// --- Testing Utilities ---

/**
 * Reset rate limit for a specific identifier.
 * Use only in tests.
 */
export function resetRateLimit(identifier: string): void {
  rateLimitMap.delete(identifier);
}

/**
 * Clear all rate limits.
 * Use only in tests.
 */
export function clearAllRateLimits(): void {
  rateLimitMap.clear();
}

/**
 * Get current size of the rate limit map.
 * Useful for debugging and monitoring.
 */
export function getRateLimitMapSize(): number {
  return rateLimitMap.size;
}
