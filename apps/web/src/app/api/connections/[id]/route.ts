/**
 * Connection Detail API
 * Phase 61-06: Platform Integration Excellence
 *
 * GET /api/connections/:id - Get single connection
 * DELETE /api/connections/:id - Remove connection
 *
 * SECURITY (HIGH-26, HIGH-27): Added rate limiting and CSRF protection.
 * FIX H-API-02: Use server-fetch instead of direct fetch for proper timeouts,
 *               retries, circuit breaker protection, and consistent error handling.
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { validateCsrf } from "@/lib/api/security";
import { logger } from '@/lib/logger';
import { checkRateLimit, getClientIpFromRequest, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { getOpenSeo, deleteOpenSeo, FastApiError, extractRequestContextFromRequest } from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PlatformConnection {
  id: string;
  workspaceId: string;
  platform: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ConnectionResponse {
  connection: PlatformConnection;
}

/**
 * GET /api/connections/:id
 * Rate limit: 100 requests per minute (standard API limit)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  // Rate limit check
  const ip = getClientIpFromRequest(request);
  const rateLimitResult = await checkRateLimit(
    `${ip}:${request.nextUrl.pathname}`,
    RATE_LIMITS.API.limit,
    RATE_LIMITS.API.windowMs
  );
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000) },
      { status: 429 }
    );
  }

  const { orgId, userId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const reqContext = extractRequestContextFromRequest(request);

  try {
    // FIX H-API-02: Use server-fetch for proper timeout, retries, and circuit breaker
    const data = await getOpenSeo<ConnectionResponse | PlatformConnection>(
      `/api/platform-connections/${id}`,
      { requestContext: reqContext }
    );

    // Normalize response format
    const connection = 'connection' in data ? data.connection : data;
    return NextResponse.json({ connection });
  } catch (error) {
    if (error instanceof FastApiError) {
      if (error.status === 404) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      logger.error("Backend error", { status: error.status, body: error.body });
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    logger.error("Failed to fetch connection", error instanceof Error ? error : { error: String(error) });
    return NextResponse.json(
      { error: "Failed to fetch connection" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/connections/:id
 * Rate limit: 20 requests per minute (heavy operation)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // Rate limit check (stricter for mutations)
  const ip = getClientIpFromRequest(request);
  const rateLimitResult = await checkRateLimit(
    `${ip}:${request.nextUrl.pathname}`,
    RATE_LIMITS.HEAVY.limit,
    RATE_LIMITS.HEAVY.windowMs
  );
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: "Too many requests", retryAfter: Math.ceil((rateLimitResult.reset - Date.now()) / 1000) },
      { status: 429 }
    );
  }

  // SECURITY (HIGH-27): CSRF protection for state-changing request
  const csrfError = validateCsrf(request);
  if (csrfError) return csrfError;

  const { orgId, userId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const reqContext = extractRequestContextFromRequest(request);

  try {
    // FIX H-API-02: Use server-fetch for proper timeout, retries, and circuit breaker
    await deleteOpenSeo<{ success: boolean }>(
      `/api/platform-connections/${id}`,
      { requestContext: reqContext }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof FastApiError) {
      if (error.status === 404) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      logger.error("Backend error", { status: error.status, body: error.body });
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    logger.error("Failed to delete connection", error instanceof Error ? error : { error: String(error) });
    return NextResponse.json(
      { error: "Failed to delete connection" },
      { status: 500 }
    );
  }
}
