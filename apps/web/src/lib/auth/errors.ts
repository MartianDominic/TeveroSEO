/**
 * Authorization Error Types
 *
 * Provides typed error classes for authorization failures.
 * These errors are used throughout the application to signal
 * different types of access control failures with appropriate
 * HTTP status codes and error codes for frontend handling.
 *
 * Error Hierarchy:
 * - AuthorizationError (base): 403 Forbidden
 *   - ClientOwnershipError: User doesn't own the client
 *   - ResourceNotFoundError: 404 - Resource doesn't exist
 *   - InsufficientPermissionsError: User lacks required role/permission
 *
 * SECURITY: All authorization errors are logged for audit trail.
 * Error messages are safe for client display (no internal details leaked).
 */

/**
 * Error codes for frontend handling.
 * These codes can be used to display appropriate UI messages or take specific actions.
 */
export enum AuthErrorCode {
  /** Generic authorization failure */
  FORBIDDEN = 'FORBIDDEN',
  /** User doesn't have access to the requested client */
  CLIENT_OWNERSHIP_DENIED = 'CLIENT_OWNERSHIP_DENIED',
  /** Requested resource was not found */
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  /** User lacks required permission for the operation */
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  /** User is not authenticated */
  UNAUTHORIZED = 'UNAUTHORIZED',
  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  /** Authorization service unavailable */
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * Base class for all authorization errors.
 * Extends Error with HTTP status code and error code for API responses.
 */
export class AuthorizationError extends Error {
  public readonly statusCode: number;
  public readonly code: AuthErrorCode;

  constructor(
    message: string,
    code: AuthErrorCode = AuthErrorCode.FORBIDDEN,
    statusCode: number = 403
  ) {
    super(message);
    this.name = 'AuthorizationError';
    this.code = code;
    this.statusCode = statusCode;

    // Maintains proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthorizationError);
    }
  }

  /**
   * Convert error to JSON-serializable format for API responses.
   */
  toJSON(): { error: string; code: string; statusCode: number } {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}

/**
 * Error thrown when user doesn't have access to a specific client.
 * This is the most common authorization error in the application.
 *
 * @example
 * ```ts
 * throw new ClientOwnershipError('client-123');
 * // Error: Access denied to client client-123
 * // Code: CLIENT_OWNERSHIP_DENIED
 * // StatusCode: 403
 * ```
 */
export class ClientOwnershipError extends AuthorizationError {
  public readonly clientId: string;
  public readonly userId?: string;

  constructor(clientId: string, userId?: string) {
    super(
      `Access denied to client ${clientId}`,
      AuthErrorCode.CLIENT_OWNERSHIP_DENIED,
      403
    );
    this.name = 'ClientOwnershipError';
    this.clientId = clientId;
    this.userId = userId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ClientOwnershipError);
    }
  }

  toJSON(): {
    error: string;
    code: string;
    statusCode: number;
    clientId: string;
  } {
    return {
      ...super.toJSON(),
      clientId: this.clientId,
    };
  }
}

/**
 * Error thrown when a requested resource doesn't exist.
 * Returns 404 to prevent information leakage about resource existence.
 *
 * SECURITY: Use this instead of revealing whether a resource exists
 * but the user lacks access. This prevents enumeration attacks.
 *
 * @example
 * ```ts
 * throw new ResourceNotFoundError('Client', 'client-123');
 * // Error: Client not found
 * // Code: RESOURCE_NOT_FOUND
 * // StatusCode: 404
 * ```
 */
export class ResourceNotFoundError extends AuthorizationError {
  public readonly resourceType: string;
  public readonly resourceId: string;

  constructor(resourceType: string, resourceId: string) {
    super(
      `${resourceType} not found`,
      AuthErrorCode.RESOURCE_NOT_FOUND,
      404
    );
    this.name = 'ResourceNotFoundError';
    this.resourceType = resourceType;
    this.resourceId = resourceId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ResourceNotFoundError);
    }
  }
}

/**
 * Error thrown when user lacks required permission for an operation.
 * Different from ClientOwnershipError - this is for role-based access control.
 *
 * @example
 * ```ts
 * throw new InsufficientPermissionsError('admin', 'delete_client');
 * // Error: Requires admin role for delete_client operation
 * // Code: INSUFFICIENT_PERMISSIONS
 * // StatusCode: 403
 * ```
 */
export class InsufficientPermissionsError extends AuthorizationError {
  public readonly requiredRole: string;
  public readonly operation: string;

  constructor(requiredRole: string, operation: string) {
    super(
      `Requires ${requiredRole} role for ${operation} operation`,
      AuthErrorCode.INSUFFICIENT_PERMISSIONS,
      403
    );
    this.name = 'InsufficientPermissionsError';
    this.requiredRole = requiredRole;
    this.operation = operation;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InsufficientPermissionsError);
    }
  }
}

/**
 * Error thrown when authorization service is unavailable.
 * This is a temporary failure - the operation may succeed on retry.
 *
 * SECURITY: Fails closed - denies access when verification cannot be performed.
 */
export class AuthServiceUnavailableError extends AuthorizationError {
  constructor(serviceName: string = 'authorization service') {
    super(
      `Unable to verify access - ${serviceName} unavailable`,
      AuthErrorCode.SERVICE_UNAVAILABLE,
      503
    );
    this.name = 'AuthServiceUnavailableError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthServiceUnavailableError);
    }
  }
}

/**
 * Type guard to check if an error is an AuthorizationError.
 */
export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

/**
 * Type guard to check if an error is a ClientOwnershipError.
 */
export function isClientOwnershipError(error: unknown): error is ClientOwnershipError {
  return error instanceof ClientOwnershipError;
}

/**
 * Type guard to check if an error is a ResourceNotFoundError.
 */
export function isResourceNotFoundError(error: unknown): error is ResourceNotFoundError {
  return error instanceof ResourceNotFoundError;
}

/**
 * Convert any authorization error to a safe JSON response.
 * Ensures no internal details are leaked to clients.
 */
export function toSafeErrorResponse(error: unknown): {
  error: string;
  code: string;
  statusCode: number;
} {
  if (isAuthorizationError(error)) {
    return error.toJSON();
  }

  // Default to generic forbidden for unknown errors
  return {
    error: 'Access denied',
    code: AuthErrorCode.FORBIDDEN,
    statusCode: 403,
  };
}
