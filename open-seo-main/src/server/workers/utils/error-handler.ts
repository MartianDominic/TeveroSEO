/**
 * Worker error handling utilities for BullMQ workers.
 *
 * Provides:
 * - Structured error context creation
 * - Database error logging (with graceful fallback)
 * - Processor wrapper with automatic error handling
 * - Transaction wrapper with auto-rollback
 * - Safe fire-and-forget pattern for background tasks
 * - SEC-005 FIX: Sanitized error responses for API handlers
 *
 * NOTE: Retry logic is consolidated in @/server/lib/retry.
 * This module re-exports withRetry for backward compatibility.
 *
 * @module workers/utils/error-handler
 */

import type { Job } from "bullmq";
import { createLogger, type Logger } from "@/server/lib/logger";
import { randomUUID } from "crypto";
import {
  withRetry as canonicalWithRetry,
  adaptWorkerOptions,
  type RetryOptions,
  type WorkerRetryOptions,
} from "@/server/lib/retry";

const log = createLogger({ module: "worker-error-handler" });

/**
 * Structured worker error with full context for debugging.
 */
export interface WorkerError {
  /** Error message from the thrown error */
  message: string;
  /** Stack trace if available */
  stack?: string;
  /** Error code (e.g., ECONNREFUSED, TIMEOUT) */
  code?: string;
  /** BullMQ job ID */
  jobId: string;
  /** Job name/type */
  jobName: string;
  /** Number of attempts made so far */
  attemptsMade: number;
  /** Maximum retry attempts configured */
  maxAttempts: number;
  /** Job payload data */
  data: unknown;
  /** Timestamp when error occurred */
  timestamp: Date;
}

/**
 * Result of error logging operation.
 */
export interface ErrorLogResult {
  /** Whether error was logged successfully */
  logged: boolean;
  /** If logging failed, the reason */
  failureReason?: string;
}

/**
 * Create structured error context from a job and error.
 *
 * @param job - BullMQ job that failed
 * @param error - Error that was thrown
 * @returns Structured error context object
 *
 * @example
 * const ctx = createErrorContext(job, new Error('Database timeout'));
 * console.log(ctx.message); // 'Database timeout'
 * console.log(ctx.attemptsMade); // 2
 */
export function createErrorContext(job: Job, error: unknown): WorkerError {
  const err = error instanceof Error ? error : new Error(String(error));

  return {
    message: err.message,
    stack: err.stack,
    code: (err as NodeJS.ErrnoException).code,
    jobId: job.id ?? "unknown",
    jobName: job.name,
    attemptsMade: job.attemptsMade,
    maxAttempts: job.opts.attempts ?? 1,
    data: sanitizeJobData(job.data),
    timestamp: new Date(),
  };
}

/**
 * Sanitize job data to prevent logging sensitive information.
 * Removes or masks fields that might contain secrets.
 */
function sanitizeJobData(data: unknown): unknown {
  if (!data || typeof data !== "object") {
    return data;
  }

  const sanitized = { ...data } as Record<string, unknown>;

  // List of sensitive field patterns to mask
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /apikey/i,
    /api_key/i,
    /authorization/i,
    /credential/i,
  ];

  for (const key of Object.keys(sanitized)) {
    if (sensitivePatterns.some((pattern) => pattern.test(key))) {
      sanitized[key] = "[REDACTED]";
    }
  }

  return sanitized;
}

/**
 * Log worker error with full context to console.
 * Provides structured logging for production debugging.
 *
 * @param workerName - Name of the worker (for log prefix)
 * @param job - BullMQ job that failed
 * @param error - Error that was thrown
 * @returns Promise resolving to log result
 *
 * @example
 * await logWorkerError('ranking-processor', job, error);
 */
export async function logWorkerError(
  workerName: string,
  job: Job,
  error: unknown
): Promise<ErrorLogResult> {
  const ctx = createErrorContext(job, error);
  const err = error instanceof Error ? error : new Error(String(error));

  const jobLogger = createLogger({
    module: workerName,
    jobId: ctx.jobId,
  });

  // Log to console with structured context
  jobLogger.error(`Job failed: ${ctx.message}`, err, {
    jobName: ctx.jobName,
    attempts: `${ctx.attemptsMade}/${ctx.maxAttempts}`,
    errorCode: ctx.code,
  });

  return { logged: true };
}

