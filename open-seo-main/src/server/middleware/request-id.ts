/**
 * Request ID middleware for request tracing.
 * Phase 40: Observability improvements.
 *
 * Extracts or generates a request ID for each incoming request,
 * enabling correlation of logs across the request lifecycle.
 *
 * The request ID is:
 * 1. Taken from X-Request-ID header if present (for distributed tracing)
 * 2. Generated as a new UUID if not present
 * 3. Propagated via AsyncLocalStorage to all downstream code
 * 4. Included in the response X-Request-ID header
 */

import {
  runWithRequestId,
  generateRequestId,
  createLogger,
} from "@/server/lib/logger";

const log = createLogger({ module: "request-id-middleware" });

/**
 * Extract or generate a request ID from the request.
 *
 * @param request - The incoming HTTP request
 * @returns The request ID (from header or newly generated)
 */
export function getRequestId(request: Request): string {
  const existingId = request.headers.get("X-Request-ID");
  return existingId || generateRequestId();
}

/**
 * Wrap a handler function with request ID context.
 * All logs within the handler will automatically include the requestId.
 *
 * @param request - The incoming HTTP request
 * @param handler - The route handler to wrap
 * @returns Response with X-Request-ID header added
 *
 * @example
 * export async function GET({ request }) {
 *   return withRequestId(request, async () => {
 *     logger.info("Processing request"); // Includes requestId
 *     return Response.json({ data: "result" });
 *   });
 * }
 */
export async function withRequestId(
  request: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  const requestId = getRequestId(request);

  const response = await runWithRequestId(requestId, async () => {
    log.debug("Request started", {
      method: request.method,
      path: new URL(request.url).pathname,
    });

    try {
      return await handler();
    } catch (error) {
      log.error(
        "Unhandled error in request",
        error instanceof Error ? error : new Error(String(error)),
        {
          method: request.method,
          path: new URL(request.url).pathname,
        },
      );
      throw error;
    }
  });

  // Clone response to add header (Response may be immutable)
  const newHeaders = new Headers(response.headers);
  newHeaders.set("X-Request-ID", requestId);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

/**
 * Get client IP address from request headers.
 * Handles common proxy headers (X-Forwarded-For, X-Real-IP).
 *
 * @param request - The incoming HTTP request
 * @returns Client IP address or "unknown"
 */
export function getClientIP(request: Request): string {
  // Check X-Forwarded-For first (most common proxy header)
  const forwardedFor = request.headers.get("X-Forwarded-For");
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs; first is the client
    const firstIP = forwardedFor.split(",")[0].trim();
    if (firstIP) return firstIP;
  }

  // Check X-Real-IP (used by nginx)
  const realIP = request.headers.get("X-Real-IP");
  if (realIP) return realIP;

  // Check CF-Connecting-IP (Cloudflare)
  const cfIP = request.headers.get("CF-Connecting-IP");
  if (cfIP) return cfIP;

  return "unknown";
}
