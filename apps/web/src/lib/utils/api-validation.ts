/**
 * API Response Validation Utilities
 *
 * Type-safe utilities for validating API responses at runtime.
 * These provide an alternative to `as any` casts on fetch responses.
 *
 * For projects with Zod, prefer using Zod schemas directly.
 * This module provides a lightweight alternative using type guards.
 */

import { logger } from '@/lib/logger';

import {
  hasProperty,
  hasProperties,
  isValidNumber,
  isNonEmptyString,
  isNonEmptyArray,
} from './type-guards';

/**
 * API validation error with detailed context.
 */
export class ApiValidationError extends Error {
  constructor(
    public readonly context: string,
    public readonly validationErrors: string[]
  ) {
    super(`API validation failed for ${context}: ${validationErrors.join(', ')}`);
    this.name = 'ApiValidationError';
  }
}

/**
 * Result type for validation operations.
 * Provides type-safe error handling without exceptions.
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; errors: string[] };

/**
 * Validator function type.
 * Returns validation result with errors for debugging.
 */
export type Validator<T> = (data: unknown) => ValidationResult<T>;

/**
 * Simple type guard validator (no error details).
 */
export type TypeGuard<T> = (data: unknown) => data is T;

/**
 * Validate API response using a type guard.
 * Throws ApiValidationError if validation fails.
 *
 * @example
 * ```ts
 * const isUser = (data: unknown): data is User =>
 *   hasProperties(data, ['id', 'name', 'email']);
 *
 * const user = validateApiResponse(response.json(), isUser, 'fetchUser');
 * ```
 */
export function validateApiResponse<T>(
  data: unknown,
  validator: TypeGuard<T>,
  context: string
): T {
  if (validator(data)) {
    return data;
  }
  throw new ApiValidationError(context, ['Data does not match expected type']);
}

/**
 * Validate API response using a validator function with error details.
 * Throws ApiValidationError if validation fails.
 *
 * @example
 * ```ts
 * const user = validateApiResponseWithErrors(
 *   response.json(),
 *   validateUser,
 *   'fetchUser'
 * );
 * ```
 */
export function validateApiResponseWithErrors<T>(
  data: unknown,
  validator: Validator<T>,
  context: string
): T {
  const result = validator(data);
  if (result.success === true) {
    return result.data;
  }
  // TypeScript now knows result is { success: false; errors: string[] }
  throw new ApiValidationError(context, result.errors);
}

/**
 * Parse API response with fallback on validation failure.
 * Does not throw - returns fallback value instead.
 *
 * @example
 * ```ts
 * const user = parseApiResponse(response.json(), isUser, defaultUser);
 * ```
 */
export function parseApiResponse<T>(
  data: unknown,
  validator: TypeGuard<T>,
  fallback: T
): T {
  if (validator(data)) {
    return data;
  }
  return fallback;
}

/**
 * Try to validate API response, returning result object.
 * Does not throw - returns ValidationResult instead.
 *
 * @example
 * ```ts
 * const result = tryValidateApiResponse(data, validateUser);
 * if (result.success) {
 *   console.log(result.data.name);
 * } else {
 *   console.error(result.errors);
 * }
 * ```
 */
export function tryValidateApiResponse<T>(
  data: unknown,
  validator: Validator<T>
): ValidationResult<T> {
  return validator(data);
}

// -----------------------------------------------------------------------------
// Common Validators
// -----------------------------------------------------------------------------

/**
 * Validator for paginated API responses.
 *
 * @example
 * ```ts
 * const validatePaginatedUsers = createPaginatedValidator(isUser);
 * const result = validatePaginatedUsers(response.json());
 * ```
 */
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore?: boolean;
  };
}

/**
 * Create a validator for paginated responses.
 */
export function createPaginatedValidator<T>(
  itemValidator: TypeGuard<T>
): Validator<PaginatedResponse<T>> {
  return (data: unknown): ValidationResult<PaginatedResponse<T>> => {
    const errors: string[] = [];

    if (!hasProperty(data, 'data')) {
      errors.push('Missing "data" property');
    }
    if (!hasProperty(data, 'meta')) {
      errors.push('Missing "meta" property');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    const obj = data as { data: unknown; meta: unknown };

    if (!Array.isArray(obj.data)) {
      errors.push('"data" must be an array');
    } else {
      for (let i = 0; i < obj.data.length; i++) {
        if (!itemValidator(obj.data[i])) {
          errors.push(`Item at index ${i} is invalid`);
        }
      }
    }

    if (!hasProperties(obj.meta, ['total', 'page', 'limit'])) {
      errors.push('"meta" must have total, page, and limit properties');
    } else {
      const meta = obj.meta as Record<string, unknown>;
      if (!isValidNumber(meta.total)) errors.push('"meta.total" must be a number');
      if (!isValidNumber(meta.page)) errors.push('"meta.page" must be a number');
      if (!isValidNumber(meta.limit)) errors.push('"meta.limit" must be a number');
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: data as PaginatedResponse<T> };
  };
}

/**
 * Type guard for API error responses.
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}

export function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  return hasProperty(data, 'error') && isNonEmptyString((data as { error: unknown }).error);
}

/**
 * Validator for standard API response envelope.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export function createApiResponseValidator<T>(
  dataValidator: TypeGuard<T>
): TypeGuard<ApiResponse<T>> {
  return (data: unknown): data is ApiResponse<T> => {
    if (!hasProperty(data, 'success')) return false;
    const obj = data as { success: unknown; data?: unknown; error?: unknown };

    if (typeof obj.success !== 'boolean') return false;

    if (obj.success) {
      // Success response must have valid data
      return obj.data !== undefined && dataValidator(obj.data);
    } else {
      // Error response must have error string
      return obj.error === undefined || typeof obj.error === 'string';
    }
  };
}

// -----------------------------------------------------------------------------
// Fetch Helpers with Validation
// -----------------------------------------------------------------------------

/**
 * Fetch JSON with type validation.
 * Throws ApiValidationError if response doesn't match expected type.
 *
 * @example
 * ```ts
 * const user = await fetchJson('/api/user', isUser, 'fetchUser');
 * ```
 */
export async function fetchJson<T>(
  url: string,
  validator: TypeGuard<T>,
  context: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    throw new ApiValidationError(context, [
      `HTTP ${response.status}: ${response.statusText}`,
    ]);
  }

  const data: unknown = await response.json();
  return validateApiResponse(data, validator, context);
}

/**
 * Fetch JSON with fallback on any error.
 * Never throws - returns fallback value instead.
 *
 * @example
 * ```ts
 * const settings = await fetchJsonOrDefault('/api/settings', isSettings, defaultSettings);
 * ```
 */
export async function fetchJsonOrDefault<T>(
  url: string,
  validator: TypeGuard<T>,
  fallback: T,
  options?: RequestInit
): Promise<T> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) return fallback;

    const data: unknown = await response.json();
    if (validator(data)) return data;
    return fallback;
  } catch {
    return fallback;
  }
}