/**
 * Wrap a worker processor function with automatic error handling.
 * Catches errors, logs them with full context, then re-throws for BullMQ retry logic.
 *
 * @param workerName - Name of the worker (for logging)
 * @param processor - The actual processor function
 * @returns Wrapped processor function with error handling
 *
 * @example
 * const worker = new Worker(
 *   'emails',
 *   withErrorHandling('email-processor', async (job) => {
 *     // processor logic
 *   }),
 *   { connection }
 * );
 */
export function withErrorHandling<TData, TResult>(
  workerName: string,
  processor: (job: Job<TData>) => Promise<TResult>
): (job: Job<TData>) => Promise<TResult> {
  return async (job: Job<TData>): Promise<TResult> => {
    const startTime = Date.now();
    const jobLogger = createLogger({
      module: workerName,
      jobId: job.id ?? "unknown",
    });

    try {
      jobLogger.debug("Job processing started", { jobName: job.name });
      const result = await processor(job);
      const durationMs = Date.now() - startTime;
      jobLogger.debug("Job processing completed", { durationMs });
      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      await logWorkerError(workerName, job, error);

      // Add duration context before re-throwing
      const err = error instanceof Error ? error : new Error(String(error));
      (err as Error & { durationMs?: number }).durationMs = durationMs;

      throw error; // Re-throw for BullMQ retry logic
    }
  };
}

/**
 * Execute an operation with automatic transaction management.
 * Note: This is a simplified wrapper - actual transaction handling
 * depends on the database driver being used.
 *
 * For Drizzle with PostgreSQL, use db.transaction() directly:
 * @example
 * await db.transaction(async (tx) => {
 *   await tx.insert(table).values(data);
 *   await tx.update(otherTable).set(values);
 *   // Automatically rolls back on error
 * });
 */
export async function withTransaction<T>(
  operation: () => Promise<T>
): Promise<T> {
  // This wrapper is provided for documentation purposes.
  // In practice, use Drizzle's native transaction:
  // await db.transaction(async (tx) => { ... })
  return operation();
}

/**
 * Execute a promise in the background with proper error logging.
 * Use this instead of `void Promise` to ensure errors are captured.
 *
 * @param name - Identifier for the background task (for logging)
 * @param promise - The promise to execute
 * @param logger - Optional custom logger
 *
 * @example
 * // Instead of:
 * void db.update(table).set({ lastUsedAt: now });
 *
 * // Use:
 * fireAndForget('update-last-used', db.update(table).set({ lastUsedAt: now }));
 */
export function fireAndForget(
  name: string,
  promise: Promise<unknown>,
  logger?: Logger
): void {
  const taskLogger = logger ?? log;

  promise.catch((error) => {
    taskLogger.error(
      `Background task failed: ${name}`,
      error instanceof Error ? error : new Error(String(error))
    );
  });
}

/**
 * Create a fire-and-forget function bound to a specific logger.
 * Useful when you want all background tasks in a module to use the same logger.
 *
 * @param logger - Logger to use for error reporting
 * @returns Bound fireAndForget function
 *
 * @example
 * const log = createLogger({ module: 'auth' });
 * const bgTask = createFireAndForget(log);
 *
 * bgTask('update-session', updateSessionPromise);
 */
export function createFireAndForget(
  logger: Logger
): (name: string, promise: Promise<unknown>) => void {
  return (name: string, promise: Promise<unknown>) => {
    fireAndForget(name, promise, logger);
  };
}

/**
 * Retry an async operation with exponential backoff.
 *
 * NOTE: This is a compatibility wrapper around the canonical implementation
 * in @/server/lib/retry. New code should import directly from lib/retry.
 *
 * @param operation - Async operation to retry
 * @param options - Retry configuration (worker-style)
 * @returns Result of the operation
 *
 * @example
 * const result = await withRetry(
 *   () => fetchExternalApi(),
 *   { maxAttempts: 3, initialDelayMs: 1000 }
 * );
 *
 * @deprecated Import { withRetry } from '@/server/lib/retry' instead
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: WorkerRetryOptions = {}
): Promise<T> {
  const canonicalOpts: RetryOptions = {
    ...adaptWorkerOptions(options),
    logRetries: true,
    operationName: "worker operation",
  };

  return canonicalWithRetry(operation, canonicalOpts);
}

// --- SEC-005 FIX: Sanitized Error Responses ---

/**
 * Error codes for client-facing error responses.
 * Maps internal error types to safe, generic codes.
 */
