/**
 * Centralized error handling module.
 *
 * Usage:
 * ```typescript
 * import {
 *   ApplicationError,
 *   NotFoundError,
 *   ValidationError,
 *   formatErrorResponse,
 *   logError
 * } from '~/lib/errors';
 * ```
 */

export * from './types';
export * from './handler';
