/**
 * Connection List API
 * Phase 61-06: Platform Integration Excellence
 *
 * GET /api/connections - List all connections for workspace
 *
 * SECURITY (HIGH-28): Added rate limiting.
 * FIX H-API-02: Use server-fetch instead of direct fetch for proper timeouts,
 *               retries, circuit breaker protection, and consistent error handling.
 */
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { logger } from '@/lib/logger';
import { withRateLimit, RATE_LIMITS } from "@/lib/middleware/rate-limit";
import { getOpenSeo, FastApiError, extractRequestContextFromRequest } from "@/lib/server-fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PlatformConnection {
  id: string;
  workspaceId: string;
  prospectId?: string;
  platform: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface ConnectionsResponse {
  connections: PlatformConnection[];
}

async function handleGet(request: NextRequest) {
  const { orgId, userId } = await auth();
  if (!orgId || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const reqContext = extractRequestContextFromRequest(request);
  const prospectId = request.nextUrl.searchParams.get("prospectId");

  try {
    // Build query params
    const params = new URLSearchParams({ workspaceId: orgId });
    if (prospectId) {
      params.set("prospectId", prospectId);
    }

    // FIX H-API-02: Use server-fetch for proper timeout, retries, and circuit breaker
    const data = await getOpenSeo<ConnectionsResponse | PlatformConnection[]>(
      `/api/platform-connections?${params}`,
      { requestContext: reqContext }
    );

    // Normalize response format
    const connections = Array.isArray(data) ? data : (data.connections ?? []);
    return NextResponse.json({ connections });
  } catch (error) {
    if (error instanceof FastApiError) {
      logger.error("Backend error", { status: error.status, body: error.body });
      return NextResponse.json(error.toJSON(), { status: error.status });
    }
    logger.error("Failed to fetch connections", error instanceof Error ? error : { error: String(error) });
    return NextResponse.json(
      { error: "Failed to fetch connections" },
      { status: 500 }
    );
  }
}

// Rate limit: 100 requests per minute (standard API limit)
export const GET = withRateLimit(handleGet, RATE_LIMITS.API);
