import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { shouldCaptureAppErrorCode } from "@/shared/error-codes";
import { asAppError, toClientError } from "@/server/lib/errors";
import { captureServerError } from "@/server/lib/posthog";
import { createLogger } from "@/server/lib/logger";

const log = createLogger({ module: "error-handling" });

export const errorHandlingMiddleware = createMiddleware({
  type: "function",
}).server(async (c) => {
  const { next } = c;

  try {
    return await next();
  } catch (error) {
    if (!(error instanceof Error)) {
      throw new Error("INTERNAL_ERROR", { cause: error });
    }

    const appError = asAppError(error);

    if (shouldCaptureAppErrorCode(appError?.code)) {
      const request = getRequest();
      const url = new URL(request.url);

      log.error("Server function error", error, {
        errorCode: appError?.code ?? "INTERNAL_ERROR",
        method: request.method,
        path: url.pathname,
      });
      void captureServerError(error, {
        errorCode: appError?.code ?? "INTERNAL_ERROR",
        method: request.method,
        path: url.pathname,
      }).catch((err) => {
        log.error("PostHog captureServerError failed", err instanceof Error ? err : new Error(String(err)));
      });
    }

    throw toClientError(error);
  }
});
