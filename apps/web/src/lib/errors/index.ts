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
 *   logError,
 *   getUserFriendlyError,
 *   formatErrorForToast,
 * } from '~/lib/errors';
 * ```
 */

export * from './types';
export * from './handler';
export * from './user-messages';
