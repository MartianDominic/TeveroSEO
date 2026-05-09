import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { shouldCaptureAppErrorCode } from "@/shared/error-codes";
import {
  AppError,
  asAppError,
  toClientError,
  getRequestId,
  createErrorResponse,
  deriveErrorCode,
  type ErrorCode,
} from "@/server/lib/errors";
import { captureServerError } from "@/server/lib/posthog";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "error-handling" });

/**
 * Error handling middleware with standard error response format.
 *
 * FIX HIGH-CONTRACT-01: Unified error response format across all services.
 * FIX MED-CONTRACT-01: Include request_id in all error responses.
 */
export const errorHandlingMiddleware = createMiddleware({
  type: "function",
}).server(async (c) => {
  const { next } = c;

  try {
    return await next();
  } catch (error) {
    const requestId = getRequestId();

    if (!(error instanceof Error)) {
      throw new Error("INTERNAL_ERROR", { cause: error });
    }

    // Handle AppError (already in correct format)
    if (error instanceof AppError) {
      log.error("Server function error", error, {
        errorCode: error.code,
        requestId,
      });

      void captureServerError(error, {
        errorCode: error.code,
        requestId,
      }).catch((err) => {
        log.error("PostHog captureServerError failed", err instanceof Error ? err : new Error(String(err)));
      });

      // Re-throw with standard format preserved
      throw error;
    }

    const appError = asAppError(error);

    if (shouldCaptureAppErrorCode(appError?.code)) {
      const request = getRequest();
      const url = new URL(request.url);

      log.error("Server function error", error, {
        errorCode: appError?.code ?? "INTERNAL_ERROR",
        method: request.method,
        path: url.pathname,
        requestId,
      });
      void captureServerError(error, {
        errorCode: appError?.code ?? "INTERNAL_ERROR",
        method: request.method,
        path: url.pathname,
        requestId,
      }).catch((err) => {
        log.error("PostHog captureServerError failed", err instanceof Error ? err : new Error(String(err)));
      });
    }

    // FIX HIGH-CONTRACT-01: Convert to standard error format
    const errorCode: ErrorCode = (appError?.code as ErrorCode) ?? "INTERNAL_ERROR";
    const clientError = toClientError(error);

    // Wrap in AppError to ensure standard format
    throw new AppError(
      errorCode,
      clientError.message,
      process.env.NODE_ENV !== "production"
        ? { originalError: error.message }
        : undefined
    );
  }
});
