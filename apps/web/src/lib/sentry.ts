/**
 * Sentry Integration Utilities
 *
 * Provides helper functions for Sentry error tracking in API routes
 * and server-side code. These utilities ensure consistent error capture
 * with proper context and sanitization.
 *
 * @example
 * ```typescript
 * import { captureApiError, withSentryApiHandler } from '@/lib/sentry';
 *
 * // In an API route
 * export async function POST(request: Request) {
 *   return withSentryApiHandler(request, async () => {
 *     // handler logic
 *   });
 * }
 * ```
 */

import * as Sentry from '@sentry/nextjs';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Capture an API error with request context.
 * Automatically extracts relevant request information for debugging.
 */
export function captureApiError(
  error: unknown,
  request: Request | NextRequest,
  additionalContext?: Record<string, unknown>
): string {
  const url = new URL(request.url);

  const eventId = Sentry.captureException(error, {
    extra: {
      url: url.pathname,
      method: request.method,
      searchParams: Object.fromEntries(url.searchParams),
      ...additionalContext,
    },
    tags: {
      routeType: 'api',
      method: request.method,
      path: url.pathname,
    },
  });

  return eventId;
}

/**
 * Wrap an API handler with Sentry error tracking.
 * Automatically captures unhandled errors and returns a standardized error response.
 */
export async function withSentryApiHandler<T>(
  request: Request | NextRequest,
  handler: () => Promise<T>,
  options?: {
    /** Custom error message for the response */
    errorMessage?: string;
    /** Additional context to include with errors */
    context?: Record<string, unknown>;
  }
): Promise<T | NextResponse> {
  try {
    return await handler();
  } catch (error) {
    const eventId = captureApiError(error, request, options?.context);

    // Return standardized error response
    return NextResponse.json(
      {
        error: options?.errorMessage || 'An unexpected error occurred',
        eventId: process.env.NODE_ENV === 'development' ? eventId : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * Add a breadcrumb for tracking user actions or system events.
 * Useful for debugging error reports by showing the sequence of events.
 */
export function addBreadcrumb(
  message: string,
  category: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level,
  });
}

/**
 * Set user context for Sentry.
 * Call this after authentication to associate errors with users.
 *
 * Note: Only include non-PII identifiers (user ID, workspace ID).
 * Do not include email, name, or other personal information.
 */
export function setUserContext(userId: string, workspaceId?: string): void {
  Sentry.setUser({
    id: userId,
    ...(workspaceId && { workspaceId }),
  });
}

/**
 * Clear user context (e.g., on logout).
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Set additional tags that will be attached to all events.
 * Useful for filtering errors by feature, component, or other dimensions.
 */
export function setTag(key: string, value: string): void {
  Sentry.setTag(key, value);
}

/**
 * Create a transaction for performance monitoring.
 * Wrap long-running operations to track their performance.
 *
 * @example
 * ```typescript
 * const transaction = startTransaction('process-articles', 'background-job');
 * try {
 *   await processArticles();
 *   transaction.finish();
 * } catch (error) {
 *   transaction.setStatus('internal_error');
 *   transaction.finish();
 *   throw error;
 * }
 * ```
 */
export function startTransaction(
  name: string,
  op: string
): ReturnType<typeof Sentry.startInactiveSpan> {
  return Sentry.startInactiveSpan({
    name,
    op,
  });
}

/**
 * Capture a message (non-error) in Sentry.
 * Use for warnings or notable events that aren't errors.
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): string {
  return Sentry.captureMessage(message, {
    level,
    extra: context,
  });
}

/**
 * Flush pending Sentry events.
 * Call this before process exit or at the end of serverless functions.
 */
export async function flush(timeout: number = 2000): Promise<boolean> {
  return Sentry.flush(timeout);
}