export const ERROR_CODES = {
  INTERNAL_ERROR: "INTERNAL_ERROR",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  RATE_LIMITED: "RATE_LIMITED",
  BAD_REQUEST: "BAD_REQUEST",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/**
 * Generic error messages that are safe to expose to clients.
 * These do NOT leak internal details like file paths, stack traces, or database info.
 */
const SAFE_ERROR_MESSAGES: Record<ErrorCode, string> = {
  INTERNAL_ERROR: "An unexpected error occurred. Please try again later.",
  VALIDATION_ERROR: "The request contains invalid data.",
  NOT_FOUND: "The requested resource was not found.",
  UNAUTHORIZED: "Authentication is required to access this resource.",
  FORBIDDEN: "You do not have permission to access this resource.",
  RATE_LIMITED: "Too many requests. Please try again later.",
  BAD_REQUEST: "The request could not be processed.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable.",
};

/**
 * Sanitized error response for API handlers.
 * SEC-005 FIX: Never exposes internal paths, stack traces, or sensitive details.
 */
export interface SanitizedErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    requestId: string;
  };
}

/**
 * Create a sanitized error response for API handlers.
 *
 * SEC-005 FIX: This function ensures that:
 * - Internal error details are logged server-side
 * - Only generic, safe messages are returned to clients
 * - A requestId is included for correlation without exposing internals
 *
 * @param error - The actual error (for logging)
 * @param code - The error code to return
 * @param context - Additional context for logging
 * @returns Sanitized error response object
 */
export function createSanitizedErrorResponse(
  error: unknown,
  code: ErrorCode = "INTERNAL_ERROR",
  context: Record<string, unknown> = {}
): SanitizedErrorResponse {
  const requestId = randomUUID();
  const err = error instanceof Error ? error : new Error(String(error));

  // Log full error details server-side
  log.error(`API error [${code}]: ${err.message}`, err, {
    requestId,
    code,
    ...context,
  });

  // Return sanitized response
  return {
    success: false,
    error: {
      code,
      message: SAFE_ERROR_MESSAGES[code],
      requestId,
    },
  };
}

/**
 * Handle an API error and return a Response object.
 *
 * SEC-005 FIX: Centralizes error handling to prevent accidental exposure
 * of internal details in API responses.
 *
 * @param error - The actual error
 * @param request - The request (optional, for logging context)
 * @param code - The error code
 * @param status - HTTP status code
 * @returns Response object with sanitized error
 */
export function handleApiError(
  error: unknown,
  request?: Request,
  code: ErrorCode = "INTERNAL_ERROR",
  status: number = 500
): Response {
  const context: Record<string, unknown> = {};

  if (request) {
    try {
      const url = new URL(request.url);
      context.path = url.pathname;
      context.method = request.method;
    } catch {
      // Ignore URL parsing errors
    }
  }

  const sanitizedResponse = createSanitizedErrorResponse(error, code, context);

  return Response.json(sanitizedResponse, { status });
}

/**
 * Determine the appropriate error code from an error object.
 * Useful for mapping domain errors to API error codes.
 *
 * @param error - The error to analyze
 * @returns Appropriate error code
 */
export function getErrorCode(error: unknown): ErrorCode {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    // Map common error patterns to codes
    if (name.includes("validation") || message.includes("invalid")) {
      return "VALIDATION_ERROR";
    }
    if (name.includes("notfound") || message.includes("not found")) {
      return "NOT_FOUND";
    }
    if (name.includes("unauthorized") || message.includes("unauthorized")) {
      return "UNAUTHORIZED";
    }
    if (name.includes("forbidden") || message.includes("permission denied")) {
      return "FORBIDDEN";
    }
    if (message.includes("rate limit") || message.includes("too many")) {
      return "RATE_LIMITED";
    }
  }

  return "INTERNAL_ERROR";
}

/**
 * Wrap an async API handler with automatic error handling.
 * Ensures all errors are properly sanitized before returning to clients.
 *
 * @param handler - The async handler function
 * @returns Wrapped handler with error handling
 *
 * @example
 * ```typescript
 * export const POST = withApiErrorHandler(async (request) => {
 *   const data = await processRequest(request);
 *   return Response.json({ success: true, data });
 * });
 * ```
 */
export function withApiErrorHandler(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch (error) {
      const code = getErrorCode(error);
      const status = getStatusForCode(code);
      return handleApiError(error, request, code, status);
    }
  };
}

/**
 * Get HTTP status code for an error code.
 */
function getStatusForCode(code: ErrorCode): number {
  switch (code) {
    case "VALIDATION_ERROR":
    case "BAD_REQUEST":
      return 400;
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
      return 403;
    case "NOT_FOUND":
      return 404;
    case "RATE_LIMITED":
      return 429;
    case "SERVICE_UNAVAILABLE":
      return 503;
    case "INTERNAL_ERROR":
    default:
      return 500;
  }
}
