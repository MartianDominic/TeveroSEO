import * as Sentry from '@sentry/nextjs';

import { logger } from '@/lib/logger';

import { ApplicationError, ErrorCode } from './types';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Standardized error response format for API endpoints.
 */
export interface ErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
    stack?: string;
  };
}

/**
 * Format any error into a standardized response.
 * In development, includes stack traces for debugging.
 * In production, sanitizes error details to prevent information leakage.
 */
export function formatErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof ApplicationError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
        stack: isDev ? error.stack : undefined,
      },
    };
  }

  // Unknown error - don't leak details in production
  const message = isDev && error instanceof Error
    ? error.message
    : 'An unexpected error occurred';

  return {
    error: {
      code: ErrorCode.INTERNAL_ERROR,
      message,
      stack: isDev && error instanceof Error ? error.stack : undefined,
    },
  };
}

/**
 * Get a user-friendly error message from any error type.
 * Safe for displaying in UI - no sensitive information.
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof ApplicationError) {
    // ApplicationErrors have safe, user-friendly messages
    return error.message;
  }

  // For unknown errors, return a generic message
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Keys that may contain sensitive data and should be redacted from logs.
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'key',
  'auth',
  'credential',
  'cookie',
  'authorization',
  'api_key',
  'apikey',
  'access_token',
  'refresh_token',
  'private',
  'ssn',
  'credit_card',
  'card_number',
];

/**
 * Recursively sanitize an object for safe logging.
 * Redacts values for keys that may contain sensitive information.
 */
export function sanitizeForLogging(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    // Check if this key might contain sensitive data
    if (SENSITIVE_KEYS.some(s => lowerKey.includes(s))) {
      result[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Recursively sanitize nested objects
      result[key] = sanitizeForLogging(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      // Handle arrays - sanitize any objects within
      result[key] = value.map(item =>
        typeof item === 'object' && item !== null
          ? sanitizeForLogging(item as Record<string, unknown>)
          : item
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Log an error with structured context and send to Sentry.
 * Automatically sanitizes any context data to prevent logging sensitive information.
 */
export function logError(
  context: string,
  error: unknown,
  additionalData?: Record<string, unknown>
): void {
  const errorDetails: Record<string, unknown> = {
    context,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };

  if (error instanceof Error) {
    errorDetails.name = error.name;
    errorDetails.message = error.message;
    if (isDev) {
      errorDetails.stack = error.stack;
    }
  } else {
    errorDetails.error = String(error);
  }

  let errorCode: ErrorCode | undefined;
  if (error instanceof ApplicationError) {
    errorCode = error.code;
    errorDetails.code = error.code;
    if (error.details) {
      errorDetails.details = sanitizeForLogging(error.details);
    }
  }

  const sanitizedData = additionalData ? sanitizeForLogging(additionalData) : undefined;
  if (sanitizedData) {
    errorDetails.data = sanitizedData;
  }

  // Send to Sentry with context
  if (error instanceof Error) {
    Sentry.captureException(error, {
      extra: {
        context,
        ...sanitizedData,
      },
      tags: {
        errorContext: context,
        ...(errorCode && { errorCode }),
      },
    });
  } else {
    // For non-Error objects, capture as message
    Sentry.captureMessage(`[${context}] ${String(error)}`, {
      level: 'error',
      extra: {
        context,
        originalError: String(error),
        ...sanitizedData,
      },
      tags: {
        errorContext: context,
      },
    });
  }

  // Also log to console in development for easier debugging
  if (isDev) {
    console.error(`[ERROR:${context}]`, JSON.stringify(errorDetails, null, 2));
  }
}

/**
 * Wrap an async function with error handling.
 * Logs errors and re-throws ApplicationErrors, converting unknown errors to internal errors.
 */
export async function withErrorHandling<T>(
  context: string,
  fn: () => Promise<T>,
  additionalData?: Record<string, unknown>
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError(context, error, additionalData);

    if (error instanceof ApplicationError) {
      throw error;
    }

    // Convert unknown errors to ApplicationError
    throw new ApplicationError(
      ErrorCode.INTERNAL_ERROR,
      isDev && error instanceof Error ? error.message : 'An unexpected error occurred'
    );
  }
}
