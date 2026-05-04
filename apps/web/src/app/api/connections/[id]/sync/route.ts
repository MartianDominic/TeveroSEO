/**
 * Connection Sync API
 * Phase 61-06: Platform Integration Excellence
 *
 * POST /api/connections/:id/sync - Trigger manual sync
 *
 * FIX H-API-02: Use server-fetch instead of direct fetch for proper timeouts,
 *               retries, circuit breaker protection, and consistent error handling.
 * FIX H-API-04: Use LONG_RUNNING_TIMEOUT_MS for sync operations that may take time.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { validateCsrf } from "@/lib/api/security";
import { checkRateLimit, getClientIpFromRequest, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { postOpenSeo, FastApiError, extractRequestContextFromRequest } from "@/lib/server-fetch";
import { LONG_RUNNING_TIMEOUT_MS } from "@/lib/fetch-with-timeout";
import { logger } from '@/lib/logger';

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface SyncResponse {
  success: boolean;
  syncedAt: string;
}

/**
 * POST /api/connections/:id/sync
 * Rate limit: 20 requests per minute (heavy operation - triggers backend sync)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  // Rate limit check (heavy operation)
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

  // CSRF protection for state-changing request
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
    // FIX H-API-04: Use longer timeout for sync operations
    const data = await postOpenSeo<SyncResponse>(
      `/api/platform-connections/${id}/sync`,
      {},
      {
        requestContext: reqContext,
        timeout: LONG_RUNNING_TIMEOUT_MS, // 120s for sync operations
      }
    );

    return NextResponse.json({
      success: true,
      syncedAt: data.syncedAt ?? new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof FastApiError) {
      if (error.status === 404) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      if (error.status === 400) {
        return NextResponse.json(error.toJSON(), { status: 400 });
      }
      logger.error("Backend sync error", { status: error.status, body: error.body });
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    logger.error("Failed to sync connection", error instanceof Error ? error : { error: String(error) });
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}
