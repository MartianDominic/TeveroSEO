/**
 * Structured error codes for consistent error handling across the application.
 *
 * Code ranges:
 * - 1xxx: Authentication errors
 * - 2xxx: Authorization errors
 * - 3xxx: Validation errors
 * - 4xxx: Resource errors (not found, conflicts)
 * - 5xxx: External service errors
 * - 6xxx: Rate limiting errors
 * - 9xxx: Internal errors
 */
export enum ErrorCode {
  // Authentication (1xxx)
  UNAUTHORIZED = 1001,
  SESSION_EXPIRED = 1002,
  INVALID_TOKEN = 1003,

  // Authorization (2xxx)
  FORBIDDEN = 2001,
  CLIENT_NOT_OWNED = 2002,
  INSUFFICIENT_PERMISSIONS = 2003,

  // Validation (3xxx)
  VALIDATION_ERROR = 3001,
  INVALID_INPUT = 3002,
  MISSING_REQUIRED_FIELD = 3003,

  // Resource (4xxx)
  NOT_FOUND = 4001,
  ALREADY_EXISTS = 4002,
  CONFLICT = 4003,

  // External Services (5xxx)
  SERVICE_UNAVAILABLE = 5001,
  EXTERNAL_API_ERROR = 5002,
  TIMEOUT = 5003,

  // Rate Limiting (6xxx)
  RATE_LIMITED = 6001,
  QUOTA_EXCEEDED = 6002,

  // Internal (9xxx)
  INTERNAL_ERROR = 9001,
  DATABASE_ERROR = 9002,
}

/**
 * Structured error response format for API responses.
 */
export interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * Base application error class with structured error codes.
 * Use specific subclasses (UnauthorizedError, NotFoundError, etc.) when possible.
 */
export class ApplicationError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApplicationError';
    // Maintain proper stack trace in V8 engines
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert to a safe JSON representation for API responses.
   */
  toJSON(): AppError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}

// ============================================================================
// Specific Error Classes
// ============================================================================

/**
 * Authentication failed - user is not authenticated.
 */
export class UnauthorizedError extends ApplicationError {
  constructor(message = 'Unauthorized') {
    super(ErrorCode.UNAUTHORIZED, message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Authorization failed - user lacks required permissions.
 */
export class ForbiddenError extends ApplicationError {
  constructor(message = 'Access denied') {
    super(ErrorCode.FORBIDDEN, message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Resource not found.
 */
export class NotFoundError extends ApplicationError {
  constructor(resource: string) {
    super(ErrorCode.NOT_FOUND, `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

/**
 * Input validation failed.
 */
export class ValidationError extends ApplicationError {
  constructor(details: Record<string, string[]>) {
    super(ErrorCode.VALIDATION_ERROR, 'Validation failed', details);
    this.name = 'ValidationError';
  }
}

/**
 * Resource already exists (duplicate).
 */
export class ConflictError extends ApplicationError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} with identifier '${identifier}' already exists`
      : `${resource} already exists`;
    super(ErrorCode.ALREADY_EXISTS, message);
    this.name = 'ConflictError';
  }
}

/**
 * External service unavailable or failed.
 */
export class ServiceError extends ApplicationError {
  constructor(service: string, originalError?: string) {
    const message = originalError
      ? `${service} service error: ${originalError}`
      : `${service} service is unavailable`;
    super(ErrorCode.SERVICE_UNAVAILABLE, message);
    this.name = 'ServiceError';
  }
}

/**
 * Rate limit exceeded.
 */
export class RateLimitError extends ApplicationError {
  constructor(retryAfter?: number) {
    const message = retryAfter
      ? `Rate limit exceeded. Please retry after ${retryAfter} seconds.`
      : 'Rate limit exceeded. Please try again later.';
    super(ErrorCode.RATE_LIMITED, message, retryAfter ? { retryAfter } : undefined);
    this.name = 'RateLimitError';
  }
}
