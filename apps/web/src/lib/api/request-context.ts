/**
 * Request Context Utilities
 *
 * Provides correlation ID and request ID handling for cross-service tracing.
 *
 * FIX HIGH-API-02: Correlation ID propagation across all API calls.
 * FIX MED-API-02: Extract and forward x-request-id from edge.
 */

import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { headers } from "next/headers";

/**
 * Request context containing tracing identifiers and client context.
 */
export interface RequestContext {
  /** Unique ID for this request (from edge or generated) */
  requestId: string;
  /** Correlation ID for tracing across services */
  correlationId: string;
  /** Client ID from incoming request (HIGH-12-01: propagated to downstream services) */
  clientId?: string;
}

/**
 * Extract request context from incoming Next.js headers.
 * Falls back to generating new IDs if not present.
 *
 * Looks for:
 * - x-request-id: Set by edge/proxy (nginx, Vercel, Cloudflare)
 * - x-correlation-id: Set by upstream services
 *
 * If not found, generates new UUIDs.
 */
export async function extractRequestContext(): Promise<RequestContext> {
  const headersList = await headers();

  // Extract or generate request ID
  const incomingRequestId =
    headersList.get("x-request-id") ||
    headersList.get("x-vercel-id") ||
    headersList.get("cf-ray");

  // Extract or generate correlation ID
  const incomingCorrelationId = headersList.get("x-correlation-id");

  // HIGH-12-01 FIX: Extract client ID for propagation to downstream services
  const incomingClientId = headersList.get("x-client-id");

  return {
    requestId: incomingRequestId || randomUUID(),
    correlationId: incomingCorrelationId || randomUUID(),
    clientId: incomingClientId || undefined,
  };
}

/**
 * Extract request context from NextRequest object.
 * Use in API route handlers where NextRequest is available.
 */
export function extractRequestContextFromRequest(
  req: NextRequest
): RequestContext {
  // Extract or generate request ID
  const incomingRequestId =
    req.headers.get("x-request-id") ||
    req.headers.get("x-vercel-id") ||
    req.headers.get("cf-ray");

  // Extract or generate correlation ID
  const incomingCorrelationId = req.headers.get("x-correlation-id");

  // HIGH-12-01 FIX: Extract client ID for propagation to downstream services
  const incomingClientId = req.headers.get("x-client-id");

  return {
    requestId: incomingRequestId || randomUUID(),
    correlationId: incomingCorrelationId || randomUUID(),
    clientId: incomingClientId || undefined,
  };
}

/**
 * Build headers for downstream service requests including tracing IDs.
 *
 * @param context - Request context with tracing identifiers
 * @param additionalHeaders - Additional headers to include
 */
export function buildTracingHeaders(
  context: RequestContext,
  additionalHeaders?: Record<string, string>
): Record<string, string> {
  return {
    "X-Request-Id": context.requestId,
    "X-Correlation-Id": context.correlationId,
    ...additionalHeaders,
  };
}

/**
 * Add tracing headers to an outgoing response.
 * Allows clients to correlate their requests with server-side logs.
 */
export function addTracingHeadersToResponse(
  responseHeaders: Headers,
  context: RequestContext
): void {
  responseHeaders.set("X-Request-Id", context.requestId);
  responseHeaders.set("X-Correlation-Id", context.correlationId);
}
