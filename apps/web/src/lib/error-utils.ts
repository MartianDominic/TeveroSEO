/**
 * Error handling utilities for safe client-side error exposure.
 *
 * SECURITY: Never expose raw error messages to clients in production.
 * Internal errors may leak sensitive information (stack traces, file paths,
 * database details, etc.)
 */

/**
 * Sanitize an error for safe client exposure.
 * In development, returns the actual error message for debugging.
 * In production, returns a generic message to prevent information leakage.
 */
export function sanitizeErrorForClient(error: unknown): string {
  // In development, show actual error for debugging
  if (process.env.NODE_ENV === 'development') {
    return error instanceof Error ? error.message : 'Unknown error';
  }

  // Production: return generic messages to prevent information leakage
  return 'An error occurred. Please try again.';
}

/**
 * Log an error with structured context for debugging/monitoring.
 * In production, this should integrate with error tracking (Sentry, etc.)
 */
export function logError(context: string, error: unknown): void {
  const errorDetails = {
    context,
    message: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  };

  // In production, send to error tracking service (Sentry, etc.)
  // For now, use structured console.error
  console.error(`[${context}]`, errorDetails);
}

/**
 * Check if we're in development mode.
 * Useful for conditionally showing debug information.
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}
