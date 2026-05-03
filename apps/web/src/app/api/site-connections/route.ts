import { NextResponse } from "next/server";
import { requireClientAccess, AuthError } from "@/lib/auth/api-auth";
import { z } from "zod";
import { getOpenSeo, postOpenSeo, FastApiError, extractRequestContextFromRequest } from "@/lib/server-fetch";
import { validateCsrf } from "@/lib/api/security";
import { generalApiLimiter, connectionTestLimiter, rateLimitHeaders } from "@/lib/rate-limit";
import {
  createErrorJsonResponse,
  badRequestResponse,
  rateLimitResponse,
  internalErrorResponse,
  validationErrorResponse,
} from "@/lib/error-utils";

// Zod schema for creating a site connection
const createConnectionSchema = z.object({
  clientId: z.string().uuid("clientId must be a valid UUID"),
  platform: z.enum(["wordpress", "shopify", "wix", "squarespace", "webflow", "custom"]),
  siteUrl: z.string().url("siteUrl must be a valid URL"),
  displayName: z.string().optional(),
  credentials: z.object({
    username: z.string().optional(),
    password: z.string().optional(),
    appPassword: z.string().optional(),
    apiKey: z.string().optional(),
    accessToken: z.string().optional(),
    refreshToken: z.string().optional(),
    siteId: z.string().optional(),
    accountId: z.string().optional(),
  }).optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SiteConnection {
  id: string;
  clientId: string;
  platform: string;
  siteUrl: string;
  displayName: string | null;
  hasCredentials: boolean;
  capabilities: string[] | null;
  status: string;
  lastVerifiedAt: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/site-connections
 *
 * List site connections for a client.
 * Rate limit: 100 requests per minute per user (2026-04-28)
 *
 * FIX HIGH-CONTRACT-01: Use standard error response format.
 * FIX MED-CONTRACT-01: Include request_id in error responses.
 */
export async function GET(request: Request) {
  const reqContext = extractRequestContextFromRequest(request as import("next/server").NextRequest);
  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");

  if (!clientId) {
    return badRequestResponse("clientId required", reqContext.requestId);
  }

  try {
    // CRITICAL: Verify user has access to this client before listing connections
    const authContext = await requireClientAccess(clientId);

    // Rate limit: 100 requests per minute
    const rateLimitResult = await generalApiLimiter.limit(authContext.userId);
    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
      return rateLimitResponse(
        "Rate limit exceeded. Please try again later.",
        reqContext.requestId,
        retryAfter
      );
    }

    const data = await getOpenSeo<SiteConnection[]>(
      `/api/connections?clientId=${encodeURIComponent(clientId)}`,
      { requestContext: reqContext }
    );
    return NextResponse.json(data, { headers: rateLimitHeaders(rateLimitResult) });
  } catch (err) {
    if (err instanceof AuthError) {
      return createErrorJsonResponse(
        err.statusCode === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
        err.message,
        reqContext.requestId
      );
    }
    if (err instanceof FastApiError) {
      // FastApiError already has normalized error format
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    return internalErrorResponse("Internal error", reqContext.requestId);
  }
}

/**
 * POST /api/site-connections
 *
 * Create a new site connection.
 * Rate limit: 10 connections per minute per user (SSRF protection) (2026-04-28)
 *
 * FIX HIGH-CONTRACT-01: Use standard error response format.
 * FIX MED-CONTRACT-01: Include request_id in error responses.
 */
export async function POST(request: Request) {
  const reqContext = extractRequestContextFromRequest(request as import("next/server").NextRequest);

  // CSRF protection for state-changing request
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  // Parse JSON body with error handling
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequestResponse("Invalid JSON body", reqContext.requestId);
  }

  // Validate request body with Zod
  const parsed = createConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return validationErrorResponse(
      "Validation failed",
      reqContext.requestId,
      { issues: parsed.error.issues }
    );
  }

  try {
    // CRITICAL: Verify user has access to this client before creating connection
    const authContext = await requireClientAccess(parsed.data.clientId);

    // Rate limit: 10 connection creations per minute (SSRF protection)
    const rateLimitResult = await connectionTestLimiter.limit(authContext.userId);
    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000);
      return rateLimitResponse(
        "Rate limit exceeded. Please try again later.",
        reqContext.requestId,
        retryAfter
      );
    }

    const data = await postOpenSeo<SiteConnection>("/api/connections", parsed.data, {
      requestContext: reqContext,
    });
    return NextResponse.json(data, { status: 201, headers: rateLimitHeaders(rateLimitResult) });
  } catch (err) {
    if (err instanceof AuthError) {
      return createErrorJsonResponse(
        err.statusCode === 401 ? "UNAUTHORIZED" : "FORBIDDEN",
        err.message,
        reqContext.requestId
      );
    }
    if (err instanceof FastApiError) {
      // FastApiError already has normalized error format
      return NextResponse.json(err.toJSON(), { status: err.status });
    }
    return internalErrorResponse("Internal error", reqContext.requestId);
  }
}
