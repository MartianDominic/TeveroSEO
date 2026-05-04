/**
 * Connection List API
 * Phase 61-06: Platform Integration Excellence
 *
 * GET /api/connections - List all connections for workspace
 *
 * SECURITY (HIGH-28): Added rate limiting.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit, getClientIpFromRequest, RATE_LIMITS } from "@/lib/middleware/rate-limit";

import { logger } from '@/lib/logger';
export async function GET(request: NextRequest) {
  // SECURITY (HIGH-28): Rate limit authenticated endpoint
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

  const prospectId = request.nextUrl.searchParams.get("prospectId");
  // CFG-CRIT-01 FIX: Standardized to OPEN_SEO_URL
  const backendUrl = process.env.OPEN_SEO_URL || "http://localhost:3001";

  try {
    const params = new URLSearchParams({ workspaceId: orgId });
    if (prospectId) {
      params.set("prospectId", prospectId);
    }

    const response = await fetch(
      `${backendUrl}/api/platform-connections?${params}`,
      {
        headers: {
          "x-user-id": userId,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Backend error", { error: errorText });
      return NextResponse.json(
        { error: "Failed to fetch connections" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ connections: data.connections ?? data });
  } catch (error) {
    logger.error("Failed to fetch connections", error instanceof Error ? error : { error: String(error) });
    return NextResponse.json(
      { error: "Failed to fetch connections" },
      { status: 500 }
    );
  }
}
