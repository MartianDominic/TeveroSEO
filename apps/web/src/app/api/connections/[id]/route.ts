/**
 * Connection Detail API
 * Phase 61-06: Platform Integration Excellence
 *
 * GET /api/connections/:id - Get single connection
 * DELETE /api/connections/:id - Remove connection
 *
 * SECURITY (HIGH-26, HIGH-27): Added rate limiting and CSRF protection.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { validateCsrf } from "@/lib/api/security";
import { checkRateLimit, getClientIpFromRequest, RATE_LIMITS } from "@/lib/middleware/rate-limit";

import { logger } from '@/lib/logger';
interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  // SECURITY (HIGH-26): Rate limit authenticated endpoint
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
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

  try {
    const response = await fetch(
      `${backendUrl}/api/platform-connections/${id}`,
      {
        headers: {
          "x-user-id": userId,
          "x-workspace-id": orgId,
        },
      }
    );

    if (response.status === 404) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Backend error", { error: errorText });
      return NextResponse.json(
        { error: "Failed to fetch connection" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ connection: data.connection ?? data });
  } catch (error) {
    logger.error("Failed to fetch connection", error instanceof Error ? error : { error: String(error) });
    return NextResponse.json(
      { error: "Failed to fetch connection" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  // SECURITY (HIGH-26): Rate limit authenticated endpoint (stricter for mutations)
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
  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001";

  try {
    const response = await fetch(
      `${backendUrl}/api/platform-connections/${id}`,
      {
        method: "DELETE",
        headers: {
          "x-user-id": userId,
          "x-workspace-id": orgId,
        },
      }
    );

    if (response.status === 404) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      logger.error("Backend error", { error: errorText });
      return NextResponse.json(
        { error: "Failed to delete connection" },
        { status: response.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("Failed to delete connection", error instanceof Error ? error : { error: String(error) });
    return NextResponse.json(
      { error: "Failed to delete connection" },
      { status: 500 }
    );
  }
}
