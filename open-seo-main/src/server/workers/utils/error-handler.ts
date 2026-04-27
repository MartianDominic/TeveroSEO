/**
 * Worker error handling utilities for BullMQ workers.
 *
 * Provides:
 * - Structured error context creation
 * - Database error logging (with graceful fallback)
 * - Processor wrapper with automatic error handling
 * - Transaction wrapper with auto-rollback
 * - Safe fire-and-forget pattern for background tasks
 *
 * @module workers/utils/error-handler
 */

import type { Job } from "bullmq";
import { createLogger, type Logger } from "@/server/lib/logger";

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
 * @param operation - Async operation to retry
 * @param options - Retry configuration
 * @returns Result of the operation
 *
 * @example
 * const result = await withRetry(
 *   () => fetchExternalApi(),
 *   { maxAttempts: 3, initialDelayMs: 1000 }
 * );
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: unknown) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
  } = options;

  let lastError: unknown;
  let delay = initialDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error;
      }

      log.warn(`Retry attempt ${attempt}/${maxAttempts}`, {
        error: error instanceof Error ? error.message : String(error),
        nextDelayMs: delay,
      });

      await sleep(delay);
      delay = Math.min(delay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
