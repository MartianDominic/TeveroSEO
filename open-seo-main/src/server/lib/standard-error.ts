/**
 * @deprecated This file is deprecated. Import from @/server/lib/errors instead.
 *
 * CONSOLIDATION: All error types and utilities have been merged into:
 * - @/shared/error-codes (ErrorCode type, HTTP mappings, classification)
 * - @/server/lib/errors (AppError class, factory functions)
 *
 * This file re-exports for backward compatibility only.
 * New code should import directly from the consolidated modules.
 */

// Re-export everything from the consolidated modules
export {
  type ErrorCode,
  ERROR_CODE_TO_HTTP_STATUS,
  HTTP_STATUS_TO_ERROR_CODE,
  getHttpStatus,
  deriveErrorCode,
} from "@/shared/error-codes";

export {
  AppError,
  type ErrorResponse,
  type StandardErrorResponse as StandardError,
  getRequestId,
  createErrorResponse,
  // Legacy convenience functions
  notFoundError,
  validationError,
  unauthorizedError,
  forbiddenError,
  rateLimitError,
  internalError,
  conflictError,
  badRequestError,
} from "@/server/lib/errors";

// Alias for backward compatibility
import { AppError } from "@/server/lib/errors";

/**
 * @deprecated Use AppError from @/server/lib/errors instead.
 */
export const StandardAppError = AppError;
