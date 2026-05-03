import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { AppError } from "@/server/lib/errors";
import { errorHandlingMiddleware } from "@/middleware/errorHandling";
import type { EnsuredUserContext } from "@/middleware/ensure-user/types";
import { ensureUserMiddleware } from "@/middleware/ensureUser";
import { requireManagedServiceAccess } from "@/server/billing/subscription";
import { resolveClientId, CLIENT_ID_HEADER } from "@/server/lib/client-context";

// UUID regex for client ID validation
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Require and validate X-Client-ID header.
 *
 * Phase 68-02: Client Context Security
 * - CRITICAL-01 FIX: Empty X-Client-ID returns 400 (not silent pass-through)
 * - Invalid UUID format returns 400 with INVALID_CLIENT_ID code
 * - Missing header returns 400 with MISSING_CLIENT_ID code
 *
 * This is a defense-in-depth layer that validates format before the full
 * resolveClientId() flow which also checks DB existence and ownership.
 *
 * @param request - The HTTP request with X-Client-ID header
 * @returns Validated client ID (UUID format confirmed)
 * @throws AppError with 400 status for missing/invalid client ID
 */
export function requireClientContext(request: Request): string {
  const clientId = request.headers.get(CLIENT_ID_HEADER);

  // CRITICAL-01: Empty or missing header must return 400, not pass through
  if (!clientId || clientId.trim() === "") {
    throw new AppError(
      "VALIDATION_ERROR",
      "X-Client-ID header is required"
    );
  }

  const trimmed = clientId.trim();

  // Validate UUID format before any DB lookup
  if (!UUID_RE.test(trimmed)) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Invalid X-Client-ID format: must be a valid UUID"
    );
  }

  return trimmed;
}

const ensuredUserContextSchema: z.ZodType<EnsuredUserContext> = z.object({
  userId: z.string(),
  userEmail: z.string(),
  organizationId: z.string(),
  project: z.any().optional(),
});

function getAuthenticatedContext(context: unknown): EnsuredUserContext {
  const result = ensuredUserContextSchema.safeParse(context);
  if (!result.success) {
    throw new AppError(
      "INTERNAL_ERROR",
      "Authenticated server function context missing",
    );
  }
  return result.data;
}

export const globalServerFunctionMiddleware = [
  errorHandlingMiddleware,
  ensureUserMiddleware,
] as const;

export const requireAuthenticatedContext = [
  createMiddleware({ type: "function" }).server(async ({ next, context }) => {
    const authenticatedContext = getAuthenticatedContext(context);
    await requireManagedServiceAccess(authenticatedContext);

    // AUTH-03 / SHELL-04: resolve client_id from header or URL query param.
    // Throws FORBIDDEN if the value is present but invalid/unknown.
    const { headers, url } = getRequest();
    const clientId = await resolveClientId(headers, url);

    return next({
      context: { ...authenticatedContext, clientId },
    });
  }),
] as const;

export const requireProjectContext = [
  createMiddleware({ type: "function" }).server(async ({ next, context }) => {
    const authenticatedContext = getAuthenticatedContext(context);

    await requireManagedServiceAccess(authenticatedContext);

    if (!authenticatedContext.project) {
      throw new AppError(
        "INTERNAL_ERROR",
        "Project context missing from authenticated server function",
      );
    }

    // AUTH-03 / SHELL-04: resolve client_id from header or URL query param.
    // Throws FORBIDDEN if the value is present but invalid/unknown.
    const { headers, url } = getRequest();
    const clientId = await resolveClientId(headers, url);

    return next({
      context: {
        ...authenticatedContext,
        project: authenticatedContext.project,
        projectId: authenticatedContext.project.id,
        clientId,
      },
    });
  }),
] as const;

/**
 * Middleware that REQUIRES a valid X-Client-ID header.
 *
 * Phase 68-02: Client Context Security
 * Use this for endpoints that must operate within a client context.
 * Unlike requireAuthenticatedContext, this will reject requests with
 * missing or empty X-Client-ID headers with a 400 error.
 *
 * Security: Validates format first (400), then existence/ownership (403).
 */
export const requireAuthenticatedWithClientContext = [
  createMiddleware({ type: "function" }).server(async ({ next, context }) => {
    const authenticatedContext = getAuthenticatedContext(context);
    await requireManagedServiceAccess(authenticatedContext);

    // Phase 68-02 CRITICAL-01: Require client ID (400 if missing/invalid format)
    const request = getRequest();
    const clientIdFromHeader = requireClientContext(request);

    // Now do the full validation including DB existence check and ownership
    const { headers, url } = getRequest();
    const clientId = await resolveClientId(headers, url);

    // Double-check that clientId is not null (should match clientIdFromHeader)
    if (!clientId) {
      throw new AppError(
        "VALIDATION_ERROR",
        "X-Client-ID header is required"
      );
    }

    return next({
      context: { ...authenticatedContext, clientId },
    });
  }),
] as const;
