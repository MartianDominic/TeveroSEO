/**
 * Request Logging Middleware for API Routes
 *
 * Provides structured logging for all API requests including:
 * - Request method and path
 * - Response status code
 * - Request duration
 * - Correlation ID for request tracing
 * - User context when available
 */

import { NextRequest, NextResponse } from "next/server";

import {
  logger,
  generateCorrelationId,
  createRequestLogger,
  type LogContext,
} from "../logger";

export const CORRELATION_ID_HEADER = "x-correlation-id";
export const REQUEST_ID_HEADER = "x-request-id";

interface RequestLogContext extends LogContext {
  method: string;
  path: string;
  query?: Record<string, string>;
  userAgent?: string;
  ip?: string;
}

interface ResponseLogContext extends RequestLogContext {
  status: number;
  durationMs: number;
}

/**
 * Extract client IP from request
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Higher-order function that wraps an API route handler with request logging
 *
 * @example
 * ```typescript
 * import { withRequestLogging } from "@/lib/middleware/request-logger";
 *
 * export const GET = withRequestLogging(async (request, context) => {
 *   // Your handler logic
 *   return NextResponse.json({ data: "hello" });
 * });
 * ```
 */
export function withRequestLogging<
  T extends (
    request: NextRequest,
    context?: { params?: Record<string, string> }
  ) => Promise<NextResponse> | NextResponse,
>(handler: T): T {
  return (async (
    request: NextRequest,
    context?: { params?: Record<string, string> }
  ): Promise<NextResponse> => {
    const startTime = performance.now();

    // Get or generate correlation ID
    const correlationId =
      request.headers.get(CORRELATION_ID_HEADER) || generateCorrelationId();

    // Build request context
    const requestContext: RequestLogContext = {
      correlationId,
      method: request.method,
      path: request.nextUrl.pathname,
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") || undefined,
    };

    // Add query params if present
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    if (Object.keys(searchParams).length > 0) {
      requestContext.query = searchParams;
    }

    // Create request-scoped logger
    const reqLogger = createRequestLogger(correlationId, {
      requestId: correlationId,
    });

    // Log incoming request
    reqLogger.info("Incoming request", {
      method: requestContext.method,
      path: requestContext.path,
      ip: requestContext.ip,
    });

    let response: NextResponse;
    let status: number;

    try {
      response = await handler(request, context);
      status = response.status;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);

      reqLogger.error("Request failed with unhandled error", {
        method: requestContext.method,
        path: requestContext.path,
        durationMs,
        error: error instanceof Error ? error.message : String(error),
      });

      // Re-throw to let Next.js error handling take over
      throw error;
    }

    const durationMs = Math.round(performance.now() - startTime);

    // Log response
    const responseContext: ResponseLogContext = {
      ...requestContext,
      status,
      durationMs,
    };

    if (status >= 500) {
      reqLogger.error("Request completed with server error", {
        method: responseContext.method,
        path: responseContext.path,
        status: responseContext.status,
        durationMs: responseContext.durationMs,
      });
    } else if (status >= 400) {
      reqLogger.warn("Request completed with client error", {
        method: responseContext.method,
        path: responseContext.path,
        status: responseContext.status,
        durationMs: responseContext.durationMs,
      });
    } else {
      reqLogger.info("Request completed", {
        method: responseContext.method,
        path: responseContext.path,
        status: responseContext.status,
        durationMs: responseContext.durationMs,
      });
    }

    // Add correlation ID to response headers
    const newHeaders = new Headers(response.headers);
    newHeaders.set(CORRELATION_ID_HEADER, correlationId);
    newHeaders.set(REQUEST_ID_HEADER, correlationId);

    return new NextResponse(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  }) as T;
}

/**
 * Log an API error with structured context
 * Use this for catch blocks in API routes
 */
export function logApiError(
  operation: string,
  error: unknown,
  context?: Record<string, unknown>
): void {
  logger.error(`[${operation}] Failed`, {
    ...context,
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
}

/**
 * Create a logger for a specific API operation
 */
export function createApiLogger(operation: string, correlationId?: string) {
  return createRequestLogger(correlationId || generateCorrelationId(), {
    operation,
  });
}
