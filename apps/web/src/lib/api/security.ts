/**
 * API Security Utilities
 *
 * Provides rate limiting and CSRF protection for Next.js API routes.
 * Combines the existing rate-limit middleware with CSRF validation.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  withRateLimit,
  withHeavyRateLimit,
  RATE_LIMITS,
  type RateLimitOptions,
} from "../middleware/rate-limit";

// --- CSRF Protection ---

/**
 * Allowed origins for CSRF validation.
 * In production, this should only include the production domain.
 */
function getAllowedOrigins(): string[] {
  const origins: string[] = [];

  // Production URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL);
  }

  // Development URLs
  if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000");
    origins.push("http://127.0.0.1:3000");
  }

  return origins;
}

/**
 * Validate request origin for CSRF protection.
 * Checks Origin and Referer headers against allowed origins.
 *
 * @param req - The incoming request
 * @returns true if the request origin is valid
 */
export function validateOrigin(req: NextRequest | Request): boolean {
  const allowedOrigins = getAllowedOrigins();

  // Check Origin header (most reliable for CORS requests)
  const origin = req.headers.get("origin");
  if (origin) {
    return allowedOrigins.some((allowed) => origin === allowed);
  }

  // Fallback to Referer header (may be stripped by some browsers)
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return allowedOrigins.some((allowed) => refererUrl.origin === allowed);
    } catch {
      // Invalid referer URL
      return false;
    }
  }

  // No origin or referer - this could be a same-origin request from some browsers
  // For strict security, we require at least one header for state-changing requests
  return false;
}

/**
 * Require a custom header for AJAX requests.
 * This provides CSRF protection for fetch-based clients.
 *
 * @param req - The incoming request
 * @returns true if the request has the required AJAX header
 */
export function hasAjaxHeader(req: NextRequest | Request): boolean {
  const requestedWith = req.headers.get("x-requested-with");
  return requestedWith === "XMLHttpRequest" || requestedWith === "fetch";
}

/**
 * CSRF validation options.
 */
export interface CsrfOptions {
  /** Require origin validation (default: true) */
  requireOrigin?: boolean;
  /** Require AJAX header (default: false, use origin validation instead) */
  requireAjaxHeader?: boolean;
}

/**
 * Validate CSRF protection for a request.
 * Returns null if valid, or a 403 response if invalid.
 *
 * @param req - The incoming request
 * @param options - CSRF validation options
 * @returns null if valid, NextResponse with 403 if invalid
 */
export function validateCsrf(
  req: NextRequest | Request,
  options: CsrfOptions = {}
): NextResponse | null {
  const { requireOrigin = true, requireAjaxHeader = false } = options;

  // GET and HEAD requests are safe (no state changes)
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  // Validate AJAX header if required
  if (requireAjaxHeader && !hasAjaxHeader(req)) {
    return NextResponse.json(
      { error: "Invalid request: X-Requested-With header required" },
      { status: 403 }
    );
  }

  // Validate origin if required
  if (requireOrigin && !validateOrigin(req)) {
    return NextResponse.json(
      { error: "Invalid request origin" },
      { status: 403 }
    );
  }

  return null;
}

// --- Rate-Limited Handler Wrappers ---

type RouteHandler = (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>;

type SimpleRouteHandler = (req: NextRequest) => Promise<NextResponse>;

/**
 * Create a rate-limited and CSRF-protected route handler.
 * Combines rate limiting with CSRF validation for state-changing requests.
 *
 * @param handler - The route handler function
 * @param options - Configuration options
 * @returns A wrapped handler with rate limiting and CSRF protection
 *
 * @example
 * ```ts
 * export const POST = secureRoute(
 *   async (req) => {
 *     const body = await req.json();
 *     return NextResponse.json({ success: true });
 *   },
 *   { rateLimit: "standard", csrfProtection: true }
 * );
 * ```
 */
export function secureRoute(
  handler: SimpleRouteHandler,
  options: {
    rateLimit?: "standard" | "heavy" | "auth" | RateLimitOptions;
    csrfProtection?: boolean | CsrfOptions;
  } = {}
): SimpleRouteHandler {
  const { rateLimit = "standard", csrfProtection = true } = options;

  // Determine rate limit options
  let rateLimitOpts: RateLimitOptions;
  if (typeof rateLimit === "string") {
    switch (rateLimit) {
      case "heavy":
        rateLimitOpts = RATE_LIMITS.HEAVY;
        break;
      case "auth":
        rateLimitOpts = RATE_LIMITS.AUTH;
        break;
      default:
        rateLimitOpts = RATE_LIMITS.API;
    }
  } else {
    rateLimitOpts = rateLimit;
  }

  // Create the wrapped handler
  const wrappedHandler: SimpleRouteHandler = async (req: NextRequest) => {
    // CSRF check first (fail fast)
    if (csrfProtection) {
      const csrfOpts =
        typeof csrfProtection === "object" ? csrfProtection : {};
      const csrfResult = validateCsrf(req, csrfOpts);
      if (csrfResult) {
        return csrfResult;
      }
    }

    // Execute original handler (rate limiting is applied by wrapper)
    return handler(req);
  };

  // Apply rate limiting wrapper
  return withRateLimit(wrappedHandler, rateLimitOpts);
}

/**
 * Create a rate-limited handler for expensive operations.
 * Uses stricter rate limits (20/minute instead of 100/minute).
 *
 * @param handler - The route handler function
 * @param csrfProtection - Enable CSRF protection (default: true)
 */
export function secureHeavyRoute(
  handler: SimpleRouteHandler,
  csrfProtection: boolean | CsrfOptions = true
): SimpleRouteHandler {
  return secureRoute(handler, { rateLimit: "heavy", csrfProtection });
}

/**
 * Wrap a dynamic route handler with rate limiting and CSRF protection.
 * For routes with URL params like /api/articles/[articleId].
 *
 * @param handler - The route handler function
 * @param options - Configuration options
 * @returns A wrapped handler with rate limiting and CSRF protection
 */
export function secureParamsRoute<P extends Record<string, string>>(
  handler: (
    req: NextRequest,
    context: { params: Promise<P> }
  ) => Promise<NextResponse>,
  options: {
    rateLimit?: "standard" | "heavy" | "auth" | RateLimitOptions;
    csrfProtection?: boolean | CsrfOptions;
  } = {}
): (req: NextRequest, context: { params: Promise<P> }) => Promise<NextResponse> {
  const { rateLimit = "standard", csrfProtection = true } = options;

  // Determine rate limit options
  let rateLimitOpts: RateLimitOptions;
  if (typeof rateLimit === "string") {
    switch (rateLimit) {
      case "heavy":
        rateLimitOpts = RATE_LIMITS.HEAVY;
        break;
      case "auth":
        rateLimitOpts = RATE_LIMITS.AUTH;
        break;
      default:
        rateLimitOpts = RATE_LIMITS.API;
    }
  } else {
    rateLimitOpts = rateLimit;
  }

  return async (
    req: NextRequest,
    context: { params: Promise<P> }
  ): Promise<NextResponse> => {
    // CSRF check first (fail fast)
    if (csrfProtection) {
      const csrfOpts =
        typeof csrfProtection === "object" ? csrfProtection : {};
      const csrfResult = validateCsrf(req, csrfOpts);
      if (csrfResult) {
        return csrfResult;
      }
    }

    // Create a rate-limited wrapper for this request
    const rateLimitedHandler = withRateLimit(async () => {
      return handler(req, context);
    }, rateLimitOpts);

    return rateLimitedHandler(req);
  };
}

// Re-export rate limit utilities for convenience
export { RATE_LIMITS, withRateLimit, withHeavyRateLimit };
export type { RateLimitOptions };
